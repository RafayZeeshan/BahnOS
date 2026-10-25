// npm run agent:load: loads the recorded agent runs and Watch lines from traces/, so the app shows them with no key.
import { loadEnvFile } from "../lib/env"

loadEnvFile(".env")

async function main() {
  const { closeDb } = await import("../lib/db-core")
  const { loadRecorded } = await import("../lib/agent/recorded")
  const loaded = await loadRecorded()
  console.log(`Loaded ${loaded.runs} recorded run(s) and ${loaded.lines} Watch line(s).`)
  await closeDb()
}

main().catch((error) => { console.error(error); process.exit(1) })
