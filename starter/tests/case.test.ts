import { describe, expect, it } from "vitest"
import { buildCase, type CaseInput } from "@/lib/control/case"

const base: CaseInput = { reference: "CD-420299", decisions: [], runs: [], chain: [] }

describe("case view (ADR-013)", () => {
  const view = buildCase(base)!

  it("uses the newest open alert as the headline", () => {
    expect(buildCase({ ...base, reference: "CD-420322" })!.headline).toBe("Driver reports a red warning and has stopped safely. Diagnosis and recovery remain open.")
  })

  it("names Bahn's existing agents by their own title, not as BahnBot", () => {
    const packetAgent = buildCase({ ...base, reference: "CD-420322" })!.thread.find((t) => t.actor === "agent")
    expect(packetAgent?.who).toBe("Journey monitor")
  })

  it("shows a fact that arrived after the snapshot, with its source", () => {
    const view = buildCase({ ...base, incoming: [{ text: "The desk holds no reservation.", source: "provider desk (recorded follow-up)", at: "2026-10-21T09:05:00.000Z" }] })!
    expect(view.thread.at(-1)).toEqual(expect.objectContaining({ text: "The desk holds no reservation.", who: "provider desk (recorded follow-up)" }))
    expect(view.facts.find((f) => f.label === "New since the snapshot")?.evidence.label).toBe("provider desk (recorded follow-up)")
  })

  it("shows what Bahn's own agents proposed or tried, open items only", () => {
    expect(view.agentWork).toEqual([
      expect.objectContaining({ status: "Failed", text: "Attempt to book the next-day quoted vehicle crossing.", detail: expect.stringMatching(/timed out/) }),
      expect.objectContaining({ status: "Waiting for review", by: "Travel planning agent" }),
    ])
  })

  it("words the deadline the same way as the queue: when the window opens and closes", () => {
    const v = buildCase({ ...base, reference: "CD-420322" })!
    expect(v.properties[0]).toEqual({ label: "Deadline", value: "Delivery 21 Oct 12:00–16:00 CEST · opens in 1 h, closes in 5 h" })
  })

  it("names the provider and uses local time for a booked ferry", () => {
    const v = buildCase({ ...base, reference: "CD-420603" })!
    const ferry = v.facts.find((f) => f.label === "Booked ferry")!
    expect(ferry.value).toBe("West Baltic Vehicle Terminal, departs 21 Oct 16:00 CEST")
  })

  it("returns null for an unknown order", () => {
    expect(buildCase({ ...base, reference: "CD-999999" })).toBeNull()
  })

  it("names the car, route, customer and driver", () => {
    expect(view.car).toBe("BMW M4")
    expect(view.route).toBe("Leipzig → Helsinki")
    expect(view.customer).toBe("Kavellora Car House")
    expect(view.driver).toBeTruthy()
  })

  it("has a one-sentence headline from the records when the agent has not run", () => {
    expect(view.headline).toBe("Current crossing is unavailable; alternative and customer promise need a decision.")
  })

  it("merges messages and alerts into one thread, oldest first, each with an actor and evidence", () => {
    const actors = new Set(view.thread.map((t) => t.actor))
    expect(actors).toEqual(new Set(["driver", "ops", "customer", "system"]))
    const times = view.thread.map((t) => t.at)
    expect([...times].sort()).toEqual(times)
    expect(view.thread.every((t) => t.evidence.label)).toBe(true)
  })

  it("gives every fact an evidence chip, and keeps a quote apart from a booking", () => {
    expect(view.facts.length).toBeGreaterThan(3)
    expect(view.facts.every((f) => f.evidence && f.evidence.label && f.evidence.at !== undefined)).toBe(true)
    const crossing = view.facts.find((f) => f.label === "Later crossing")
    expect(crossing?.evidence.label).toBe("quoted by provider, not booked")
  })

  it("shows the delivery promise with who set it", () => {
    const promise = view.facts.find((f) => f.label === "Delivery promise")
    expect(promise?.evidence.label).toBe("customer said")
  })

  it("lists properties without raw ids", () => {
    expect(view.properties.map((p) => p.label)).toEqual(["Deadline", "Driver", "Route", "Car", "Pickup place", "Customer"])
    expect(JSON.stringify(view.properties)).not.toMatch(/(drv|cus|site|ord)-\d/)
  })

  it("builds a decision card from a pending agent proposal with the change, cost, who is told and each response's effect", () => {
    const withDecision = buildCase({
      ...base,
      decisions: [{
        id: "dec-1", action: "propose_booking", status: "PROPOSED", headline: "Book travel: the Saturday 12:00 sailing",
        payload: { option_id: "travel-xf29ed1732d895f37" }, blockers: [], evidence: [{ strength: "observed", label: "provider desk replied (mock)", at: "2026-10-21T09:01:00Z" }],
        effect: null, reason: null, decidedBy: null, decidedAt: null, undoUntil: null, response: null, createdAt: "2026-10-21T09:04:00Z",
      }],
    })!
    const card = withDecision.decision!
    expect(card.headline).toBe("Book travel: the Saturday 12:00 sailing")
    expect(card.change).toEqual(["Book Vela Coast Lines, West Baltic terminal → South Finland terminal", "Departs 24 Oct 14:00 CEST, check-in closes 24 Oct 12:00 CEST"])
    expect(card.cost).toEqual({ cents: 38700, currency: "EUR", note: "quoted at the last check, not yet booked" })
    expect(card.whoIsTold).toBe("The driver gets the new sailing in the app. The customer hears nothing until you approve an update.")
    expect(Object.keys(card.effects)).toEqual(["go_ahead", "change_it", "take_over", "not_this"])
    expect(withDecision.headline).toBe("Book travel: the Saturday 12:00 sailing")
  })

  it("keeps a long agent headline short at the top, with the full text under the card's title", () => {
    const full = "Book travel: Overnight sailing 23 Oct is sold out. The provider confirmed there is no reservation and no charge. The desk says vehicle space is open on the later sailing but it is not held, and the driver needs a hotel night."
    const view = buildCase({
      ...base,
      decisions: [{
        id: "dec-2", action: "propose_booking", status: "PROPOSED", headline: full,
        payload: {}, blockers: [], evidence: [],
        effect: null, reason: null, decidedBy: null, decidedAt: null, undoUntil: null, response: null, createdAt: "2026-10-21T09:04:00Z",
      }],
    })!
    expect(view.headline).toBe("Book travel: Overnight sailing 23 Oct is sold out.")
    expect(view.decision!.headline).toBe("Book travel: Overnight sailing 23 Oct is sold out.")
    expect(view.decision!.detail).toBe("The provider confirmed there is no reservation and no charge. The desk says vehicle space is open on the later sailing but it is not held, and the driver needs a hotel night.")
  })

  const dec = (id: string, action: string, headline: string) => ({
    id, action, status: "PROPOSED", headline, payload: action === "draft_customer_update" ? { body: "Hello, thank you for your reply." } : {},
    blockers: [], evidence: [], effect: null, reason: null, decidedBy: null, decidedAt: null, undoUntil: null, response: null, createdAt: "2026-10-21T09:04:00Z",
  })

  it("puts the agent's hand-over ahead of a drafted customer update, and titles the draft plainly", () => {
    const view = buildCase({ ...base, decisions: [dec("d-1", "draft_customer_update", "Send the customer an update: Hello, thank you for your reply."), dec("e-1", "escalate", "The owner has to decide how the car is handled.")] })!
    expect(view.decision!.action).toBe("escalate")
    expect(view.history).toHaveLength(1)
    const draft = buildCase({ ...base, decisions: [dec("d-1", "draft_customer_update", "Send the customer an update: Hello, thank you for your reply.")] })!.decision!
    expect(draft.headline).toBe("Review a drafted customer update")
    expect(draft.change).toEqual(["Hello, thank you for your reply."])
  })

  it("heads the case with the situation from the agent's summary, not the decision it proposes", () => {
    const run = { id: "r", trigger: "on_the_road", mode: "recorded", startedAt: "2026-10-21T09:00:00Z", steps: [] }
    const view = buildCase({ ...base, decisions: [dec("b-1", "propose_booking", "Book travel: the Saturday sailing")],
      runs: [{ ...run, summary: "CD-420299: the overnight sailing is sold out and nothing is booked for CD-420299. The provider holds nothing." }] })!
    expect(view.headline).toBe("The overnight sailing is sold out and nothing is booked.")
    const vague = buildCase({ ...base, decisions: [dec("b-1", "propose_booking", "Book travel: the Saturday sailing")],
      runs: [{ ...run, summary: "CD-420299 is still open. More text." }] })!
    expect(vague.headline).toBe("Book travel: the Saturday sailing")
    const watched = buildCase({ ...base, watchLine: "The overnight ferry is sold out and the later sailing is only quoted.", decisions: [dec("b-1", "propose_booking", "Book travel: the Saturday sailing")],
      runs: [{ ...run, summary: "CD-420299 is still open. More text." }] })!
    expect(watched.headline).toBe("The overnight ferry is sold out and the later sailing is only quoted.")
  })

  it("keeps an approval in flight on top, and orders same-rank proposals by id", () => {
    const booking = { ...dec("dec-run-1", "propose_booking", "Book travel: the Saturday sailing"), status: "APPROVED" }
    const hotel = dec("dec-run-2", "propose_hotel", "Book a hotel night")
    const cost = dec("dec-run-3", "propose_cost", "Approve a cost")
    expect(buildCase({ ...base, decisions: [cost, hotel, booking] })!.decision!.id).toBe("dec-run-1")
    expect(buildCase({ ...base, decisions: [cost, hotel] })!.decision!.id).toBe("dec-run-2")
  })
})
