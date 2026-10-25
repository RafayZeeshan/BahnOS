// Database reads for the control room. The pure builders in queue.ts and case.ts do the rest.
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { agentRuns, agentSteps, caseChain, decisions, incomingFacts, watchFlags } from "@/lib/agent-schema"
import type { Step } from "@/lib/agent/trace"
import { db } from "@/lib/db"
import { buildBoardCard } from "@/lib/present/board"
import { loadBoardBundles } from "@/lib/present/load"
import type { CaseDecision, CaseInput } from "./case"
import { now } from "@/lib/clock"
import { evaluate } from "@/lib/engine/evaluate"
import { activePolicy, ratesFor } from "@/lib/policy/active"
import { buildQueue, type PendingDecision, type WatchState } from "./queue"

const iso = (d: Date | null) => (d ? d.toISOString() : null)

export async function loadToday() {
  const [{ snapshotAt, bundles }, pending, runs] = await Promise.all([
    loadBoardBundles(),
    db.select({ id: decisions.id, orderRef: decisions.orderRef, action: decisions.action, headline: decisions.headline })
      .from(decisions).where(inArray(decisions.status, ["PROPOSED"])).orderBy(asc(decisions.createdAt)),
    db.select({ mode: agentRuns.mode }).from(agentRuns),
  ])
  const policy = await activePolicy()
  const rates = ratesFor(policy)
  const t = now().toISOString()
  const watch: Record<string, WatchState> = {}
  for (const b of bundles) {
    const e = evaluate(policy, b.order.reference, t, undefined, { rates })
    const cutoff = e.signals.find((s) => s.kind === "cutoff")
    if (e.level !== "fine") watch[b.order.reference] = { level: e.level, cutoff: cutoff?.minutes !== undefined ? { at: cutoff.at, minutes: cutoff.minutes } : null }
  }
  const queue = buildQueue(bundles.map(buildBoardCard), pending as PendingDecision[], watch)
  const headsUp = Object.keys(watch)
  return {
    snapshotAt, ...queue, recorded: runs.some((r) => r.mode === "recorded"), agentRuns: runs.length,
    headsUp: { total: headsUp.length, alsoNeedsYou: queue.needsYou.filter((q) => watch[q.reference]).length },
    // For the ops map, which colours lanes from the same queue (ADR-017).
    watchLevels: Object.fromEntries(Object.entries(watch).map(([ref, w]) => [ref, w.level])),
    pending: pending as PendingDecision[],
  }
}

export async function loadCaseInput(reference: string): Promise<CaseInput> {
  const [decisionRows, runRows, chainRows, factRows, lineRows] = await Promise.all([
    db.select().from(decisions).where(eq(decisions.orderRef, reference)).orderBy(asc(decisions.createdAt)),
    db.select().from(agentRuns).where(eq(agentRuns.orderRef, reference)),
    db.select().from(caseChain).where(eq(caseChain.orderRef, reference)),
    db.select().from(incomingFacts).where(eq(incomingFacts.orderRef, reference)),
    db.select({ line: watchFlags.line }).from(watchFlags)
      .where(and(eq(watchFlags.orderRef, reference), eq(watchFlags.lineSource, "model"))).orderBy(desc(watchFlags.evaluatedAt)).limit(1),
  ])
  const stepRows = runRows.length
    ? await db.select().from(agentSteps).where(inArray(agentSteps.runId, runRows.map((r) => r.id))).orderBy(asc(agentSteps.seq))
    : []
  return {
    reference,
    decisions: decisionRows.map((d): CaseDecision => ({
      id: d.id, action: d.action, status: d.status, headline: d.headline, payload: d.payload, blockers: d.blockers,
      evidence: d.evidence, effect: d.effect ?? null, response: d.response, reason: d.reason, decidedBy: d.decidedBy,
      decidedAt: iso(d.decidedAt), undoUntil: iso(d.undoUntil), createdAt: d.createdAt.toISOString(),
    })),
    runs: runRows.map((r) => ({
      id: r.id, trigger: r.trigger, mode: r.mode, summary: r.summary, startedAt: r.startedAt.toISOString(),
      steps: stepRows.filter((s) => s.runId === r.id).map((s): Step => ({
        seq: s.seq, kind: s.kind as Step["kind"], tool: s.tool ?? undefined, input: s.input ?? undefined,
        output: s.output ?? undefined, text: s.text ?? undefined, at: s.at.toISOString(),
      })),
    })),
    chain: chainRows.map((c) => ({ label: c.label, status: c.status, seq: c.seq })),
    incoming: factRows.map((f) => ({ text: f.text, source: f.source, at: f.arrivedAt.toISOString() })),
    watchLine: lineRows[0]?.line ?? null,
  }
}
