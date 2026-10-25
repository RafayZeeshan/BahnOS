import { now } from "../lib/clock"
import { buildCasebook } from "../lib/dream/casebook"
import { replay } from "../lib/dream/replay"
import { attributeMishaps } from "../lib/risk/attribute"
import { failureSources } from "../lib/risk/sources"
import type { Policy } from "../lib/policy/defaults"

export function policyRow(policy: Policy) {
  return {
    version: policy.version,
    params: policy as unknown as Record<string, unknown>,
    status: "ADOPTED",
    parentVersion: null,
    createdAt: now(),
    adoptedAt: now(),
    adoptedBy: "seed",
    overrideReason: null,
  }
}

export function casebookRows() {
  return buildCasebook().map((c) => ({
    orderRef: c.order, mishaps: c.mishaps as unknown as Record<string, unknown>[], fixes: c.fixes as unknown as Record<string, unknown>[],
    outcome: c.outcome, blockers: c.blockers.map((text) => ({ text })), updatedAt: now(),
  }))
}

export function mishapRows() {
  return attributeMishaps().map((m, i) => ({
    id: `mishap-${m.order}-${i}`, orderRef: m.order, cause: m.cause, signal: m.signal,
    evidence: [m.evidence as unknown as Record<string, unknown>], attributedBy: m.attributedBy, occurredAt: new Date(m.at || now().toISOString()),
  }))
}

export function sourceRows(policy: Policy) {
  return failureSources(policy, now().toISOString()).map((s) => ({
    id: `src-${s.kind}-${s.key}`, kind: s.kind, key: s.key, label: s.label, k: s.k, n: s.n, shrunkRate: s.shrunk,
    upcoming: s.upcoming.orders, stale: false, policyVersion: policy.version,
  }))
}

export function baselineRun(policy: Policy) {
  const result = replay(policy)
  return {
    id: `learn-baseline-v${policy.version}`, round: 0, fromVersion: policy.version, candidateVersion: null, trigger: "manual",
    candidate: null, metrics: result.metrics as unknown as Record<string, unknown>, status: "done", createdAt: now(),
  }
}
