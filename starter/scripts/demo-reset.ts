// npm run demo:reset: puts the agent state back to the start of the demo. v1 in use, no follow-ups arrived,
// live runs cleared, recorded runs reloaded with their proposals open, and a fresh Dream round waiting for a person.
import { gt, ne } from "drizzle-orm"
import { loadEnvFile } from "../lib/env"

loadEnvFile(".env")

async function main() {
  const { db, closeDb } = await import("../lib/db-core")
  const s = await import("../lib/agent-schema")
  const { loadRecorded } = await import("../lib/agent/recorded")
  const { deleteLiveRuns } = await import("../lib/agent/store")
  const { runDream } = await import("./dream-run")
  await db.delete(s.incomingFacts)
  await db.delete(s.reopenEvents)
  await db.delete(s.learningRuns).where(ne(s.learningRuns.trigger, "manual"))
  await db.delete(s.policyVersions).where(gt(s.policyVersions.version, 1))
  await db.update(s.policyVersions).set({ status: "ADOPTED" })
  await db.update(s.failureSources).set({ stale: false })
  const cleared = await deleteLiveRuns()
  const loaded = await loadRecorded()
  const dream = await runDream(db)
  console.log(`Reset: ${cleared} live run(s) cleared, ${loaded.runs} recorded run(s) and ${loaded.lines} Watch line(s) reloaded, ${dream.versions.length} candidate version(s) waiting.`)
  await closeDb()
}

main().catch((error) => { console.error(error); process.exit(1) })
