// What the agent learned, for the screen: every version with the same held-out metrics, lessons linked to cases,
// and maturity per failure type. Replay results are cached per policy version.
import type { Policy } from "@/lib/policy/defaults"
import type { Cause } from "@/lib/risk/attribute"
import { attributeMishaps } from "@/lib/risk/attribute"
import { replay, type ReplayResult } from "./replay"
import { maturity, MIN_CASES, type Maturity } from "./versions"

export type VersionRow = {
  version: number; status: string; params: Policy; parentVersion: number | null
  adoptedAt: string | null; adoptedBy: string | null; overrideReason: string | null
}

const PATHS = ["risk.watch_on_elevated", "risk.elevated_rate", "risk.min_sample", "watch.slack_min_minutes", "watch.likely_slip_slack_minutes", "watch.quote_max_age_hours"]
const get = (policy: Policy, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], policy)

export function describeChange(d: { path: string; from: unknown; to: unknown }): string {
  const pct = (v: unknown) => Math.round(Number(v) * 100)
  const hours = (v: unknown) => `${Number(v) / 60} h`
  switch (d.path) {
    case "risk.watch_on_elevated":
      return d.to ? "Also watch orders that ride on a route, mode, make or dealership with a poor record." : "Stop watching orders just for the record of their route, mode, make or dealership."
    case "risk.elevated_rate": return `Call a source risky from ${pct(d.to)} in 100 past orders (was ${pct(d.from)}).`
    case "risk.min_sample": return `Need ${d.to} past orders before a source's record counts (was ${d.from}).`
    case "watch.slack_min_minutes": return `Start watching a ferry check-in ${hours(d.to)} before it closes (was ${hours(d.from)}).`
    case "watch.likely_slip_slack_minutes": return `Call a check-in likely to slip ${hours(d.to)} before it closes (was ${hours(d.from)}).`
    case "watch.quote_max_age_hours": return `Treat a travel quote as stale after ${d.to} h (was ${d.from} h).`
    default: return `${d.path}: ${String(d.from)} → ${String(d.to)}`
  }
}

const cache = new Map<string, ReplayResult>()
function replayOf(policy: Policy): ReplayResult {
  const key = JSON.stringify({ ...policy, lessons: [] })
  if (!cache.has(key)) cache.set(key, replay(policy))
  return cache.get(key)!
}

const CAUSE_WORD: Record<Cause, string> = {
  mode: "Ferry and travel", route: "Route and positioning", vehicle: "The car itself", dealership: "Pickup site", unclear: "Unclear cause",
}

export function learnedReport(rows: VersionRow[]) {
  const ordered = [...rows].sort((a, b) => a.version - b.version)
  const versions = ordered.map((row) => {
    const result = replayOf(row.params)
    const parent = ordered.find((r) => r.version === row.parentVersion)
    const changes = parent ? PATHS.filter((path) => get(row.params, path) !== get(parent.params, path))
      .map((path) => describeChange({ path, from: get(parent.params, path), to: get(row.params, path) })) : []
    return {
      ...row,
      changes,
      metrics: result.metrics,
      lessons: row.params.lessons.filter((l) => !parent?.params.lessons.some((p) => p.text === l.text)),
      caughtAhead: result.cases.filter((c) => c.leadHours !== null).map((c) => ({ order: c.order, hours: c.leadHours! })),
      falseAlarmOrders: result.falseAlarmOrders,
    }
  })

  // Maturity per failure type, by the cause of each order's first mishap.
  const firstCause = new Map<string, Cause>()
  for (const m of attributeMishaps()) if (!firstCause.has(m.order)) firstCause.set(m.order, m.cause)
  const causes: Cause[] = ["mode", "route", "vehicle", "dealership", "unclear"]
  const types = causes.map((cause) => {
    const orders = [...firstCause.entries()].filter(([, c]) => c === cause).map(([o]) => o)
    const hitsByVersion = versions.map((v) => v.caughtAhead.filter((c) => orders.includes(c.order)).length)
    const gain = (hitsByVersion.at(-1) ?? 0) - (hitsByVersion[0] ?? 0)
    const regressed = hitsByVersion.some((h, i) => i > 0 && h < hitsByVersion[i - 1])
    const held = hitsByVersion.filter((h, i) => i > 0 && h > hitsByVersion[0]).length
    const label: Maturity = maturity({ cases: orders.length, gain, regressed, rounds: held })
    return { cause, label: CAUSE_WORD[cause], cases: orders.length, hitsByVersion, maturity: label, minCases: MIN_CASES }
  })
  return { versions, types }
}
