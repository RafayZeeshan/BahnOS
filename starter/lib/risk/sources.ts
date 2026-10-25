// Sources of failure (ADR-009): routes, modes, car makes and dealerships, each with an honest k of n,
// a rate shrunk toward the overall rate, and the upcoming orders that depend on it. Drivers are never ranked.
import { evaluate, exposureOf } from "@/lib/engine/evaluate"
import { packet, type Packet } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"
import { attributeMishaps, type Cause } from "./attribute"

export type SourceKind = "route" | "mode" | "make" | "dealership"
export type Maturity = "too_few" | "small_sample" | "enough"

export type FailureSource = {
  kind: SourceKind
  key: string
  label: string
  k: number
  n: number
  rate: number
  base: number
  shrunk: number
  elevated: boolean
  maturity: Maturity
  sentence: string
  upcoming: { orders: number; drivers: number; refs: string[] }
  examples: string[]
  dashboard: boolean
}

// Which causes count against each kind of source: a make only answers for the car, a route for the road and the crossing.
const COUNTS: Record<SourceKind, Cause[]> = { route: ["route", "mode"], mode: ["mode"], make: ["vehicle"], dealership: ["dealership"] }
const NOUN: Record<SourceKind, string> = { route: "route", mode: "mode", make: "make", dealership: "dealership" }
const SMALL_SAMPLE = 10

function label(kind: SourceKind, key: string): string {
  if (kind === "route") return `${key} route`
  if (kind === "mode") return `${key[0].toUpperCase()}${key.slice(1)} legs`
  return key
}

function sentence(kind: SourceKind, k: number, n: number, maturity: Maturity): string {
  const subject = kind === "route" ? "orders on this route" : kind === "mode" ? "orders using this mode" : kind === "make" ? "cars of this make" : "orders from this dealership"
  if (maturity === "too_few") return `${k} of ${n} ${subject} had a problem; too few to say.`
  return `${k} of ${n} ${subject} had a problem${maturity === "small_sample" ? " (small sample)" : ""}.`
}

export function failureSources(policy: Policy, t: string, p: Packet = packet()): FailureSource[] {
  const mishaps = attributeMishaps(p)
  const orders = p.all("orders")
  const exposures = new Map(orders.map((o) => [String(o.reference), exposureOf(p, o)]))
  const keysOf = (kind: SourceKind, ref: string): string[] => {
    const e = exposures.get(ref)!
    if (kind === "route") return [e.route]
    if (kind === "mode") return e.modes.filter((m) => m !== "road")
    if (kind === "make") return e.make ? [e.make] : []
    return e.dealership ? [e.dealership] : []
  }
  const upcoming = orders.filter((o) => evaluate(policy, String(o.reference), t, p).active)
  const driverOf = (orderId: string) => p.forOrder(orderId, "work_assignments").find((a) => !a.cancelled_at)?.driver_id

  const out: FailureSource[] = []
  for (const kind of ["route", "mode", "make", "dealership"] as SourceKind[]) {
    const counted = mishaps.filter((m) => COUNTS[kind].includes(m.cause))
    const hit = new Set(counted.map((m) => m.order))
    const hitFor = (key: string, ref: string) => kind === "mode" ? counted.some((m) => m.order === ref && m.mode === key) : hit.has(ref)
    const groups = new Map<string, string[]>()
    for (const o of orders) for (const key of keysOf(kind, String(o.reference))) groups.set(key, [...(groups.get(key) ?? []), String(o.reference)])
    const totalN = [...groups.values()].reduce((sum, refs) => sum + refs.length, 0)
    const totalK = [...groups.entries()].reduce((sum, [key, refs]) => sum + refs.filter((r) => hitFor(key, r)).length, 0)
    const base = totalN ? totalK / totalN : 0
    const s = policy.risk.shrinkage_strength

    for (const [key, refs] of groups) {
      const n = refs.length
      const k = refs.filter((r) => hitFor(key, r)).length
      const shrunk = (k + s * base) / (n + s)
      const maturity: Maturity = n < policy.risk.min_sample ? "too_few" : n < SMALL_SAMPLE ? "small_sample" : "enough"
      const exposed = upcoming.filter((o) => keysOf(kind, String(o.reference)).includes(key))
      out.push({
        kind, key, label: label(kind, key), k, n, rate: n ? k / n : 0, base, shrunk,
        elevated: maturity !== "too_few" && shrunk >= policy.risk.elevated_rate,
        maturity,
        sentence: sentence(kind, k, n, maturity),
        upcoming: {
          orders: exposed.length,
          drivers: new Set(exposed.map((o) => driverOf(o.id)).filter(Boolean)).size,
          refs: exposed.map((o) => String(o.reference)),
        },
        examples: refs.filter((r) => hitFor(key, r)),
        dashboard: maturity !== "too_few" && k > 0,
      })
    }
  }
  return out.sort((a, b) => Number(b.dashboard) - Number(a.dashboard) || b.shrunk - a.shrunk || a.label.localeCompare(b.label))
}

export { NOUN as SOURCE_NOUN }
