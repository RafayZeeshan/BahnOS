import { describe, expect, it } from "vitest"
import { ACTIONS, actionFor } from "@/lib/actions"
import { checkExecution, checkToolCall } from "@/lib/policy/guard"
import { POLICY_V1 } from "@/lib/policy/defaults"

describe("typed actions", () => {
  it("declares every tool the agent can call", () => {
    const names = Object.keys(ACTIONS).sort()
    expect(names).toEqual(
      [
        "answer_book", "call_driver", "call_site", "check_provider_status", "draft_customer_update", "escalate",
        "get_case", "get_ferry_terminals", "get_road_estimate", "get_travel_options", "message_driver",
        "price_alternatives", "propose_booking", "propose_cost", "propose_date_change", "propose_hotel",
        "raise_heads_up",
      ].sort(),
    )
  })

  it("gives every propose action an approver, effects for all four responses, and blockers", () => {
    for (const action of Object.values(ACTIONS).filter((a) => a.kind === "propose")) {
      expect(action.approver).toBe("person")
      expect(Object.keys(action.effects ?? {}).sort()).toEqual(["change_it", "go_ahead", "not_this", "take_over"])
      expect(typeof action.blockers).toBe("function")
    }
  })

  it("lists what would block a ferry booking", () => {
    const blockers = actionFor("propose_booking")!.blockers!(
      { option_id: "travel-1" },
      { optionStatus: "SOLD_OUT", unresolvedAttempt: true },
    )
    expect(blockers).toEqual([
      "The selected crossing is sold out.",
      "An earlier booking attempt has an unknown outcome.",
    ])
  })
})

describe("guard: tool calls", () => {
  it("allows reading without approval", () => {
    expect(checkToolCall({ tool: "get_case", input: { order: "CD-420299" } }, POLICY_V1)).toEqual({ allowed: true })
  })

  it("refuses a tool it does not know", () => {
    const result = checkToolCall({ tool: "book_ferry_now", input: {} }, POLICY_V1)
    expect(result.allowed).toBe(false)
  })

  it("allows asking a driver or a site", () => {
    const ask = { order: "CD-420322", question: "Are you safe?", questions: ["Are you safe?"] }
    expect(checkToolCall({ tool: "message_driver", input: { ...ask, recipient_role: "driver" } }, POLICY_V1).allowed).toBe(true)
    expect(checkToolCall({ tool: "call_site", input: { ...ask, recipient_role: "pickup_site" } }, POLICY_V1).allowed).toBe(true)
  })

  it("never lets the agent contact a customer", () => {
    for (const role of ["customer", "handoff_contact", "dealer"]) {
      const result = checkToolCall({ tool: "call_site", input: { recipient_role: role } }, POLICY_V1)
      expect(result).toEqual({ allowed: false, reason: "The agent never contacts a customer. Draft it for a person to send." })
    }
  })

  it("lets the agent draft a customer update but only as a proposal", () => {
    const result = checkToolCall({ tool: "draft_customer_update", input: { body: "Delay expected" } }, POLICY_V1)
    expect(result).toEqual({ allowed: true, createsProposal: true })
  })

  it("turns every propose call into a proposal, never a change", () => {
    const result = checkToolCall({ tool: "propose_booking", input: { order: "CD-420299", option_id: "travel-1" } }, POLICY_V1)
    expect(result).toEqual({ allowed: true, createsProposal: true })
  })

  it("rejects invalid input before anything runs", () => {
    const result = checkToolCall({ tool: "propose_booking", input: {} }, POLICY_V1)
    expect(result.allowed).toBe(false)
  })
})

describe("guard: execution", () => {
  it("refuses to execute a proposal nobody approved", () => {
    expect(checkExecution({ action: "propose_booking", decision: null }, POLICY_V1).allowed).toBe(false)
  })

  it("refuses an approval that came from the agent", () => {
    const result = checkExecution({ action: "propose_booking", decision: { response: "go_ahead", actorType: "agent" } }, POLICY_V1)
    expect(result.allowed).toBe(false)
  })

  it("executes after a person says go ahead or changes it", () => {
    for (const response of ["go_ahead", "change_it"] as const) {
      expect(checkExecution({ action: "propose_hotel", decision: { response, actorType: "operator" } }, POLICY_V1).allowed).toBe(true)
    }
  })

  it("never executes after take over or not this", () => {
    for (const response of ["take_over", "not_this"] as const) {
      expect(checkExecution({ action: "propose_cost", decision: { response, actorType: "operator" } }, POLICY_V1).allowed).toBe(false)
    }
  })

  it("keeps customer messages with a person even if a policy tries to loosen them", () => {
    const loose = { ...POLICY_V1, approval: { ...POLICY_V1.approval, draft_customer_update: "auto" as const } }
    expect(checkExecution({ action: "draft_customer_update", decision: null }, loose).allowed).toBe(false)
  })

  it("lets a policy give the agent more freedom on other actions later", () => {
    const loose = { ...POLICY_V1, approval: { ...POLICY_V1.approval, propose_hotel: "auto" as const } }
    expect(checkExecution({ action: "propose_hotel", decision: null }, loose).allowed).toBe(true)
  })
})

describe("guard: who each tool may contact (code review)", () => {
  const call = (tool: string, recipient_role: string) => checkToolCall({ tool, input: { order: "CD-420299", recipient_role, question: "q", questions: ["q"] } }, POLICY_V1)

  it("lets message_driver and call_driver reach only the driver", () => {
    expect(call("message_driver", "driver").allowed).toBe(true)
    expect(call("message_driver", "site").allowed).toBe(false)
    expect(call("call_driver", "site").allowed).toBe(false)
  })

  it("lets call_site reach the pickup site or a travel provider, never a delivery site", () => {
    expect(call("call_site", "pickup_site").allowed).toBe(true)
    expect(call("call_site", "travel_provider").allowed).toBe(true)
    expect(call("call_site", "delivery_site")).toEqual({ allowed: false, reason: "The agent never contacts a customer. Draft it for a person to send." })
    expect(call("call_site", "driver").allowed).toBe(false)
  })
})
