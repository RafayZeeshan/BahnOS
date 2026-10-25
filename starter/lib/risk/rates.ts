// k of n per source of failure, shrunk toward the overall rate (ADR-009). `exclude` holds one order out,
// so replay can score that order against the record the other 99 built (ADR-011).
import { exposureOf, type Exposure } from "@/lib/engine/evaluate"
import { packet, type Packet } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"
import { attributeMishaps, type Cause, type Mishap } from "./attribute"

export type SourceKind = "route" | "mode" | "make" | "dealership"
export type Rate = { kind: SourceKind; key: string; k: number; n: number; rate: number; base: number; shrunk: number; refs: string[]; hits: string[] }

export const SOURCE_KINDS: SourceKind[] = ["route", "mode", "make", "dealership"]
// Which causes count against each kind of source: a make only answers for the car, a route for the road and the crossing.
const COUNTS: Record<SourceKind, Cause[]> = { route: ["route", "mode"], mode: ["mode"], make: ["vehicle"], dealership: ["dealership"] }

export function keysOf(kind: SourceKind, e: Exposure): string[] {
  if (kind === "route") return [e.route]
  if (kind === "mode") return e.modes.filter((m) => m !== "road")
  if (kind === "make") return e.make ? [e.make] : []
  return e.dealership ? [e.dealership] : []
}

const memo = new WeakMap<Packet, { mishaps: Mishap[]; exposures: Map<string, Exposure> }>()
function base(p: Packet) {
  let hit = memo.get(p)
  if (!hit) {
    hit = { mishaps: attributeMishaps(p), exposures: new Map(p.all("orders").map((o) => [String(o.reference), exposureOf(p, o)])) }
    memo.set(p, hit)
  }
  return hit
}

export function exposureFor(reference: string, p: Packet = packet()): Exposure | undefined {
  return base(p).exposures.get(reference)
}

// Exposures as known at a time, cached per time: replay asks for the same checkpoint for many orders.
const asOfMemo = new WeakMap<Packet, Map<string, Map<string, Exposure>>>()
function exposuresAsOf(p: Packet, t: string): Map<string, Exposure> {
  const byTime = asOfMemo.get(p) ?? new Map<string, Map<string, Exposure>>()
  asOfMemo.set(p, byTime)
  let hit = byTime.get(t)
  if (!hit) {
    hit = new Map(p.all("orders").filter((o) => String(o.created_at) <= t).map((o) => [String(o.reference), exposureOf(p, o, t)]))
    byTime.set(t, hit)
  }
  return hit
}

/**
 * `exclude` holds one order out; `asOf` counts only orders created and problems recorded by then,
 * so replay at a past checkpoint never scores with what happened afterwards.
 */
export function sourceRates(policy: Policy, options: { exclude?: string; asOf?: string } = {}, p: Packet = packet()): Map<string, Rate> {
  const all = base(p)
  const exposures = options.asOf ? exposuresAsOf(p, options.asOf) : all.exposures
  const mishaps = options.asOf ? all.mishaps.filter((m) => m.at && m.at <= options.asOf!) : all.mishaps
  const refs = [...exposures.keys()].filter((r) => r !== options.exclude)
  const out = new Map<string, Rate>()
  for (const kind of SOURCE_KINDS) {
    const counted = mishaps.filter((m) => COUNTS[kind].includes(m.cause))
    const hitFor = (key: string, ref: string) =>
      kind === "mode" ? counted.some((m) => m.order === ref && m.mode === key) : counted.some((m) => m.order === ref)
    const groups = new Map<string, string[]>()
    for (const ref of refs) for (const key of keysOf(kind, exposures.get(ref)!)) groups.set(key, [...(groups.get(key) ?? []), ref])
    let totalK = 0
    let totalN = 0
    const hits = new Map<string, string[]>()
    for (const [key, members] of groups) {
      const h = members.filter((r) => hitFor(key, r))
      hits.set(key, h)
      totalK += h.length
      totalN += members.length
    }
    const baseRate = totalN ? totalK / totalN : 0
    const s = policy.risk.shrinkage_strength
    for (const [key, members] of groups) {
      const k = hits.get(key)!.length
      const n = members.length
      out.set(`${kind}|${key}`, { kind, key, k, n, rate: n ? k / n : 0, base: baseRate, shrunk: (k + s * baseRate) / (n + s), refs: members, hits: hits.get(key)! })
    }
  }
  return out
}
