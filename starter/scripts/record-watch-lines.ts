// Runs Watch's model step live (ADR-008) for flagged orders that no recorded run already warned about,
// and saves the lines to traces/watch/lines.json for recorded mode. Usage: npm run watch:record
import "dotenv/config"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { agentModelName, claudeModel } from "../lib/agent/claude"
import { loadTraces } from "../lib/agent/trace"
import { now } from "../lib/clock"
import { POLICY_V1 } from "../lib/policy/defaults"
import { cardsNeedingLines, watchLinesFile, writeWatchLine, type WatchLine } from "../lib/watch/line"
import { sweep } from "../lib/watch/sweep"

async function main() {
  const t = now().toISOString()
  const warned = loadTraces().filter((trace) => trace.headsUp).map((trace) => trace.order)
  const cards = cardsNeedingLines(sweep(POLICY_V1, t), warned)
  const model = claudeModel()
  const lines: WatchLine[] = []
  for (const card of cards) {
    const line = await writeWatchLine(model, card, { model: agentModelName(), at: t })
    console.log(`${card.order}: ${line ? `${line.line} [${line.next_step}]` : "no usable line; the template stays"}`)
    if (line) lines.push(line)
  }
  const file = watchLinesFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(lines, null, 2)}\n`)
  console.log(`-> ${file}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
