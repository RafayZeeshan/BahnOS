// The learning loop (ADR-011, after Harness²): probe the incumbent, propose changes for its misses,
// probe each on held-out replay, keep only what beats the incumbent by a margin, stop when nothing does.
// The model never changes; only the policy around it. A person adopts every version.
import { packet } from "@/lib/packet"
import type { Policy } from "@/lib/policy/defaults"
import { exposureFor } from "@/lib/risk/rates"
import { replay, type ReplayMetrics, type ReplayResult } from "./replay"

export type Diff = { path: string; from: unknown; to: unknown }
export type Candidate = { diff: Diff[]; policy: Policy; lesson: string }
export type Scored = Candidate & { metrics: ReplayMetrics; pair: { caught: string | null; similarClean: string | null; shared: string | null } }
export type Round = { round: number; fromVersion: number; incumbent: ReplayMetrics; misses: string[]; candidates: Scored[]; kept: Scored | null }
export type LearnResult = {
  proposer: "rules" | "model"
  margin: number
  rounds: Round[]
  versions: { policy: Policy; status: "CANDIDATE"; metrics: ReplayMetrics; lesson: string; diff: Diff[] }[]
}
export type Proposer = (incumbent: Policy, probe: ReplayResult) => Candidate[]

const MARGIN = 0.05
const MAX_ROUNDS = 3

/** Held-out hit rate minus false-alarm rate: catching more only counts if it does not cry wolf as much. */
export function score(m: ReplayMetrics): number {
  return (m.hits.n ? m.hits.k / m.hits.n : 0) - (m.falseAlarms.n ? m.falseAlarms.k / m.falseAlarms.n : 0)
}

function change(policy: Policy, version: number, edit: (p: Policy) => void): Policy {
  const next = structuredClone(policy)
  edit(next)
  next.version = version
  return next
}

/** Rule-written candidates, used when the model proposer is not run (BUILD-PLAN cut list, item 5). */
export const ruleProposer: Proposer = (incumbent) => {
  const v = incumbent.version + 1
  const out: Candidate[] = []
  if (!incumbent.risk.watch_on_elevated) {
    for (const rate of [0.3, 0.25, 0.2]) {
      out.push({
        diff: [{ path: "risk.watch_on_elevated", from: false, to: true }, { path: "risk.elevated_rate", from: incumbent.risk.elevated_rate, to: rate }],
        policy: change(incumbent, v, (p) => { p.risk.watch_on_elevated = true; p.risk.elevated_rate = rate }),
        lesson: `Look at an order before anything goes wrong when it rides on a route, mode, make or dealership where at least ${Math.round(rate * 100)} in 100 past orders had a problem, after allowing for small samples.`,
      })
    }
  } else {
    for (const delta of [-0.05, 0.05]) {
      const rate = Math.round((incumbent.risk.elevated_rate + delta) * 100) / 100
      out.push({
        diff: [{ path: "risk.elevated_rate", from: incumbent.risk.elevated_rate, to: rate }],
        policy: change(incumbent, v, (p) => { p.risk.elevated_rate = rate }),
        lesson: `${delta < 0 ? "Lower" : "Raise"} the bar for a risky source to ${Math.round(rate * 100)} in 100.`,
      })
    }
    out.push({
      diff: [{ path: "risk.min_sample", from: incumbent.risk.min_sample, to: incumbent.risk.min_sample + 1 }],
      policy: change(incumbent, v, (p) => { p.risk.min_sample += 1 }),
      lesson: "Need one more past order before a source's record counts.",
    })
  }
  const slack = incumbent.watch.slack_min_minutes + 120
  out.push({
    diff: [{ path: "watch.slack_min_minutes", from: incumbent.watch.slack_min_minutes, to: slack }],
    policy: change(incumbent, v, (p) => { p.watch.slack_min_minutes = slack }),
    lesson: `Start watching a ferry check-in ${slack / 60} hours before it closes, not ${incumbent.watch.slack_min_minutes / 60}.`,
  })
  out.push({
    diff: [{ path: "watch.quote_max_age_hours", from: incumbent.watch.quote_max_age_hours, to: 12 }],
    policy: change(incumbent, v, (p) => { p.watch.quote_max_age_hours = 12 }),
    lesson: "Treat a travel quote as stale after 12 hours.",
  })
  return out
}

// A missed case the candidate now catches, and an order on the same source that had no problem and was not flagged.
function contrastivePair(before: ReplayResult, after: ReplayResult): Scored["pair"] {
  const caught = after.cases.find((c) => c.leadHours !== null && before.cases.find((b) => b.order === c.order)?.leadHours === null)?.order ?? null
  if (!caught) return { caught: null, similarClean: null, shared: null }
  const e = exposureFor(caught)
  const flagged = new Set(after.falseAlarmOrders)
  const mishap = new Set(after.cases.map((c) => c.order))
  const shares = (ref: string): string | null => {
    const other = exposureFor(ref)
    if (!e || !other) return null
    if (other.route === e.route) return `the ${e.route} route`
    if (e.make && other.make === e.make) return `a ${e.make}`
    return null
  }
  const similarClean = packet().all("orders").map((o) => String(o.reference))
    .find((ref) => !mishap.has(ref) && !flagged.has(ref) && ref !== caught && shares(ref) !== null) ?? null
  return { caught, similarClean, shared: similarClean ? shares(similarClean) : null }
}

export function learn(start: Policy, proposer: Proposer = ruleProposer, proposerKind: LearnResult["proposer"] = "rules"): LearnResult {
  const rounds: Round[] = []
  const versions: LearnResult["versions"] = []
  let incumbent = start
  let probe = replay(incumbent)
  let flat = 0

  for (let round = 1; round <= MAX_ROUNDS && flat < 2; round++) {
    const candidates: Scored[] = proposer(incumbent, probe).map((c) => {
      const result = replay(c.policy)
      return { ...c, metrics: result.metrics, pair: contrastivePair(probe, result), _result: result } as Scored & { _result: ReplayResult }
    })
    const best = [...candidates].sort((a, b) => score(b.metrics) - score(a.metrics))[0]
    const kept = best && score(best.metrics) >= score(probe.metrics) + MARGIN ? best : null
    rounds.push({
      round, fromVersion: incumbent.version, incumbent: probe.metrics,
      misses: probe.cases.filter((c) => c.leadHours === null).map((c) => c.order),
      candidates: candidates.map(({ _result, ...rest }: Scored & { _result?: ReplayResult }) => rest),
      kept: kept ? (({ _result, ...rest }: Scored & { _result?: ReplayResult }) => rest)(kept) : null,
    })
    if (kept) {
      // The lesson travels with the version, linked to the cases behind it.
      kept.policy.lessons = [...kept.policy.lessons, {
        text: kept.lesson, caseRefs: [kept.pair.caught, kept.pair.similarClean].filter((r): r is string => !!r), shared: kept.pair.shared,
      }]
      incumbent = kept.policy
      probe = (kept as Scored & { _result: ReplayResult })._result
      versions.push({ policy: incumbent, status: "CANDIDATE", metrics: kept.metrics, lesson: kept.lesson, diff: kept.diff })
      flat = 0
    } else {
      flat += 1
    }
  }
  return { proposer: proposerKind, margin: MARGIN, rounds, versions }
}
