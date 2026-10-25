import { getTableName } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import * as agentSchema from "@/lib/agent-schema"
import * as starterSchema from "@/lib/schema"
import { policyRow } from "@/scripts/agent-seed-rows"
import { POLICY_V1 } from "@/lib/policy/defaults"

const tableNames = (schema: Record<string, unknown>) =>
  Object.values(schema)
    .filter((value) => typeof value === "object" && value !== null && Symbol.for("drizzle:Name") in value)
    .map((table) => getTableName(table as never))

describe("agent tables (ADR-005)", () => {
  it("adds every table the plan names", () => {
    expect(tableNames(agentSchema).sort()).toEqual(
      [
        "agent_runs", "agent_steps", "decisions", "case_chain", "watch_flags", "mishaps", "failure_sources",
        "policy_versions", "casebook", "learning_runs", "reopen_events", "interventions", "incoming_facts",
      ].sort(),
    )
  })

  it("keeps them apart from the starter's tables so reseeding is safe", () => {
    const starter = new Set(tableNames(starterSchema))
    for (const name of tableNames(agentSchema)) expect(starter.has(name)).toBe(false)
  })

  it("seeds policy v1 as the adopted version, dated at the snapshot", () => {
    const row = policyRow(POLICY_V1)
    expect(row.version).toBe(1)
    expect(row.status).toBe("ADOPTED")
    expect(row.adoptedBy).toBe("seed")
    expect(row.createdAt.toISOString()).toBe("2026-10-21T09:00:00.000Z")
    expect(row.params).toEqual(POLICY_V1)
  })
})

describe("seeding the casebook and the v1 baseline", async () => {
  const { casebookRows, mishapRows, sourceRows, baselineRun } = await import("@/scripts/agent-seed-rows")

  it("writes one casebook row per order and one row per mishap", () => {
    expect(casebookRows()).toHaveLength(100)
    expect(mishapRows().every((m) => m.cause && m.evidence.length === 1)).toBe(true)
  })

  it("writes failure sources with k, n and the shrunk rate", () => {
    const fr = sourceRows(POLICY_V1).find((s) => s.kind === "route" && s.key === "FR → FI")!
    expect([fr.k, fr.n]).toEqual([2, 3])
  })

  it("records the v1 baseline as a held-out replay", () => {
    const run = baselineRun(POLICY_V1)
    expect(run.round).toBe(0)
    expect(run.metrics).toEqual(expect.objectContaining({ label: "held-out (leave one order out, as of each checkpoint)" }))
  })
})
