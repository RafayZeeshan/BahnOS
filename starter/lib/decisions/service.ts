// Applies a person's response to a stored decision, then runs the mock executor once the undo window has passed.
// Every change is a compare-and-set on the decision's status, so two requests can never both win:
// an undo and an execute, two people deciding, or two tabs executing.
import { and, eq, inArray, lt, gte, sql } from "drizzle-orm"
import { caseChain, decisions, interventions } from "@/lib/agent-schema"
import { stamp, wallClock } from "@/lib/clock"
import { db } from "@/lib/db"
import { execute } from "./executor"
import { respond, type DecisionState, type HumanResponse, type Status } from "./machine"

type Row = typeof decisions.$inferSelect
type Result = { ok: true; status: Status } | { ok: false; error: string }

async function load(id: string): Promise<Row | undefined> {
  return (await db.select().from(decisions).where(eq(decisions.id, id)))[0]
}

const stateOf = (row: Row): DecisionState => ({
  status: row.status as Status, action: row.action, undoUntil: row.undoUntil?.toISOString() ?? null,
})

export async function decide(
  id: string,
  input: { response: HumanResponse; reason?: string; actor: string; actorType: string; payload?: Record<string, unknown> },
): Promise<Result> {
  const row = await load(id)
  if (!row) return { ok: false, error: "No such decision." }
  // The undo window is real time; the recorded decision time follows the case's clock.
  const outcome = respond(stateOf(row), { ...input, at: wallClock().toISOString() })
  if (!outcome.ok) return outcome
  const decidedAt = stamp()

  const changed = await db.transaction(async (tx) => {
    const updated = await tx.update(decisions).set({
      status: outcome.state.status,
      response: input.response,
      reason: input.reason?.trim() || null,
      decidedBy: input.actor,
      decidedAt,
      undoUntil: outcome.state.undoUntil ? new Date(outcome.state.undoUntil) : null,
      approvedPayload: input.response === "change_it" && input.payload ? { ...row.payload, ...input.payload } : null,
    }).where(and(eq(decisions.id, id), inArray(decisions.status, ["PROPOSED", "SNOOZED"]))).returning({ id: decisions.id })
    if (!updated.length) return false
    if (outcome.intervention) {
      await tx.insert(interventions).values({
        id: `int-${id}-${decidedAt.toISOString()}`, decisionId: id, orderRef: row.orderRef,
        response: outcome.intervention.response, reason: outcome.intervention.reason,
        actor: outcome.intervention.actor, at: decidedAt,
      })
    }
    return true
  })
  return changed ? { ok: true, status: outcome.state.status } : { ok: false, error: "This decision has already been made." }
}

export async function undoDecision(id: string): Promise<Result> {
  const undone = await db.transaction(async (tx) => {
    const updated = await tx.update(decisions).set({
      status: "PROPOSED", response: null, reason: null, decidedBy: null, decidedAt: null, undoUntil: null, approvedPayload: null,
    }).where(and(eq(decisions.id, id), eq(decisions.status, "APPROVED"), gte(decisions.undoUntil, wallClock())))
      .returning({ id: decisions.id })
    if (!updated.length) return false
    // An undone "Change it" or reason is withdrawn, so Dream does not learn from it.
    await tx.delete(interventions).where(eq(interventions.decisionId, id))
    return true
  })
  if (undone) return { ok: true, status: "PROPOSED" }
  return (await load(id)) ? { ok: false, error: "Too late to undo; it has started." } : { ok: false, error: "No such decision." }
}

/** Runs an approved decision once its undo window has passed. `force` skips the wait (tests and the executor job). */
export async function advance(id: string, options: { force?: boolean } = {}): Promise<{ status: Status; ran: boolean }> {
  const claim = and(eq(decisions.id, id), eq(decisions.status, "APPROVED"), ...(options.force ? [] : [lt(decisions.undoUntil, wallClock())]))
  const [row] = await db.update(decisions).set({ status: "EXECUTING" }).where(claim).returning()
  if (!row) {
    const current = await load(id)
    if (!current) throw new Error(`No decision ${id}`)
    return { status: current.status as Status, ran: false }
  }

  const result = execute({ action: row.action, order: row.orderRef, payload: row.approvedPayload ?? row.payload })
  const finished: Status = result.ok ? "EXECUTED" : "FAILED"
  const at = stamp()
  await db.transaction(async (tx) => {
    await tx.update(decisions).set({ status: finished, effect: result.effect }).where(eq(decisions.id, id))
    if (result.next.length) {
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${caseChain.seq}), 0)` }).from(caseChain)
        .where(eq(caseChain.orderRef, row.orderRef))
      await tx.insert(caseChain).values(result.next.map((label, i) => ({
        id: `chain-${id}-${i + 1}`, orderRef: row.orderRef, decisionId: id, seq: Number(max) + i + 1, label,
        status: "waiting", createdAt: at,
      })))
    }
  })
  return { status: finished, ran: true }
}
