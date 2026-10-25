// One engine for Watch, replay and simulation (ADR-010). Pure: it reads only records known at time t,
// so a past checkpoint never sees what happened after it.
import { packet, type Packet, type Rec } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"

export type Level = "fine" | "watch" | "likely_to_slip"
export type SignalKind =
  | "cutoff" | "availability" | "stale_quote" | "unknown_outcome" | "missed_milestone" | "positioning" | "eta_vs_promise" | "open_question"
  | "exposure"

export type Signal = { kind: SignalKind; severity: "watch" | "slip"; text: string; at: string; minutes?: number }
export type Exposure = { route: string; modes: string[]; make: string | null; dealership: string | null }
export type RateLookup = Map<string, { kind: string; key: string; k: number; n: number; shrunk: number }>
export type EvaluateOptions = { rates?: RateLookup }

export type Evaluation = { order: string; t: string; active: boolean; level: Level; signals: Signal[]; exposure: Exposure }

const MINUTE = 60_000
const s = (v: unknown) => (typeof v === "string" ? v : "")
const known = (at: unknown, t: string) => Boolean(s(at)) && s(at) <= t

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return h ? `${h} h ${minutes % 60} m` : `${minutes} m`
}

function eventAt(p: Packet, orderId: string, command: string, t: string): string | null {
  const event = p.forOrder(orderId, "operational_events").filter((e) => e.command === command && known(e.recorded_at, t))
    .sort((a, b) => s(a.recorded_at).localeCompare(s(b.recorded_at)))[0]
  return event ? s(event.recorded_at) : null
}

function openAlert(p: Packet, orderId: string, signal: string, t: string): Rec | undefined {
  return p.forOrder(orderId, "alerts").find((a) =>
    a.signal === signal && known(a.triggered_at, t) && !(a.resolved_at && known(a.resolved_at, t)))
}

/** The order's exposure to each source of failure. With `t`, only travel known by then counts. */
export function exposureOf(p: Packet, order: Rec, t?: string): Exposure {
  const country = (id: unknown) => s(p.byId("addresses", s(id))?.country)
  const item = p.forOrder(order.id, "order_items").find((i) => i.role === "PRIMARY")
  const vehicle = item ? p.byId("vehicles", s(item.vehicle_id)) : undefined
  const site = order.pickup_site_id ? p.byId("sites", s(order.pickup_site_id)) : undefined
  const modes = new Set<string>(["road"])
  const options = p.forOrder(order.id, "travel_options").filter((o) => !t || known(o.checked_at, t))
  const bookings = p.forOrder(order.id, "travel_reservations").filter((r) => !t || known(r.booked_at, t))
  for (const leg of [...options, ...bookings]) {
    if (leg.kind === "FERRY" || leg.kind === "TRAIN" || leg.kind === "FLIGHT") modes.add(String(leg.kind).toLowerCase())
  }
  return {
    route: `${country(order.pickup_address_id)} → ${country(order.delivery_address_id)}`,
    modes: [...modes].sort(),
    make: vehicle ? s(vehicle.make) : null,
    dealership: site ? s(site.name) : null,
  }
}

function signalsAt(policy: Policy, p: Packet, order: Rec, t: string): Signal[] {
  const id = order.id
  const tMs = Date.parse(t)
  const out: Signal[] = []
  // Booked at t means booked by then and not cancelled by then. The snapshot's final status (for example a
  // later missed check-in) is not known at t.
  const bookedAt = (r: Rec) => known(r.booked_at, t) && !(r.cancelled_at && known(r.cancelled_at, t))
  const ferryBooked = p.forOrder(id, "travel_reservations").filter((r) => r.kind === "FERRY" && bookedAt(r))
  // A check-in counts once the gate's acceptance was recorded; the reservation's confirmation field is undated.
  const checkedIn = new Set(p.forOrder(id, "ferry_terminal_events")
    .filter((e) => e.kind === "CHECK_IN_ACCEPTED" && known(e.recorded_at, t)).map((e) => s(e.reservation_id)))

  // 1. Slack to the cutoff on a booked crossing that has not checked in.
  for (const r of ferryBooked) {
    const cutoff = s(r.check_in_cutoff_at)
    if (!cutoff || cutoff <= t || checkedIn.has(r.id)) continue
    const minutes = Math.round((Date.parse(cutoff) - tMs) / MINUTE)
    if (minutes <= policy.watch.slack_min_minutes) {
      out.push({
        kind: "cutoff", severity: minutes <= policy.watch.likely_slip_slack_minutes ? "slip" : "watch",
        text: `Ferry check-in closes in ${duration(minutes)}.`, at: cutoff, minutes,
      })
    }
  }

  const options = p.forOrder(id, "travel_options").filter((o) => known(o.checked_at, t) && s(o.departure_at) > t)
  // 2. The selected crossing is sold out and nothing replaces it yet.
  if (!ferryBooked.length && options.some((o) => o.kind === "FERRY" && o.status === "SOLD_OUT")) {
    out.push({ kind: "availability", severity: "slip", text: "The planned crossing is sold out and nothing is booked.", at: t })
  }
  // 3. A quote that is too old to trust, when the trip has no booked travel yet.
  // Once travel is booked, the remaining quotes are only alternatives.
  const anyBooked = p.forOrder(id, "travel_reservations").some(bookedAt)
  if (!anyBooked) {
    const stale = options.filter((o) => o.status === "AVAILABLE_QUOTE"
      && tMs - Date.parse(s(o.checked_at)) > policy.watch.quote_max_age_hours * 60 * MINUTE)
    if (stale.length) {
      const hours = Math.round((tMs - Date.parse(s(stale[0].checked_at))) / (60 * MINUTE))
      out.push({ kind: "stale_quote", severity: "watch", text: `The travel quote is ${hours} h old.`, at: s(stale[0].checked_at) })
    }
  }
  // 4. A booking attempt whose outcome nobody has confirmed.
  for (const a of p.forOrder(id, "agent_proposals")) {
    const execution = a.execution as Rec | null
    if (execution && /timed out/i.test(s(execution.error)) && known(execution.attempted_at, t)) {
      out.push({ kind: "unknown_outcome", severity: "slip", text: "A booking attempt timed out with no confirmation.", at: s(execution.attempted_at) })
    }
  }
  // 5. A missed milestone: a tracking gap or missed check-in that is still open.
  for (const signal of ["TRACKING_GAP", "MISSED_CHECK_IN"]) {
    const alert = openAlert(p, id, signal, t)
    if (alert) out.push({ kind: "missed_milestone", severity: "watch", text: signal === "TRACKING_GAP" ? "No recent driver-app position." : "Ferry check-in was missed.", at: s(alert.triggered_at) })
  }
  // 6. The driver cannot credibly reach pickup after the previous duty.
  for (const a of p.forOrder(id, "work_assignments")) {
    const positioning = a.positioning as Rec | undefined
    if (positioning?.assessment === "DRIVER_REPORTED_UNWORKABLE" && known(positioning.driver_reported_at, t)) {
      out.push({ kind: "positioning", severity: "slip", text: "The driver says they cannot reach the pickup after their current job.", at: s(positioning.driver_reported_at) })
    }
  }
  // 7. The driver app's ETA is later than the promise.
  const promise = p.forOrder(id, "time_windows").find((w) => w.purpose === "CUSTOMER_DELIVERY_PROMISE")
  const latest = p.forOrder(id, "tracking_observations").filter((o) => known(o.received_at, t))
    .sort((a, b) => s(b.received_at).localeCompare(s(a.received_at)))[0]
  if (promise && latest?.estimated_delivery_at && s(latest.estimated_delivery_at) > s(promise.end_at)) {
    out.push({ kind: "eta_vs_promise", severity: "slip", text: "The driver app's ETA is later than the delivery promise.", at: s(latest.received_at) })
  }
  // 8. An open question about the driver.
  const fitness = openAlert(p, id, "DRIVER_AVAILABILITY_RISK", t)
  if (fitness) out.push({ kind: "open_question", severity: "watch", text: "The driver has not confirmed they are fit to drive.", at: s(fitness.triggered_at) })

  return out
}

const SOURCE_LABEL: Record<string, (key: string) => string> = {
  route: (key) => `the ${key} route`, mode: (key) => `${key} legs`, make: (key) => `a ${key}`, dealership: (key) => `a pickup at ${key}`,
}

// A root-cause lesson: an order riding on a source that keeps failing deserves a look before anything goes wrong.
function exposureSignal(policy: Policy, exposure: Exposure, rates: RateLookup, t: string): Signal | null {
  if (!policy.risk.watch_on_elevated) return null
  const keys: [string, string][] = [["route", exposure.route], ...exposure.modes.filter((m) => m !== "road").map((m): [string, string] => ["mode", m])]
  if (exposure.make) keys.push(["make", exposure.make])
  if (exposure.dealership) keys.push(["dealership", exposure.dealership])
  const worst = keys.map(([kind, key]) => rates.get(`${kind}|${key}`))
    .filter((r): r is NonNullable<typeof r> => !!r && r.n >= policy.risk.min_sample && r.shrunk >= policy.risk.elevated_rate)
    .sort((a, b) => b.shrunk - a.shrunk)[0]
  if (!worst) return null
  return { kind: "exposure", severity: "watch", at: t, text: `This order rides on ${SOURCE_LABEL[worst.kind](worst.key)}, where ${worst.k} of ${worst.n} orders had a problem.` }
}

export function evaluate(policy: Policy, reference: string, t: string, p: Packet = packet(), options: EvaluateOptions = {}): Evaluation {
  const order = p.orderByRef(reference)
  if (!order) throw new Error(`No order ${reference}`)
  const exposure = exposureOf(p, order, t)
  const created = s(order.created_at)
  const finished = eventAt(p, order.id, "vehicle.delivered", t) ?? (order.cancelled_at && known(order.cancelled_at, t) ? s(order.cancelled_at) : null)
  const active = known(created, t) && !finished
  if (!active) return { order: reference, t, active, level: "fine", signals: [], exposure }

  const signals = signalsAt(policy, p, order, t)
  const exposed = options.rates ? exposureSignal(policy, exposure, options.rates, t) : null
  if (exposed) signals.push(exposed)
  const level: Level = signals.some((x) => x.severity === "slip") ? "likely_to_slip" : signals.length ? "watch" : "fine"
  return { order: reference, t, active, level, signals, exposure }
}
