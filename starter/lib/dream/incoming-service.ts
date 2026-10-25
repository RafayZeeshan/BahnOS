// Plays the next recorded fact into the agent tables and runs the reopen watcher on it.
import { and, eq, inArray } from "drizzle-orm"
import { failureSources, incomingFacts, learningRuns, reopenEvents } from "@/lib/agent-schema"
import { stamp } from "@/lib/clock"
import { db } from "@/lib/db"
import { buildCasebook } from "./casebook"
import { RECORDED_FACTS, applyFact } from "./incoming"

export async function playNextFact() {
  const played = new Set((await db.select({ id: incomingFacts.id }).from(incomingFacts)).map((r) => r.id))
  const fact = RECORDED_FACTS.find((f) => !played.has(f.id))
  if (!fact) return { ok: false as const, error: "Every recorded follow-up has already arrived." }
  const effect = applyFact(fact, buildCasebook())
  const at = stamp()
  await db.transaction(async (tx) => {
    // Two plays at once pick the same fact; the second is a no-op, not an error.
    await tx.insert(incomingFacts).values({ id: fact.id, orderRef: fact.order, text: fact.text, source: fact.source, clears: fact.clears, arrivedAt: at })
      .onConflictDoNothing()
    const ids = effect.staleSources.map((k) => `src-${k.replace("|", "-")}`)
    if (ids.length) await tx.update(failureSources).set({ stale: true }).where(inArray(failureSources.id, ids))
    await tx.insert(learningRuns).values({
      id: `queued-${fact.id}`, round: 0, fromVersion: 0, trigger: effect.reopen ? "reopen" : "new_data",
      metrics: { reason: fact.text, order: fact.order }, status: "queued", createdAt: at,
    }).onConflictDoNothing()
    if (effect.reopen) {
      await tx.insert(reopenEvents).values({
        id: `reopen-${fact.id}`, orderRef: fact.order, blocker: effect.cleared[0],
        clearedBy: { fact: fact.text, source: fact.source }, status: "open", at,
      }).onConflictDoNothing()
    }
  })
  return { ok: true as const, fact, effect }
}

export async function newSince() {
  const [facts, queued, reopened, stale] = await Promise.all([
    db.select().from(incomingFacts),
    db.select().from(learningRuns).where(eq(learningRuns.status, "queued")),
    db.select().from(reopenEvents).where(eq(reopenEvents.status, "open")),
    db.select({ id: failureSources.id }).from(failureSources).where(eq(failureSources.stale, true)),
  ])
  return { facts, queued: queued.length, reopened, staleSources: stale.length, remaining: RECORDED_FACTS.length - facts.length }
}

export async function closeReopen(id: string) {
  await db.update(reopenEvents).set({ status: "decided" }).where(and(eq(reopenEvents.id, id), eq(reopenEvents.status, "open")))
}

/** After a Dream run: queued runs are done and source records are fresh again. */
export async function markRunDone() {
  await db.update(learningRuns).set({ status: "done" }).where(eq(learningRuns.status, "queued"))
  await db.update(failureSources).set({ stale: false }).where(eq(failureSources.stale, true))
}
