import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadEnvFile } from "@/lib/env"
import type { Trace } from "@/lib/agent/trace"

loadEnvFile(join(__dirname, "..", ".env"))

const trace: Trace = {
  id: "run-TEST-2-ask", order: "CD-420299", trigger: "ask", mode: "recorded", model: null, prompt: "x",
  startedAt: "2026-10-21T09:00:00.000Z", finishedAt: "2026-10-21T09:01:00.000Z", status: "done", steps: [],
  proposals: [
    { id: "dec-TEST-2-a", action: "propose_booking", payload: { option_id: "travel-xf29ed1732d895f37" }, headline: "Book", blockers: [], evidence: [] },
    { id: "dec-TEST-2-b", action: "propose_booking", payload: { option_id: "travel-xc1d8163d5443a606" }, headline: "Book sold out", blockers: [], evidence: [] },
    { id: "dec-TEST-2-c", action: "propose_hotel", payload: { city: "Hamburg", night_of: "2026-10-23" }, headline: "Hotel", blockers: [], evidence: [] },
  ],
  escalation: null, headsUp: null, summary: "",
}

describe.runIf(process.env.DATABASE_URL)("decision service", async () => {
  const { db } = await import("@/lib/db")
  const { caseChain, decisions, interventions } = await import("@/lib/agent-schema")
  const { persistTrace, deleteRun } = await import("@/lib/agent/store")
  const { decide, advance, undoDecision } = await import("@/lib/decisions/service")
  const row = async (id: string) => (await db.select().from(decisions).where(eq(decisions.id, id)))[0]
  const person = { actor: "Ops", actorType: "operator" }

  beforeAll(async () => { await persistTrace(trace) })
  afterAll(async () => { await deleteRun(trace.id) })

  it("go ahead approves, waits out the undo window, then executes and opens chain steps", async () => {
    const decided = await decide("dec-TEST-2-a", { response: "go_ahead", ...person })
    expect(decided.ok).toBe(true)
    expect((await row("dec-TEST-2-a")).status).toBe("APPROVED")
    expect((await advance("dec-TEST-2-a")).status).toBe("APPROVED") // still inside the window
    const done = await advance("dec-TEST-2-a", { force: true })
    expect(done.status).toBe("EXECUTED")
    expect((await row("dec-TEST-2-a")).effect).toEqual(expect.objectContaining({ reference: "MOCK-420299-BOOKING" }))
    const chain = await db.select().from(caseChain).where(eq(caseChain.decisionId, "dec-TEST-2-a"))
    expect(chain.map((c) => c.label)).toEqual(["Tell the driver the new sailing and check-in time", "Confirm the delivery window still holds"])
  })

  it("an approved booking whose crossing is sold out ends as failed, with the reason", async () => {
    await decide("dec-TEST-2-b", { response: "go_ahead", ...person })
    const done = await advance("dec-TEST-2-b", { force: true })
    expect(done.status).toBe("FAILED")
    expect((await row("dec-TEST-2-b")).effect).toEqual({ summary: "Not booked: The selected crossing is sold out." })
  })

  it("undo returns the proposal; not this keeps the history and the reason", async () => {
    await decide("dec-TEST-2-c", { response: "go_ahead", ...person })
    expect((await undoDecision("dec-TEST-2-c")).ok).toBe(true)
    expect((await row("dec-TEST-2-c")).status).toBe("PROPOSED")
    await decide("dec-TEST-2-c", { response: "not_this", reason: "Driver will sleep in the cabin.", ...person })
    const r = await row("dec-TEST-2-c")
    expect(r.status).toBe("DECLINED")
    expect(r.reason).toBe("Driver will sleep in the cabin.")
    const saved = await db.select().from(interventions).where(eq(interventions.decisionId, "dec-TEST-2-c"))
    expect(saved.map((i) => i.response)).toEqual(["not_this"])
  })

  it("explains refusals in plain words", async () => {
    expect(await decide("dec-TEST-2-c", { response: "go_ahead", ...person })).toEqual({ ok: false, error: "This decision has already been made." })
    expect(await decide("nope", { response: "go_ahead", ...person })).toEqual({ ok: false, error: "No such decision." })
  })
})

describe.runIf(process.env.DATABASE_URL)("decision service under races (code review)", async () => {
  const { db } = await import("@/lib/db")
  const { decisions, interventions } = await import("@/lib/agent-schema")
  const { persistTrace, deleteRun } = await import("@/lib/agent/store")
  const { decide, advance, undoDecision } = await import("@/lib/decisions/service")
  const race: Trace = {
    ...trace, id: "run-TEST-3-ask",
    proposals: [
      { id: "dec-TEST-3-a", action: "propose_cost", payload: { amount_cents: 100, currency: "EUR", why: "x" }, headline: "Cost", blockers: [], evidence: [] },
      { id: "dec-TEST-3-b", action: "propose_hotel", payload: { city: "Hamburg", night_of: "2026-10-23" }, headline: "Hotel", blockers: [], evidence: [] },
      { id: "dec-TEST-3-c", action: "propose_hotel", payload: { city: "Hamburg", night_of: "2026-10-23" }, headline: "Hotel", blockers: [], evidence: [] },
    ],
  }
  const row = async (id: string) => (await db.select().from(decisions).where(eq(decisions.id, id)))[0]
  const person = { actor: "Ops", actorType: "operator" }
  beforeAll(async () => { await persistTrace(race) })
  afterAll(async () => { await deleteRun(race.id) })

  it("runs an approved decision once, however many execute calls arrive", async () => {
    await decide("dec-TEST-3-a", { response: "go_ahead", ...person })
    const results = await Promise.all([advance("dec-TEST-3-a", { force: true }), advance("dec-TEST-3-a", { force: true }), advance("dec-TEST-3-a", { force: true })])
    expect(results.filter((r) => r.ran).length).toBe(1)
    expect((await row("dec-TEST-3-a")).status).toBe("EXECUTED")
  })

  it("lets only one of two people decide", async () => {
    const [a, b] = await Promise.all([
      decide("dec-TEST-3-b", { response: "go_ahead", ...person }),
      decide("dec-TEST-3-b", { response: "not_this", reason: "No", ...person }),
    ])
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1)
  })

  it("undo after Change it restores the agent's proposal and withdraws the intervention", async () => {
    await decide("dec-TEST-3-c", { response: "change_it", reason: "Closer hotel", payload: { city: "Lübeck" }, ...person })
    expect((await undoDecision("dec-TEST-3-c")).ok).toBe(true)
    const r = await row("dec-TEST-3-c")
    expect(r.status).toBe("PROPOSED")
    expect(r.payload).toEqual({ city: "Hamburg", night_of: "2026-10-23" })
    expect(r.reason).toBeNull()
    expect(await db.select().from(interventions).where(eq(interventions.decisionId, "dec-TEST-3-c"))).toEqual([])
  })
})
