// The brief's rules, enforced in code (ADR-002). The prompt describes them; this decides.
import { actionFor, validate, type Response } from "@/lib/actions"
import type { Policy } from "./defaults"

export type GuardResult = { allowed: true; createsProposal?: true } | { allowed: false; reason: string }

const NOT_A_CUSTOMER = new Set(["driver", "pickup_site", "travel_provider"])
// Rules no policy version can loosen.
const ALWAYS_A_PERSON = new Set(["draft_customer_update"])

export function checkToolCall(call: { tool: string; input: Record<string, unknown> }, _policy: Policy): GuardResult {
  const action = actionFor(call.tool)
  if (!action) return { allowed: false, reason: `There is no tool called ${call.tool}.` }

  if (action.kind === "ask") {
    const role = String(call.input.recipient_role)
    if (!NOT_A_CUSTOMER.has(role)) return { allowed: false, reason: "The agent never contacts a customer. Draft it for a person to send." }
    if (!action.recipients?.includes(role as never)) return { allowed: false, reason: `${call.tool} cannot reach a ${role.replace("_", " ")}.` }
  }

  const missing = validate(action, call.input)
  if (missing.length) return { allowed: false, reason: missing.join(" ") }

  if (action.kind === "propose") return { allowed: true, createsProposal: true }
  return { allowed: true }
}

export type Decision = { response: Response; actorType: string } | null

export function checkExecution(input: { action: string; decision: Decision }, policy: Policy): GuardResult {
  const action = actionFor(input.action)
  if (!action || action.kind !== "propose") return { allowed: false, reason: "Only proposed actions can be executed." }

  const needsPerson = ALWAYS_A_PERSON.has(action.name) || policy.approval[action.name] !== "auto"
  if (!needsPerson) return { allowed: true }

  const { decision } = input
  if (!decision) return { allowed: false, reason: "A person has not decided yet." }
  if (decision.actorType !== "operator") return { allowed: false, reason: "Only a person can approve this." }
  if (decision.response === "go_ahead" || decision.response === "change_it") return { allowed: true }
  return { allowed: false, reason: "The person chose not to go ahead." }
}
