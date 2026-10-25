import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as agentSchema from "../lib/agent-schema"
import { POLICY_V1 } from "../lib/policy/defaults"
import { baselineRun, casebookRows, mishapRows, policyRow, sourceRows } from "./agent-seed-rows"
import { runDream } from "./dream-run"

const url = process.env.DATABASE_URL
if (!url) throw new Error("Set DATABASE_URL before seeding. See .env.example.")

const client = postgres(url, { max: 1 })
const db = drizzle(client, { schema: agentSchema })

// Idempotent: policy v1 is the baseline every Dream round compares against.
async function seed() {
  await db.insert(agentSchema.policyVersions).values(policyRow(POLICY_V1)).onConflictDoNothing()
  // Derived from the packet, so they are rebuilt on every seed.
  await db.transaction(async (tx) => {
    await tx.delete(agentSchema.casebook)
    await tx.insert(agentSchema.casebook).values(casebookRows())
    await tx.delete(agentSchema.mishaps)
    await tx.insert(agentSchema.mishaps).values(mishapRows())
    await tx.delete(agentSchema.failureSources)
    await tx.insert(agentSchema.failureSources).values(sourceRows(POLICY_V1))
    await tx.insert(agentSchema.learningRuns).values(baselineRun(POLICY_V1)).onConflictDoNothing()
  })
  const dream = await runDream(db as never)
  console.log(`Seeded agent policy v1, the casebook, mishaps, failure sources and the v1 replay baseline. Dream: ${dream.versions.length} candidate version(s).`)
}

seed().finally(async () => { await client.end() })
