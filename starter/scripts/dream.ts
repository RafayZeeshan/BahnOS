// npm run dream: one learning loop from the adopted policy. Candidates wait for a person on "What the agent learned".
import { loadEnvFile } from "../lib/env"

loadEnvFile(".env")

async function main() {
  const { db, closeDb } = await import("../lib/db-core")
  const { runDream } = await import("./dream-run")
  const result = await runDream(db)
  for (const r of result.rounds) console.log(`Round ${r.round}: ${r.kept ? `kept ${r.kept.diff.map((d) => `${d.path} → ${d.to}`).join(", ")}` : "nothing beat the incumbent"}`)
  console.log(`${result.versions.length} candidate version(s) waiting for a person.`)
  await closeDb()
}

main().catch((error) => { console.error(error); process.exit(1) })
