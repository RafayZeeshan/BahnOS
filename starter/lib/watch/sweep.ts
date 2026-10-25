// Watch (ADR-008): the rules-only sweep over every active order. Only flagged orders get a card;
// a model-written line replaces the template when a recorded run has one.
import { evaluate, type Level, type RateLookup, type Signal } from "@/lib/engine/evaluate"
import { packet } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"
import { evidenceFor } from "@/lib/present/evidence"

export type HeadsUpCard = {
  order: string
  car: string
  route: string
  level: Exclude<Level, "fine">
  line: string
  lineSource: "template" | "model"
  bullets: string[]
  claims: { text: string; label: string; at: string }[]
  slack: { minutes: number; of: number; label: string } | null
  signals: Signal[]
  // The cheap next step the model picked with its line (ADR-008); set by the Watch route, not the sweep.
  nextStep?: string | null
}

// Signals where the driver's own latest words help a person judge the risk.
const DRIVER_CONTEXT = new Set(["cutoff", "positioning", "open_question", "missed_milestone"])

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return h ? `${h} h ${minutes % 60} m` : `${minutes} m`
}

export function sweep(policy: Policy, t: string, modelLines: Record<string, string> = {}, rates?: RateLookup): HeadsUpCard[] {
  const p = packet()
  const cards: HeadsUpCard[] = []
  for (const order of p.all("orders")) {
    const reference = String(order.reference)
    const result = evaluate(policy, reference, t, p, { rates })
    if (result.level === "fine") continue

    const item = p.forOrder(order.id, "order_items").find((i) => i.role === "PRIMARY")
    const vehicle = item ? p.byId("vehicles", String(item.vehicle_id)) : undefined
    const city = (id: unknown) => String(p.byId("addresses", String(id))?.city ?? "?")
    const cutoff = result.signals.find((s) => s.kind === "cutoff")
    const driverSaid = result.signals.some((s) => DRIVER_CONTEXT.has(s.kind))
      ? p.forOrder(order.id, "messages").filter((m) => m.author_type === "driver" && String(m.authored_at) <= t)
        .sort((a, b) => String(b.authored_at).localeCompare(String(a.authored_at))).slice(0, 1)
      : []

    cards.push({
      order: reference,
      car: vehicle ? `${vehicle.make} ${vehicle.model}` : "Car not recorded",
      route: `${city(order.pickup_address_id)} → ${city(order.delivery_address_id)}`,
      level: result.level,
      line: modelLines[reference] ?? result.signals.map((s) => s.text).join(" "),
      lineSource: modelLines[reference] ? "model" : "template",
      bullets: result.signals.map((s) => s.text),
      claims: driverSaid.map((m) => {
        const e = evidenceFor({ kind: "message", authorType: "driver", at: String(m.authored_at) })
        return { text: String(m.body), label: e.label, at: e.at }
      }),
      slack: cutoff?.minutes !== undefined
        ? { minutes: cutoff.minutes, of: policy.watch.slack_min_minutes, label: `${duration(cutoff.minutes)} to check-in` }
        : null,
      signals: result.signals,
    })
  }
  const rank = (l: Level) => (l === "likely_to_slip" ? 0 : 1)
  return cards.sort((a, b) => rank(a.level) - rank(b.level) || (a.slack?.minutes ?? 1e9) - (b.slack?.minutes ?? 1e9) || a.order.localeCompare(b.order))
}
