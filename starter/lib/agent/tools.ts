// Tool implementations over the packet (ADR-015). Read, ask and plan tools only:
// propose, flag and stop tools become proposals or records in the loop, never effects here.
import { now } from "@/lib/clock"
import { packet, type Rec } from "@/lib/packet"
import { evidenceFor, type Evidence } from "@/lib/present/evidence"
import { DRIVER_REPLIES, HOTEL_AFTER_HOURS, HOTEL_NIGHT_CENTS, LAST_STRETCH_HOURS } from "./mocks"
import { recordedCall } from "./calls"
import { type DriverMarket, searchAnswers } from "../answers/search"

type Input = Record<string, unknown>
type Result = Record<string, unknown>

const HOUR = 3_600_000
const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null)
const plus = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * HOUR).toISOString()

function findOrder(input: Input): Rec | { error: string } {
  const ref = String(input.order ?? "")
  return packet().orderByRef(ref) ?? { error: `No order ${ref} in the packet.` }
}

function carFor(orderId: string): string {
  const p = packet()
  const item = p.forOrder(orderId, "order_items").find((i) => i.role === "PRIMARY")
  const vehicle = item && p.byId("vehicles", String(item.vehicle_id))
  return vehicle ? `${vehicle.make} ${vehicle.model}` : "Car not recorded"
}

function driverFor(orderId: string): Rec | undefined {
  const p = packet()
  const assignment = p.forOrder(orderId, "work_assignments").find((a) => !a.cancelled_at)
  return assignment ? p.byId("drivers", String(assignment.driver_id)) : undefined
}

function window(orderId: string, purpose: string): Rec | undefined {
  return packet().forOrder(orderId, "time_windows").find((w) => w.purpose === purpose)
}

function travelEvidence(option: Rec): Evidence {
  return evidenceFor({ kind: "travel_option", status: String(option.status), at: String(option.checked_at) })
}

function getCase(input: Input): Result {
  const order = findOrder(input)
  if ("error" in order) return order
  const p = packet()
  const id = order.id
  const customer = p.byId("customers", String(order.customer_id))
  const driver = driverFor(id)
  return {
    order: order.reference,
    status: order.status,
    route_kind: order.route_kind,
    car: carFor(id),
    customer: customer?.name ?? "Unknown customer",
    driver: driver ? `${driver.display_name} (home ${driver.home_city})` : "No driver assigned",
    windows: p.forOrder(id, "time_windows").map((w) => ({
      purpose: w.purpose, start: w.start_at, end: w.end_at, timezone: w.timezone, set_by: w.source,
    })),
    travel: p.forOrder(id, "travel_options").map((t) => ({
      id: t.id, kind: t.kind, provider: t.provider, from: t.from_city, to: t.to_city,
      departs: t.departure_at, arrives: t.arrival_at, check_in_cutoff: t.check_in_cutoff_at ?? null,
      price_cents: t.quote_cents, note: t.capacity_note, evidence: travelEvidence(t),
    })),
    bookings: p.forOrder(id, "travel_reservations").map((r) => ({
      id: r.id, kind: r.kind, provider: r.provider, departs: r.departure_at, check_in_cutoff: r.check_in_cutoff_at ?? null,
      evidence: evidenceFor({ kind: "travel_reservation", status: String(r.status), at: String(r.booked_at ?? r.created_at ?? "") }),
    })),
    alerts: p.forOrder(id, "alerts").map((a) => ({
      signal: a.signal, status: a.status, summary: a.summary, next_action: a.next_action ?? null,
      evidence: evidenceFor({ kind: "alert", at: String(a.triggered_at) }),
    })),
    messages: p.forOrder(id, "messages")
      .sort((a, b) => String(a.authored_at).localeCompare(String(b.authored_at)))
      .map((m) => ({
        at: m.authored_at, channel: m.channel, text: m.body,
        evidence: evidenceFor({ kind: "message", authorType: String(m.author_type), at: String(m.authored_at) }),
      })),
    earlier_agent_actions: p.forOrder(id, "agent_proposals").map((a) => {
      const execution = a.execution as Rec | null
      const error = str(execution?.error)
      return {
        action: a.command, status: a.status, error,
        evidence: error && /timed out/i.test(error)
          ? evidenceFor({ kind: "booking_attempt", outcome: "TIMED_OUT", at: String(execution?.attempted_at) })
          : evidenceFor({ kind: "event", at: String(a.created_at) }),
      }
    }),
    open_work: [
      ...p.forOrder(id, "incidents").filter((i) => !i.resolved_at).map((i) => ({ kind: i.kind, status: i.status })),
      ...p.forOrder(id, "work_items").filter((w) => w.status !== "DONE").map((w) => ({ kind: w.kind, next_action: w.next_action })),
    ],
    now: now().toISOString(),
  }
}

function getTravelOptions(input: Input): Result {
  const c = getCase(input)
  return "error" in c ? c : { order: c.order, travel: c.travel, bookings: c.bookings }
}

function checkProviderStatus(input: Input): Result {
  const order = findOrder(input)
  if ("error" in order) return order
  // Mock provider desk: it holds exactly the reservations the packet records, nothing more.
  const held = packet().forOrder(order.id, "travel_reservations").filter((r) => r.kind === "FERRY" && r.status === "BOOKED")
  const evidence = { strength: "observed" as const, label: "provider desk replied (mock)", at: now().toISOString() }
  if (held.length === 0) {
    return {
      order: order.reference, provider: input.provider, holds_reservation: false, reference: null, evidence,
      answer: "No reservation is held for this order. No charge was taken. Any earlier request did not complete.",
    }
  }
  const booking = held[0]
  return {
    order: order.reference, provider: input.provider, holds_reservation: true, reference: booking.id, departs: booking.departure_at,
    check_in_cutoff: booking.check_in_cutoff_at ?? null, evidence,
    answer: "A booking is held for this order and is still active.",
  }
}

function priceAlternatives(input: Input): Result {
  const order = findOrder(input)
  if ("error" in order) return order
  const id = order.id
  const pickupEnd = str(window(id, "SELECTED_PICKUP_SLOT")?.end_at)
  const promiseEnd = str(window(id, "CUSTOMER_DELIVERY_PROMISE")?.end_at)
  const options = packet().forOrder(id, "travel_options")
    .filter((t) => t.kind === "FERRY" && t.status === "AVAILABLE_QUOTE")
    .map((t) => {
      const departs = String(t.departure_at)
      const atTerminal = pickupEnd ? plus(pickupEnd, Number(t.road_time_to_terminal_hours ?? 0)) : null
      const waitHours = atTerminal ? (Date.parse(departs) - Date.parse(atTerminal)) / HOUR : 0
      const hotelNights = waitHours > HOTEL_AFTER_HOURS ? 1 : 0
      const ferry = Number(t.quote_cents ?? 0)
      const arrives = str(t.arrival_at)
      const deliveredBy = arrives ? plus(arrives, LAST_STRETCH_HOURS) : null
      return {
        option_id: t.id,
        label: `${t.provider} ${t.from_city} to ${t.to_city}`,
        departure_at: departs,
        check_in_cutoff_at: t.check_in_cutoff_at ?? null,
        status: "quote, not booked",
        quote_checked_at: t.checked_at,
        ferry_cents: ferry,
        hotel_nights: hotelNights,
        hotel_cents: hotelNights * HOTEL_NIGHT_CENTS,
        total_cents: ferry + hotelNights * HOTEL_NIGHT_CENTS,
        currency: t.currency ?? "EUR",
        driver_at_terminal_estimate: atTerminal,
        makes_check_in: atTerminal && t.check_in_cutoff_at ? atTerminal <= String(t.check_in_cutoff_at) : null,
        arrives_by: arrives,
        delivered_by_estimate: deliveredBy,
        makes_delivery_promise: deliveredBy && promiseEnd ? deliveredBy <= promiseEnd : null,
        basis: "Packet quote and timetable; hotel price and last-stretch time are mock estimates.",
      }
    })
  return { order: order.reference, delivery_promise_ends: promiseEnd, options }
}

function messageDriver(input: Input): Result {
  const reply = DRIVER_REPLIES[String(input.order)]
  if (!reply) return { sent: true, reply: null, note: "Message sent. No reply recorded yet." }
  const at = new Date(now().getTime() + reply.minutesLater * 60_000).toISOString()
  return { sent: true, reply: { text: reply.text, evidence: evidenceFor({ kind: "message", authorType: "driver", at }) } }
}

function getRoadEstimate(input: Input): Result {
  const p = packet()
  const wanted = String(input.terminal ?? "").toLowerCase()
  const terminal = p.all("ferry_terminals").find((t) => String(t.name).toLowerCase().includes(wanted) || t.id === input.terminal)
  const estimate = terminal && p.all("terminal_road_estimates").find(
    (e) => e.to_terminal_id === terminal.id && String(e.from_city).toLowerCase() === String(input.from_city).toLowerCase(),
  )
  if (!estimate) return { error: `No planning estimate from ${input.from_city} to ${input.terminal}.` }
  return {
    from_city: estimate.from_city, terminal: terminal!.name, distance_km: estimate.approximate_road_distance_km,
    drive_minutes_low: estimate.drive_minutes_low, drive_minutes_high: estimate.drive_minutes_high,
    excludes: estimate.excludes, note: "Historical planning range only, not a live ETA.",
  }
}

function getFerryTerminals(): Result {
  return {
    terminals: packet().all("ferry_terminals").map((t) => ({ id: t.id, name: t.name, city: t.city, note: t.note })),
  }
}

const MARKETS = new Set(["FI", "DE", "DK"])

// The driver's market decides which entries apply: the order's driver first, else what the caller says.
function marketFor(input: Input): DriverMarket | undefined {
  const order = input.order ? packet().orderByRef(String(input.order)) : undefined
  const home = order ? driverFor(order.id)?.home_country : input.market
  if (typeof home !== "string" || !home) return undefined
  return MARKETS.has(home) ? (home as DriverMarket) : "OTHER"
}

function answerBook(input: Input): Result {
  const market = marketFor(input)
  const entries = searchAnswers(String(input.question ?? ""), market)
  if (!entries.length) return { market: market ?? null, entries: [], note: "No entry covers this. Do not guess policy: ask Driver Support or escalate." }
  return { market: market ?? null, entries, note: "Follow each entry's routing. Never assert anything listed under cautions." }
}

function call(input: Input): Result {
  return recordedCall(String(input.order), input.recipient_role === "driver" ? "driver" : "site")
}

const READERS: Record<string, (input: Input) => Result> = {
  get_case: getCase,
  get_travel_options: getTravelOptions,
  get_ferry_terminals: getFerryTerminals,
  answer_book: answerBook,
  get_road_estimate: getRoadEstimate,
  check_provider_status: checkProviderStatus,
  price_alternatives: priceAlternatives,
  message_driver: messageDriver,
  call_site: call,
  call_driver: call,
}

export function isReadTool(name: string): boolean {
  return name in READERS
}

export function runTool(name: string, input: Input): Result {
  const reader = READERS[name]
  if (!reader) return { error: `${name} is not a read, ask or plan tool.` }
  return reader(input)
}
