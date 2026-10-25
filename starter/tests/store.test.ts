import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, describe, expect, it } from "vitest"
import { loadEnvFile } from "@/lib/env"
import type { Trace } from "@/lib/agent/trace"

loadEnvFile(join(__dirname, "..", ".env"))

const trace: Trace = {
  id: "run-TEST-1-ask", order: "CD-TEST-1", trigger: "ask", mode: "recorded", model: "test", prompt: "x",
  startedAt: "2026-10-21T09:00:00.000Z", finishedAt: "2026-10-21T09:01:00.000Z", status: "done",
  steps: [
    { seq: 1, kind: "tool_call", tool: "get_case", input: { order: "CD-TEST-1" }, at: "2026-10-21T09:00:20.000Z" },
    { seq: 2, kind: "tool_result", tool: "get_case", output: { ok: true }, at: "2026-10-21T09:00:40.000Z" },
  ],
  proposals: [{ id: "dec-TEST-1-1", action: "propose_hotel", payload: { city: "Hamburg" }, headline: "Book a hotel night", blockers: [], evidence: [] }],
  escalation: { reason: "Owner must decide.", what_i_know: ["a"], what_i_dont_know: ["b"] },
  headsUp: { risk: "watch", line: "Check-in is tight." },
  summary: "Test run.",
}

describe.runIf(process.env.DATABASE_URL)("persisting a trace", async () => {
  const { db } = await import("@/lib/db")
  const { agentRuns, agentSteps, decisions, watchFlags } = await import("@/lib/agent-schema")
  const { persistTrace, persistWatchLines, deleteRun, deleteLiveRuns } = await import("@/lib/agent/store")

  afterAll(async () => {
    await deleteRun(trace.id)
    await db.delete(watchFlags).where(eq(watchFlags.id, "line-CD-TEST-2"))
  })

  it("clears live runs on reset and keeps recorded ones", async () => {
    await persistTrace({ ...trace, id: "ask-TEST-live", mode: "live", proposals: [], escalation: null, headsUp: null })
    await persistTrace({ ...trace, id: "run-TEST-recorded", mode: "recorded", proposals: [], escalation: null, headsUp: null })
    const removed = await deleteLiveRuns("CD-TEST-1")
    expect(removed).toBeGreaterThanOrEqual(1)
    const left = await db.select().from(agentRuns).where(eq(agentRuns.orderRef, "CD-TEST-1"))
    expect(left.map((r) => r.id)).toContain("run-TEST-recorded")
    expect(left.map((r) => r.id)).not.toContain("ask-TEST-live")
    await deleteRun("run-TEST-recorded")
  })

  it("retires BahnBot's older open proposal when it proposes the same thing again, and re-opens it if the newer run goes", async () => {
    const base = { ...trace, order: "CD-TEST-3", escalation: null, headsUp: null }
    const first = { ...base, id: "ask-TEST-3a", finishedAt: "2026-10-21T09:01:00.000Z", proposals: [{ ...trace.proposals[0], id: "dec-TEST-3a" }] }
    const second = { ...base, id: "ask-TEST-3b", finishedAt: "2026-10-21T09:02:00.000Z", proposals: [{ ...trace.proposals[0], id: "dec-TEST-3b" }] }
    const statuses = async () => Object.fromEntries((await db.select().from(decisions).where(eq(decisions.orderRef, "CD-TEST-3"))).map((r) => [r.id, r.status]))
    await persistTrace(first)
    await persistTrace(second)
    expect(await statuses()).toEqual({ "dec-TEST-3a": "SUPERSEDED", "dec-TEST-3b": "PROPOSED" })
    await deleteRun(second.id)
    expect(await statuses()).toEqual({ "dec-TEST-3a": "PROPOSED" })
    await deleteRun(first.id)
  })

  it("writes Watch's recorded lines with their next step, and rewrites them on a second load", async () => {
    const line = { order: "CD-TEST-2", level: "watch" as const, line: "Tight.", next_step: "ask_driver" as const, model: "m", written_at: "2026-10-21T09:00:00.000Z" }
    await persistWatchLines([line])
    await persistWatchLines([{ ...line, line: "Tighter." }])
    const rows = await db.select().from(watchFlags).where(eq(watchFlags.orderRef, "CD-TEST-2"))
    expect(rows).toEqual([expect.objectContaining({ line: "Tighter.", lineSource: "model", nextStep: "ask_driver" })])
  })

  it("writes the run, its steps, a decision per proposal and escalation, and the heads-up", async () => {
    await persistTrace(trace)
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, trace.id))
    expect(run.mode).toBe("recorded")
    expect(await db.select().from(agentSteps).where(eq(agentSteps.runId, trace.id))).toHaveLength(2)
    const decided = await db.select().from(decisions).where(eq(decisions.runId, trace.id))
    expect(decided.map((d) => d.action).sort()).toEqual(["escalate", "propose_hotel"])
    expect(decided.every((d) => d.status === "PROPOSED")).toBe(true)
    const [flag] = await db.select().from(watchFlags).where(eq(watchFlags.orderRef, "CD-TEST-1"))
    expect(flag.line).toBe("Check-in is tight.")
  })

  it("is safe to run twice", async () => {
    await persistTrace(trace)
    expect(await db.select().from(agentSteps).where(eq(agentSteps.runId, trace.id))).toHaveLength(2)
    expect(await db.select().from(decisions).where(eq(decisions.runId, trace.id))).toHaveLength(2)
  })
})
