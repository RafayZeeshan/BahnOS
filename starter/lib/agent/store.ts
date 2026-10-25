// Writes a run into the agent tables (ADR-005). Recorded traces are loaded the same way as live runs.
import { and, eq, inArray } from "drizzle-orm"
import { staleProposals } from "../decisions/supersede"
import { db } from "../db-core"
import { agentRuns, agentSteps, caseChain, decisions, interventions, watchFlags } from "../agent-schema"
import { POLICY_V1 } from "../policy/defaults"
import type { WatchLine } from "../watch/line"
import type { Trace } from "./trace"

export async function deleteRun(runId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const owned = await tx.select({ id: decisions.id }).from(decisions).where(eq(decisions.runId, runId))
    const ids = owned.map((d) => d.id)
    if (ids.length) {
      // Proposals this run had replaced are open again once it is gone.
      await tx.update(decisions).set({ status: "PROPOSED", supersededBy: null })
        .where(and(inArray(decisions.supersededBy, ids), eq(decisions.status, "SUPERSEDED")))
      await tx.delete(interventions).where(inArray(interventions.decisionId, ids))
      await tx.delete(caseChain).where(inArray(caseChain.decisionId, ids))
      await tx.delete(decisions).where(inArray(decisions.id, ids))
    }
    await tx.delete(watchFlags).where(eq(watchFlags.id, `flag-${runId}`))
    await tx.delete(agentRuns).where(eq(agentRuns.id, runId))
  })
}

/** Retires BahnBot's older open proposals of the same kind on an order (all orders when none is given). */
export async function supersedeOlder(orderRef?: string): Promise<number> {
  const open = await db.select({
    id: decisions.id, runId: decisions.runId, orderRef: decisions.orderRef, action: decisions.action, status: decisions.status, createdAt: decisions.createdAt,
  }).from(decisions).where(and(inArray(decisions.status, ["PROPOSED", "SNOOZED"]), orderRef ? eq(decisions.orderRef, orderRef) : undefined))
  const stale = staleProposals(open)
  for (const s of stale) {
    // Compare-and-set: a person deciding at the same moment wins.
    await db.update(decisions).set({ status: "SUPERSEDED", supersededBy: s.by })
      .where(and(eq(decisions.id, s.id), inArray(decisions.status, ["PROPOSED", "SNOOZED"])))
  }
  return stale.length
}

/** Replaces any earlier copy of the same run, so reseeding and re-running are safe. */
export async function persistTrace(trace: Trace): Promise<void> {
  await deleteRun(trace.id)
  await db.transaction(async (tx) => {
    await tx.insert(agentRuns).values({
      id: trace.id, orderRef: trace.order, trigger: trace.trigger, mode: trace.mode, status: trace.status,
      model: trace.model, summary: trace.summary, startedAt: new Date(trace.startedAt), finishedAt: new Date(trace.finishedAt),
    })
    if (trace.steps.length) {
      await tx.insert(agentSteps).values(trace.steps.map((s) => ({
        id: `${trace.id}-${s.seq}`, runId: trace.id, seq: s.seq, kind: s.kind, tool: s.tool ?? null,
        input: s.input ?? null, output: s.output ?? null, text: s.text ?? null, at: new Date(s.at),
      })))
    }
    const created = new Date(trace.finishedAt)
    const rows = trace.proposals.map((p) => ({
      id: p.id, runId: trace.id, orderRef: trace.order, action: p.action, payload: p.payload, headline: p.headline,
      status: "PROPOSED", blockers: p.blockers, evidence: p.evidence, createdAt: created,
    }))
    if (trace.escalation) {
      rows.push({
        id: `esc-${trace.id}`, runId: trace.id, orderRef: trace.order, action: "escalate",
        payload: trace.escalation as unknown as Record<string, unknown>, headline: trace.escalation.reason,
        status: "PROPOSED", blockers: [], evidence: [], createdAt: created,
      })
    }
    if (rows.length) await tx.insert(decisions).values(rows)
    if (trace.headsUp) {
      await tx.insert(watchFlags).values({
        id: `flag-${trace.id}`, orderRef: trace.order, level: trace.headsUp.risk, signals: [], line: trace.headsUp.line,
        lineSource: "model", policyVersion: POLICY_V1.version, evaluatedAt: created,
      })
    }
  })
  await supersedeOlder(trace.order)
}

/** Watch's recorded warning lines (ADR-008). Replaces only the rows for these orders. */
export async function persistWatchLines(lines: WatchLine[]): Promise<void> {
  if (!lines.length) return
  await db.transaction(async (tx) => {
    await tx.delete(watchFlags).where(inArray(watchFlags.id, lines.map((l) => `line-${l.order}`)))
    await tx.insert(watchFlags).values(lines.map((l) => ({
      id: `line-${l.order}`, orderRef: l.order, level: l.level, signals: [], line: l.line, lineSource: "model",
      nextStep: l.next_step, policyVersion: POLICY_V1.version, evaluatedAt: new Date(l.written_at),
    })))
  })
}

/** Live runs (Ask the agent, live sessions) are not part of the demo's starting state; reset removes them. */
export async function deleteLiveRuns(orderRef?: string): Promise<number> {
  const live = await db.select({ id: agentRuns.id }).from(agentRuns)
    .where(orderRef ? and(eq(agentRuns.mode, "live"), eq(agentRuns.orderRef, orderRef)) : eq(agentRuns.mode, "live"))
  for (const run of live) await deleteRun(run.id)
  return live.length
}
