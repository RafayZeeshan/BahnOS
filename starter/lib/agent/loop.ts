// BahnBot's tool loop (ADR-001). Every call passes the guard first (ADR-002);
// propose calls become proposals for a person, never changes.
import type Anthropic from "@anthropic-ai/sdk"
import { ACTIONS, actionFor } from "@/lib/actions"
import { bookingFacts } from "@/lib/actions/facts"
import { now } from "@/lib/clock"
import { checkToolCall } from "@/lib/policy/guard"
import { POLICY_V1, type Policy } from "@/lib/policy/defaults"
import { isReadTool, runTool } from "./tools"
import { SYSTEM_PROMPT } from "./prompt"
import type { Escalation, HeadsUp, Proposal, Step, Trace, Trigger } from "./trace"

export type ModelCall = (request: {
  system: string
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
}) => Promise<Anthropic.Message>

type RunInput = {
  order: string
  trigger: Trigger
  prompt: string
  model: ModelCall
  modelName?: string
  policy?: Policy
  maxTurns?: number
  runId?: string
}

const STEP_SECONDS = 20

export const TOOLS: Anthropic.Tool[] = Object.values(ACTIONS).map((action) => ({
  name: action.name,
  description: action.description,
  input_schema: action.input_schema as Anthropic.Tool.InputSchema,
}))

// A provider check settles an unknown booking outcome only if it was for this order, worked, and found no reservation.
function providerVerified(order: string, steps: Step[]): boolean {
  return steps.some((s) => {
    const out = s.output as Record<string, unknown> | undefined
    return s.kind === "tool_result" && s.tool === "check_provider_status" && !!out && !out.error && out.order === order && out.holds_reservation === false
  })
}

function headline(action: string, input: Record<string, unknown>): string {
  const why = typeof input.why === "string" ? input.why : typeof input.body === "string" ? input.body : ""
  const label: Record<string, string> = {
    propose_booking: "Book travel",
    propose_hotel: "Book a hotel night",
    propose_date_change: "Change the delivery date",
    propose_cost: "Approve a cost",
    draft_customer_update: "Send the customer an update",
  }
  return why ? `${label[action] ?? action}: ${why}` : label[action] ?? action
}

function evidenceIn(output: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>
      if (obj.evidence && typeof obj.evidence === "object") found.push(obj.evidence as Record<string, unknown>)
      Object.values(obj).forEach(walk)
    }
  }
  walk(output)
  return found
}

export async function runAgent(input: RunInput): Promise<Trace> {
  const policy = input.policy ?? POLICY_V1
  const maxTurns = input.maxTurns ?? 14
  const start = now()
  const runId = input.runId ?? `run-${input.order}-${input.trigger}`
  const steps: Step[] = []
  const proposals: Proposal[] = []
  let escalation: Escalation | null = null
  let headsUp: HeadsUp | null = null
  const seen: Record<string, unknown>[] = []

  const add = (step: Omit<Step, "seq" | "at">) => {
    const seq = steps.length + 1
    steps.push({ ...step, seq, at: new Date(start.getTime() + seq * STEP_SECONDS * 1000).toISOString() })
  }

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Order ${input.order}. ${input.prompt}` }]
  const finish = (status: Trace["status"], summary: string): Trace => ({
    id: runId,
    order: input.order,
    trigger: input.trigger,
    mode: "live",
    model: input.modelName ?? null,
    prompt: input.prompt,
    startedAt: start.toISOString(),
    finishedAt: new Date(start.getTime() + (steps.length + 1) * STEP_SECONDS * 1000).toISOString(),
    status,
    steps,
    proposals,
    escalation,
    headsUp,
    summary,
  })

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await input.model({ system: SYSTEM_PROMPT, messages, tools: TOOLS })
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
    if (text) add({ kind: "message", text })

    if (response.stop_reason === "refusal") return finish("failed", "The model declined this request. A person needs to take it.")
    const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    if (uses.length === 0) return finish("done", text || "Finished without a summary.")

    messages.push({ role: "assistant", content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of uses) {
      const args = (use.input ?? {}) as Record<string, unknown>
      add({ kind: "tool_call", tool: use.name, input: args })
      const verdict = checkToolCall({ tool: use.name, input: args }, policy)
      if (!verdict.allowed) {
        add({ kind: "guard_refusal", tool: use.name, text: verdict.reason })
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: verdict.reason })
        continue
      }

      let output: unknown
      if (isReadTool(use.name)) {
        output = runTool(use.name, args)
        seen.push(...evidenceIn(output))
      } else if (actionFor(use.name)?.kind === "propose") {
        const blockers = actionFor(use.name)!.blockers?.(args, bookingFacts(input.order, args, providerVerified(input.order, steps))) ?? []
        if (blockers.length) {
          add({ kind: "blocked", tool: use.name, output: { blockers } })
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: JSON.stringify({ blocked: blockers }) })
          continue
        }
        const proposal: Proposal = {
          id: `dec-${runId}-${proposals.length + 1}`,
          action: use.name,
          payload: args,
          headline: headline(use.name, args),
          blockers: [],
          evidence: seen.slice(-8),
        }
        proposals.push(proposal)
        output = { proposed: true, id: proposal.id, note: "Waiting for a person to decide. Nothing has changed yet." }
      } else if (use.name === "escalate") {
        escalation = {
          reason: String(args.reason),
          what_i_know: (args.what_i_know as string[]) ?? [],
          what_i_dont_know: (args.what_i_dont_know as string[]) ?? [],
        }
        output = { handed_over: true }
      } else if (use.name === "raise_heads_up") {
        headsUp = { risk: String(args.risk), line: String(args.line) }
        output = { flagged: true }
      } else {
        output = { error: `${use.name} has no handler.` }
      }
      add({ kind: "tool_result", tool: use.name, output })
      results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(output) })
    }
    messages.push({ role: "user", content: results })
  }
  return finish("stopped", `Stopped after ${maxTurns} steps without finishing. A person should take this case.`)
}
