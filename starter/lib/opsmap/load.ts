// Server-side assembly of the ops map: the team's lane model (ops.ts) coloured by BahnOS's own queue.
import { eq } from "drizzle-orm"
import { watchFlags } from "../agent-schema"
import { loadToday } from "../control/load"
import { db } from "../db"
import { botQueue, buildNeeds } from "./needs"
import { buildOps } from "./ops"

export async function loadOpsMap() {
  const [today, lineRows] = await Promise.all([
    loadToday(),
    db.select({ ref: watchFlags.orderRef, line: watchFlags.line }).from(watchFlags).where(eq(watchFlags.lineSource, "model")),
  ])
  const lines = Object.fromEntries(lineRows.map((r) => [r.ref, r.line]))
  const needs = buildNeeds({ needsYou: today.needsYou, watch: today.watchLevels, lines, pending: today.pending })
  return { model: buildOps(needs), bot: botQueue(today.pending) }
}
