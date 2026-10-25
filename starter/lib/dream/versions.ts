// A person adopts, rejects or rolls back a policy version (ADR-011). A worse-scoring version needs an override reason.
import { score } from "./learn"
import type { ReplayMetrics } from "./replay"

// `status` is the target version's current status; the rules depend on it.
type Op =
  | { op: "adopt"; candidate: ReplayMetrics; adopted: ReplayMetrics; status: string; override?: string }
  | { op: "reject"; candidate: ReplayMetrics; adopted: ReplayMetrics; status: string; reason?: string }
  | { op: "rollback"; candidate: ReplayMetrics; adopted: ReplayMetrics; status: string }

export type VersionOutcome = { ok: true; status: "ADOPTED" | "REJECTED" | "ROLLED_BACK"; override?: true } | { ok: false; error: string }

export function decideVersion(input: Op): VersionOutcome {
  if (input.op === "rollback") {
    return input.status === "RETIRED" || input.status === "ROLLED_BACK"
      ? { ok: true, status: "ROLLED_BACK" }
      : { ok: false, error: "You can only go back to a version that was in use before." }
  }
  if (input.status !== "CANDIDATE") return { ok: false, error: "Only a version waiting for a decision can be adopted or set aside." }
  if (input.op === "reject") {
    return input.reason?.trim() ? { ok: true, status: "REJECTED" } : { ok: false, error: "Say why, so the next round can learn from it." }
  }
  if (score(input.candidate) >= score(input.adopted)) return { ok: true, status: "ADOPTED" }
  if (!input.override?.trim()) return { ok: false, error: "This version scores worse than the one in use. Give a reason to adopt it anyway." }
  return { ok: true, status: "ADOPTED", override: true }
}

export type Maturity = "learning" | "emerging" | "reliable"
export const MIN_CASES = 5

/** Per failure type: Learning until enough cases and a held-out gain; Reliable once the gain held for two rounds without regressing. */
export function maturity(input: { cases: number; gain: number; regressed: boolean; rounds: number }): Maturity {
  if (input.cases < MIN_CASES || input.gain <= 0) return "learning"
  if (input.rounds >= 2 && !input.regressed) return "reliable"
  return "emerging"
}
