// Runs the agent live for demo orders and saves the traces to ../traces for recorded mode.
// Usage: npm run agent:record -- CD-420299 [CD-420322 ...]   (no arguments records every scenario)
import "dotenv/config"
import { agentModelName, claudeModel } from "../lib/agent/claude"
import { runAgent } from "../lib/agent/loop"
import { SCENARIOS } from "../lib/agent/scenarios"
import { saveTrace } from "../lib/agent/trace"

async function main() {
  const wanted = process.argv.slice(2)
  const scenarios = wanted.length ? SCENARIOS.filter((s) => wanted.includes(s.order)) : SCENARIOS
  const model = claudeModel()
  for (const scenario of scenarios) {
    const trace = await runAgent({ ...scenario, model, modelName: agentModelName() })
    const file = saveTrace(trace)
    const tools = trace.steps.filter((s) => s.kind === "tool_call").map((s) => s.tool).join(", ")
    console.log(`${scenario.order}: ${trace.status}, ${trace.proposals.length} proposal(s). Tools: ${tools}\n  ${trace.summary}\n  -> ${file}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
