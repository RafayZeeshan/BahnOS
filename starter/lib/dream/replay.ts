// Replay (ADR-011): run a policy at checkpoints before each past mishap and ask whether, and how early,
// it would have flagged it. Scored leave one order out: an order never counts toward its own source's record.
import { evaluate } from "@/lib/engine/evaluate"
import { SNAPSHOT_AT } from "@/lib/clock"
import { packet, type Packet } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"
import { attributeMishaps } from "@/lib/risk/attribute"
import { sourceRates } from "@/lib/risk/rates"

const HOUR = 3_600_000
export const CHECKPOINTS = [24, 6, 1]

export type CaseReplay = {
  order: string
  mishapAt: string
  signal: string
  checkpoints: { hoursBefore: number; t: string; level: string }[]
  leadHours: number | null
}

export type ReplayMetrics = {
  hits: { k: number; n: number }
  falseAlarms: { k: number; n: number }
  medianLeadHours: number | null
  label: string
}

export type ReplayResult = { policyVersion: number; checkpoints: number[]; cases: CaseReplay[]; metrics: ReplayMetrics; falseAlarmOrders: string[] }

const minus = (iso: string, hours: number) => new Date(Date.parse(iso) - hours * HOUR).toISOString()

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function levelAt(policy: Policy, order: string, t: string, p: Packet): string {
  const rates = policy.risk.watch_on_elevated ? sourceRates(policy, { exclude: order, asOf: t }, p) : undefined
  return evaluate(policy, order, t, p, { rates }).level
}

export function replay(policy: Policy, p: Packet = packet()): ReplayResult {
  const firstMishap = new Map<string, { at: string; signal: string }>()
  for (const m of attributeMishaps(p)) {
    const seen = firstMishap.get(m.order)
    if (m.at && (!seen || m.at < seen.at)) firstMishap.set(m.order, { at: m.at, signal: m.signal })
  }

  const cases: CaseReplay[] = [...firstMishap.entries()].sort().map(([order, first]) => {
    const checkpoints = CHECKPOINTS.map((h) => {
      const t = minus(first.at, h)
      return { hoursBefore: h, t, level: levelAt(policy, order, t, p) }
    })
    const flagged = checkpoints.filter((c) => c.level !== "fine").map((c) => c.hoursBefore)
    return { order, mishapAt: first.at, signal: first.signal, checkpoints, leadHours: flagged.length ? Math.max(...flagged) : null }
  })

  // Orders without a mishap: any flag in the day before their pickup slot is a false alarm.
  const falseAlarmOrders: string[] = []
  let clean = 0
  for (const order of p.all("orders")) {
    const reference = String(order.reference)
    if (firstMishap.has(reference)) continue
    const slot = p.forOrder(order.id, "time_windows").find((w) => w.purpose === "SELECTED_PICKUP_SLOT")
    const anchor = slot ? String(slot.start_at) : null
    if (!anchor) continue
    const times = CHECKPOINTS.map((h) => minus(anchor, h)).filter((t) => t <= SNAPSHOT_AT && t >= String(order.created_at))
    if (!times.length) continue
    clean += 1
    if (times.some((t) => levelAt(policy, reference, t, p) !== "fine")) falseAlarmOrders.push(reference)
  }

  const hits = cases.filter((c) => c.leadHours !== null)
  return {
    policyVersion: policy.version,
    checkpoints: CHECKPOINTS,
    cases,
    metrics: {
      hits: { k: hits.length, n: cases.length },
      falseAlarms: { k: falseAlarmOrders.length, n: clean },
      medianLeadHours: median(hits.map((c) => c.leadHours!)),
      label: "held-out (leave one order out, as of each checkpoint)",
    },
    falseAlarmOrders,
  }
}
