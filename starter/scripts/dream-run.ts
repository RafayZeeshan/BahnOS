// Runs one Dream learning loop from the adopted policy and saves its rounds and candidate versions.
import { and, desc, eq, inArray, ne } from "drizzle-orm"
import * as agentSchema from "../lib/agent-schema"
import { now } from "../lib/clock"
import { learn } from "../lib/dream/learn"
import type { Policy } from "../lib/policy/defaults"
import { POLICY_V1 } from "../lib/policy/defaults"

type Db = typeof import("../lib/db-core").db

export async function runDream(db: Db, trigger: "manual" | "new_data" | "reopen" = "manual") {
  const [adopted] = await db.select().from(agentSchema.policyVersions)
    .where(eq(agentSchema.policyVersions.status, "ADOPTED")).orderBy(desc(agentSchema.policyVersions.adoptedAt)).limit(1)
  const start = (adopted?.params as unknown as Policy) ?? POLICY_V1
  const existing = await db.select({ version: agentSchema.policyVersions.version }).from(agentSchema.policyVersions)
    .where(ne(agentSchema.policyVersions.status, "CANDIDATE"))
  // New candidates are numbered after every version that ever existed, so a rolled-back v2 is never overwritten.
  const offset = Math.max(start.version, ...existing.map((r) => r.version)) - start.version
  const result = learn(start)
  for (const v of result.versions) v.policy.version += offset
  const at = now()
  await db.transaction(async (tx) => {
    // A fresh run replaces earlier candidates that nobody has decided on yet.
    await tx.delete(agentSchema.policyVersions).where(and(eq(agentSchema.policyVersions.status, "CANDIDATE")))
    await tx.delete(agentSchema.learningRuns).where(inArray(agentSchema.learningRuns.trigger, [trigger]))
    for (const v of result.versions) {
      await tx.insert(agentSchema.policyVersions).values({
        version: v.policy.version, params: v.policy as unknown as Record<string, unknown>, status: "CANDIDATE",
        parentVersion: start.version, createdAt: at,
      })
    }
    for (const r of result.rounds) {
      await tx.insert(agentSchema.learningRuns).values({
        id: `learn-${trigger}-v${start.version}-r${r.round}`, round: r.round, fromVersion: r.fromVersion,
        candidateVersion: r.kept ? r.kept.policy.version : null, trigger,
        candidate: r.kept ? { diff: r.kept.diff, lesson: r.kept.lesson, pair: r.kept.pair } : null,
        metrics: {
          incumbent: r.incumbent, proposer: result.proposer, misses: r.misses,
          candidates: r.candidates.map((c) => ({ diff: c.diff, lesson: c.lesson, metrics: c.metrics })),
        },
        status: "done", createdAt: at,
      })
    }
  })
  return result
}
