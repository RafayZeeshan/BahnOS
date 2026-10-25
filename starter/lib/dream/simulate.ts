// Simulation (ADR-010, ADR-011): stress a real order with a known failure type on an in-memory overlay.
// Results are labelled and never written back, so the packet still has no invented orders.
import { evaluate, type Evaluation } from "@/lib/engine/evaluate"
import { packet, type Packet, type Rec } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"

export type PerturbationId = "ferry_sold_out" | "eta_slips_2h" | "quote_goes_stale" | "site_not_ready" | "warning_light"
type Overlay = (order: Rec, t: string, policy: Policy, base: Packet) => Record<string, Rec[]>

const HOUR = 3_600_000
const shift = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * HOUR).toISOString()

export const PERTURBATIONS: { id: PerturbationId; label: string; overlay: Overlay }[] = [
  {
    id: "ferry_sold_out", label: "the crossing sold out",
    overlay: (order, t, _policy, base) => {
      const ferry = [...base.forOrder(order.id, "travel_reservations"), ...base.forOrder(order.id, "travel_options")].find((r) => r.kind === "FERRY")
      const departs = ferry ? String(ferry.departure_at) : shift(t, 30)
      return {
        travel_reservations: base.forOrder(order.id, "travel_reservations").filter((r) => r.kind !== "FERRY"),
        travel_options: [...base.forOrder(order.id, "travel_options"), {
          id: "sim-sold-out", order_id: order.id, kind: "FERRY", status: "SOLD_OUT", checked_at: shift(t, -1), departure_at: departs > t ? departs : shift(t, 30),
        }],
      }
    },
  },
  {
    id: "eta_slips_2h", label: "the ETA slipping two hours past the promise",
    overlay: (order, t, _policy, base): Record<string, Rec[]> => {
      const promise = base.forOrder(order.id, "time_windows").find((w) => w.purpose === "CUSTOMER_DELIVERY_PROMISE")
      if (!promise) return {}
      return {
        tracking_observations: [...base.forOrder(order.id, "tracking_observations"), {
          id: "sim-eta", order_id: order.id, received_at: shift(t, -0.2), observed_at: shift(t, -0.3), estimated_delivery_at: shift(String(promise.end_at), 2),
        }],
      }
    },
  },
  {
    id: "quote_goes_stale", label: "every travel quote gone stale and nothing booked",
    overlay: (order, t, policy, base) => ({
      travel_reservations: [],
      travel_options: base.forOrder(order.id, "travel_options").map((o) => ({ ...o, status: "AVAILABLE_QUOTE", checked_at: shift(t, -(policy.watch.quote_max_age_hours + 6)), departure_at: shift(t, 30) })),
    }),
  },
  {
    id: "site_not_ready", label: "the pickup site reporting the car not ready",
    overlay: (order, t, _policy, base) => ({
      alerts: [...base.forOrder(order.id, "alerts"), { id: "sim-site", order_id: order.id, signal: "SITE_ACCESS_UNCONFIRMED", status: "OPEN", triggered_at: shift(t, -1) }],
    }),
  },
  {
    id: "warning_light", label: "a red warning light and a safety stop",
    overlay: (order, t, _policy, base) => ({
      alerts: [...base.forOrder(order.id, "alerts"), { id: "sim-warning", order_id: order.id, signal: "SAFETY_STOP", status: "OPEN", triggered_at: shift(t, -1) }],
    }),
  },
]

function overlayPacket(base: Packet, orderId: string, changes: Record<string, Rec[]>): Packet {
  return {
    all: base.all,
    byId: base.byId,
    orderByRef: base.orderByRef,
    forOrder: (id, collection) => (id === orderId && changes[collection] ? changes[collection] : base.forOrder(id, collection)),
  }
}

export type Simulation = { simulated: true; label: string; order: string; perturbation: PerturbationId; before: Evaluation; after: Evaluation; caught: boolean }

export function simulate(policy: Policy, reference: string, perturbation: PerturbationId, t: string, base: Packet = packet()): Simulation {
  const order = base.orderByRef(reference)
  if (!order) throw new Error(`No order ${reference}`)
  const p = PERTURBATIONS.find((x) => x.id === perturbation)!
  const before = evaluate(policy, reference, t, base)
  const after = evaluate(policy, reference, t, overlayPacket(base, order.id, p.overlay(order, t, policy, base)))
  const caught = after.signals.length > before.signals.length || (after.level !== "fine" && before.level === "fine")
  return { simulated: true, label: `Simulated: ${reference} with ${p.label}. Not a real order.`, order: reference, perturbation, before, after, caught }
}

// Active orders that are quiet at t, so a flag can only come from the stress.
export function stressTest(policy: Policy, t: string, sampleSize = 8, base: Packet = packet()) {
  const sample = base.all("orders").map((o) => String(o.reference))
    .filter((ref) => { const e = evaluate(policy, ref, t, base); return e.active && e.level === "fine" })
    .sort().slice(0, sampleSize)
  return PERTURBATIONS.map((p) => {
    const results = sample.map((ref) => simulate(policy, ref, p.id, t, base))
    const k = results.filter((r) => r.caught).length
    return {
      perturbation: p.id, label: p.label, k, n: results.length,
      sentence: `Watch caught ${p.label} on ${k} of ${results.length} sample orders.`,
      examples: results.filter((r) => r.caught).map((r) => r.order),
    }
  })
}
