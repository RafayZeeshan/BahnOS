// One declaration per action (ADR-002). It drives the guard, the decision card,
// the executor, the ledger and the blockers the reopen watcher re-checks.

export type ActionKind = "read" | "ask" | "plan" | "flag" | "propose" | "stop"
export type Response = "go_ahead" | "change_it" | "take_over" | "not_this"

export type JsonSchema = {
  type: "object"
  properties: Record<string, { type: string; description: string; enum?: string[]; items?: { type: string } }>
  required: string[]
}

/** Facts a blocker check reads; each action picks the ones it needs. */
export type BlockerFacts = Partial<{
  optionStatus: string
  optionOnOrder: boolean
  unresolvedAttempt: boolean
}>

/** Who an ask tool may reach. A customer, or a delivery site (a customer's premises), is never on this list. */
export type Recipient = "driver" | "pickup_site" | "travel_provider"

export type ActionDef = {
  name: string
  kind: ActionKind
  /** What the model reads when choosing the tool. */
  description: string
  input_schema: JsonSchema
  approver: "person" | null
  /** For ask tools: the only recipients this tool may reach. */
  recipients?: Recipient[]
  /** Plain words for the decision card: what happens after each response. */
  effects?: Record<Response, string>
  /** Facts that would stop this action going ahead, in plain words. */
  blockers?: (input: Record<string, unknown>, facts: BlockerFacts) => string[]
}
