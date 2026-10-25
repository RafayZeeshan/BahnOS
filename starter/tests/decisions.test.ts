import { describe, expect, it } from "vitest"
import { respond, startExecution, finishExecution, undo, type DecisionState } from "@/lib/decisions/machine"
import { execute } from "@/lib/decisions/executor"
import { stamp, SNAPSHOT_AT } from "@/lib/clock"

const T0 = "2026-10-21T09:05:00.000Z"
const later = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString()
const proposed: DecisionState = { status: "PROPOSED", action: "propose_hotel", undoUntil: null }
const person = { actor: "ops-anna", actorType: "operator" }

describe("decision state machine (ADR-006)", () => {
  it("go ahead approves with a 5-second undo window", () => {
    const r = respond(proposed, { response: "go_ahead", ...person, at: T0 })
    expect(r).toEqual({ ok: true, state: { status: "APPROVED", action: "propose_hotel", undoUntil: later(T0, 5) }, intervention: null })
  })

  it("change it, take over and not this each need a reason and record an intervention", () => {
    for (const response of ["change_it", "take_over", "not_this"] as const) {
      expect(respond(proposed, { response, ...person, at: T0 })).toEqual({ ok: false, error: "Say why, so the agent can learn from it." })
      const r = respond(proposed, { response, reason: "Hotel too far from terminal", ...person, at: T0 })
      expect(r.ok && r.intervention).toEqual({ response, reason: "Hotel too far from terminal", actor: "ops-anna", at: T0 })
    }
  })

  it("maps each response to its state", () => {
    const status = (response: "change_it" | "take_over" | "not_this") => {
      const r = respond(proposed, { response, reason: "x", ...person, at: T0 })
      return r.ok ? r.state.status : null
    }
    expect(status("change_it")).toBe("APPROVED")
    expect(status("take_over")).toBe("TAKEN_OVER")
    expect(status("not_this")).toBe("DECLINED")
  })

  it("snoozes and reopens", () => {
    const r = respond(proposed, { response: "snooze", ...person, at: T0 })
    expect(r.ok && r.state.status).toBe("SNOOZED")
  })

  it("refuses decisions from the agent", () => {
    expect(respond(proposed, { response: "go_ahead", actor: "travel-agent", actorType: "agent", at: T0 })).toEqual({
      ok: false, error: "Only a person can approve this.",
    })
  })

  it("refuses to decide twice", () => {
    const approved: DecisionState = { status: "APPROVED", action: "propose_hotel", undoUntil: later(T0, 5) }
    expect(respond(approved, { response: "not_this", reason: "x", ...person, at: T0 }).ok).toBe(false)
  })

  it("undo works only inside the window, and returns the proposal", () => {
    const approved: DecisionState = { status: "APPROVED", action: "propose_hotel", undoUntil: later(T0, 5) }
    expect(undo(approved, later(T0, 3))).toEqual({ ok: true, state: { ...approved, status: "PROPOSED", undoUntil: null } })
    expect(undo(approved, later(T0, 6)).ok).toBe(false)
  })

  it("executes only after the undo window, then finishes as executed or failed", () => {
    const approved: DecisionState = { status: "APPROVED", action: "propose_hotel", undoUntil: later(T0, 5) }
    expect(startExecution(approved, later(T0, 2)).ok).toBe(false)
    const started = startExecution(approved, later(T0, 6))
    expect(started.ok && started.state.status).toBe("EXECUTING")
    if (!started.ok) return
    expect(finishExecution(started.state, true).state.status).toBe("EXECUTED")
    expect(finishExecution(started.state, false).state.status).toBe("FAILED")
  })

  it("an escalation can be taken over or set aside, but not 'gone ahead' with", () => {
    const esc: DecisionState = { status: "PROPOSED", action: "escalate", undoUntil: null }
    expect(respond(esc, { response: "go_ahead", ...person, at: T0 }).ok).toBe(false)
    expect(respond(esc, { response: "take_over", reason: "Calling the owner", ...person, at: T0 }).ok).toBe(true)
  })
})

describe("mock executor", () => {
  it("re-checks blockers before writing and fails if the crossing is now sold out", () => {
    const result = execute({ action: "propose_booking", order: "CD-420299", payload: { option_id: "travel-xc1d8163d5443a606" } })
    expect(result.ok).toBe(false)
    expect(result.effect.summary).toBe("Not booked: The selected crossing is sold out.")
    expect(result.next).toEqual([])
  })

  it("books a quoted crossing and opens the next steps in the chain", () => {
    const result = execute({ action: "propose_booking", order: "CD-420299", payload: { option_id: "travel-xf29ed1732d895f37" } })
    expect(result.ok).toBe(true)
    expect(result.effect.summary).toBe("Booked Vela Coast Lines West Baltic terminal to South Finland terminal, departing 24 Oct 14:00 CEST.")
    expect(result.effect.reference).toMatch(/^MOCK-/)
    expect(result.next).toEqual(["Tell the driver the new sailing and check-in time", "Confirm the delivery window still holds"])
  })

  it("never sends a customer message itself; it hands the draft to a person", () => {
    const result = execute({ action: "draft_customer_update", order: "CD-420299", payload: { body: "Hi" } })
    expect(result.effect.summary).toBe("Draft approved. A person sends it from the customer thread.")
  })
})

describe("stamp", () => {
  it("starts at the snapshot and only moves forward", () => {
    const a = stamp()
    const b = stamp()
    expect(Date.parse(a.toISOString())).toBeGreaterThanOrEqual(Date.parse(SNAPSHOT_AT))
    expect(b.getTime()).toBeGreaterThanOrEqual(a.getTime())
  })
})
