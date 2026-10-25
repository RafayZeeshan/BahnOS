// What a person's response does to a decision (ADR-006). Pure, so the route and tests share it.
// PROPOSED -> APPROVED -> EXECUTING -> EXECUTED | FAILED; or TAKEN_OVER, DECLINED, SNOOZED.

export type Status = "PROPOSED" | "APPROVED" | "EXECUTING" | "EXECUTED" | "FAILED" | "DECLINED" | "TAKEN_OVER" | "SNOOZED"
export type HumanResponse = "go_ahead" | "change_it" | "take_over" | "not_this" | "snooze"
export type DecisionState = { status: Status; action: string; undoUntil: string | null }
export type Intervention = { response: "change_it" | "take_over" | "not_this"; reason: string; actor: string; at: string }

type Outcome = { ok: true; state: DecisionState; intervention: Intervention | null } | { ok: false; error: string }

export const UNDO_SECONDS = 5
const NEEDS_REASON = new Set<HumanResponse>(["change_it", "take_over", "not_this"])
const OPEN = new Set<Status>(["PROPOSED", "SNOOZED"])

export function respond(
  state: DecisionState,
  input: { response: HumanResponse; reason?: string; actor: string; actorType: string; at: string },
): Outcome {
  if (input.actorType !== "operator") return { ok: false, error: "Only a person can approve this." }
  if (!OPEN.has(state.status)) return { ok: false, error: "This decision has already been made." }
  const reason = input.reason?.trim()
  if (NEEDS_REASON.has(input.response) && !reason) return { ok: false, error: "Say why, so the agent can learn from it." }
  if (state.action === "escalate" && (input.response === "go_ahead" || input.response === "change_it")) {
    return { ok: false, error: "An escalation has nothing to approve. Take it over or set it aside." }
  }

  const intervention =
    input.response === "change_it" || input.response === "take_over" || input.response === "not_this"
      ? { response: input.response, reason: reason!, actor: input.actor, at: input.at }
      : null

  switch (input.response) {
    case "go_ahead":
    case "change_it": {
      const undoUntil = new Date(Date.parse(input.at) + UNDO_SECONDS * 1000).toISOString()
      return { ok: true, state: { ...state, status: "APPROVED", undoUntil }, intervention }
    }
    case "take_over":
      return { ok: true, state: { ...state, status: "TAKEN_OVER" }, intervention }
    case "not_this":
      return { ok: true, state: { ...state, status: "DECLINED" }, intervention }
    case "snooze":
      return { ok: true, state: { ...state, status: "SNOOZED" }, intervention: null }
  }
}

export function undo(state: DecisionState, at: string): { ok: true; state: DecisionState } | { ok: false; error: string } {
  if (state.status !== "APPROVED" || !state.undoUntil || at > state.undoUntil) {
    return { ok: false, error: "Too late to undo; it has started." }
  }
  return { ok: true, state: { ...state, status: "PROPOSED", undoUntil: null } }
}

export function startExecution(state: DecisionState, at: string): { ok: true; state: DecisionState } | { ok: false; error: string } {
  if (state.status !== "APPROVED") return { ok: false, error: "Only an approved decision can run." }
  if (state.undoUntil && at <= state.undoUntil) return { ok: false, error: "Still inside the undo window." }
  return { ok: true, state: { ...state, status: "EXECUTING" } }
}

export function finishExecution(state: DecisionState, succeeded: boolean): { state: DecisionState } {
  return { state: { ...state, status: succeeded ? "EXECUTED" : "FAILED" } }
}
