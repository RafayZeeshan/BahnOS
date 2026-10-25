// The trip as legs (ADR-012). Packet times always win; synthetic distance-based estimates only fill gaps,
// and every synthetic value says so. ETAs are never blended: each leg keeps its basis.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { now } from "@/lib/clock"
import { packet, type Rec } from "@/lib/packet"

import type { Leg, Route, Stop } from "./types"

export type { Leg, Route, Stop } from "./types"
export { googleMapsLink } from "./types"

const MINUTE = 60_000
const ROAD_KMH = 75
const ROAD_FACTOR = 1.25
const BUFFER_MIN = 30

let stops: Record<string, Stop> | undefined
function stopsByName(): Record<string, Stop> {
  stops ??= (JSON.parse(readFileSync(/*turbopackIgnore: true*/ join(process.cwd(), "..", "data", "geo", "stops.json"), "utf8")) as { stops: Record<string, Stop> }).stops
  return stops
}

/** The local time zone of a city or terminal named in the packet, from the geo layer. */
export function zoneOf(name: string | null | undefined): string | null {
  return name ? stopsByName()[name]?.timezone ?? null : null
}

function stop(name: string | null | undefined): Stop | null {
  if (!name) return null
  return stopsByName()[name] ?? null
}

function km(a: Stop, b: Stop): number {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function estimatedDrive(from: Stop, to: Stop, departAt: string | null): Leg {
  const minutes = Math.round((km(from, to) * ROAD_FACTOR / ROAD_KMH) * 60 + BUFFER_MIN)
  return {
    mode: "drive", from, to, departAt, arriveAt: departAt ? new Date(Date.parse(departAt) + minutes * MINUTE).toISOString() : null,
    minutes, basis: "estimate", status: "estimated", priceCents: null, synthetic: true,
  }
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null)

export function buildRoute(reference: string): Route | null {
  const p = packet()
  const order = p.orderByRef(reference)
  if (!order) return null
  const pickup = stop(str(p.byId("addresses", String(order.pickup_address_id))?.city))
  const delivery = stop(str(p.byId("addresses", String(order.delivery_address_id))?.city))
  if (!pickup || !delivery) return null
  const window = (purpose: string) => p.forOrder(order.id, "time_windows").find((w) => w.purpose === purpose)
  const pickupEnd = str(window("SELECTED_PICKUP_SLOT")?.end_at)
  const promise = window("CUSTOMER_DELIVERY_PROMISE")

  const options = p.forOrder(order.id, "travel_options").filter((o) => o.kind === "FERRY")
  const booked = p.forOrder(order.id, "travel_reservations").find((r) => r.kind === "FERRY" && r.status === "BOOKED")
  const quote = options.filter((o) => o.status === "AVAILABLE_QUOTE").sort((a, b) => String(a.departure_at).localeCompare(String(b.departure_at)))[0]
  const ferry: Rec | undefined = booked ?? quote
  const alternatives = options.filter((o) => o.status === "SOLD_OUT")
    .map((o) => ({ label: `${o.provider} ${String(o.from_city)} → ${String(o.to_city)}`, status: "sold_out" as const, departAt: String(o.departure_at) }))

  const legs: Leg[] = []
  if (ferry) {
    const fromT = stop(str(ferry.origin_terminal) ?? str(ferry.from_city))
    const toT = stop(str(ferry.destination_terminal) ?? str(ferry.to_city))
    if (fromT && toT) {
      const roadHours = typeof ferry.road_time_to_terminal_hours === "number" ? ferry.road_time_to_terminal_hours : null
      const first = roadHours !== null
        ? { mode: "drive" as const, from: pickup, to: fromT, departAt: pickupEnd, minutes: roadHours * 60,
            arriveAt: pickupEnd ? new Date(Date.parse(pickupEnd) + roadHours * 60 * MINUTE).toISOString() : null,
            basis: "quote" as const, status: "estimated" as const, priceCents: null, synthetic: false }
        : estimatedDrive(pickup, fromT, pickupEnd)
      const arrive = str(ferry.expected_arrival_at) ?? str(ferry.arrival_at)
      legs.push(first, {
        mode: "ferry", from: fromT, to: toT, departAt: str(ferry.departure_at), arriveAt: arrive,
        minutes: arrive && ferry.departure_at ? Math.round((Date.parse(arrive) - Date.parse(String(ferry.departure_at))) / MINUTE) : null,
        basis: booked ? "booked" : "quote", status: booked ? "booked" : "quoted",
        priceCents: typeof ferry.quote_cents === "number" ? ferry.quote_cents : typeof ferry.fare_cents === "number" ? ferry.fare_cents : null,
        synthetic: false,
      }, estimatedDrive(toT, delivery, arrive))
    }
  }
  if (!legs.length) legs.push(estimatedDrive(pickup, delivery, pickupEnd))

  const last = legs.at(-1)!
  const arrival = last.arriveAt ? {
    earliest: last.arriveAt,
    latest: new Date(Date.parse(last.arriveAt) + 120 * MINUTE).toISOString(),
    basis: legs.map((l) => `${l.mode} ${l.basis === "estimate" ? "estimated" : l.basis === "booked" ? "booked" : "from the quote"}`).join(", "),
  } : null

  const latest = p.forOrder(order.id, "tracking_observations").filter((o) => o.estimated_delivery_at && String(o.received_at) <= now().toISOString())
    .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))[0]
  return {
    order: reference, legs, alternatives, arrival,
    driverEta: latest ? { at: String(latest.estimated_delivery_at), receivedAt: String(latest.received_at) } : null,
    note: promise ? "Indicative routes. Terminals are fictional and approximate." : "Indicative routes.",
  }
}
