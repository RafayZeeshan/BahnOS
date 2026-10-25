import { describe, expect, it } from "vitest"
import type { PendingDecision, QueueItem } from "@/lib/control/queue"
import { botQueue, buildNeeds } from "@/lib/opsmap/needs"

const item = (reference: string, over: Partial<QueueItem> = {}): QueueItem => ({
  reference, car: "BMW M4", route: "Leipzig → Helsinki", customer: "Kavellora", why: "Ferry sold out.", deadline: null,
  waitingOn: "Waiting on you", recommended: "Go ahead", decisionId: `dec-${reference}`, tone: "warn", notConfirmed: false, headsUp: false, ...over,
})
const pending = (orderRef: string, over: Partial<PendingDecision> = {}): PendingDecision => ({
  id: `dec-${orderRef}`, orderRef, action: "propose_booking", headline: "Book travel: the Saturday sailing. It is quoted only.", ...over,
})

describe("ops map needs (ADR-017)", () => {
  it("marks an order in Needs you, with Watch's line as the reason and BahnBot's proposal as the next decision", () => {
    const needs = buildNeeds({ needsYou: [item("CD-1")], watch: {}, lines: { "CD-1": "The overnight ferry is sold out." }, pending: [pending("CD-1")] })
    expect(needs.get("CD-1")).toEqual({
      level: "warn", badge: "Needs you",
      why: { headline: "The overnight ferry is sold out.", detail: null, blockedOn: "you" },
      next: { title: "Book travel: the Saturday sailing. It is quoted only.", because: null, who: "NEEDS_APPROVAL", owner: null, scope: null },
    })
  })

  it("makes a hand-over or a danger item critical, and a hand-over needs a person", () => {
    const needs = buildNeeds({ needsYou: [item("CD-2"), item("CD-3", { tone: "danger", decisionId: null })], watch: {}, lines: {},
      pending: [pending("CD-2", { action: "escalate", headline: "Owner must choose recovery." }), pending("CD-2", { id: "d", action: "draft_customer_update", headline: "Send: Hello" })] })
    expect(needs.get("CD-2")).toEqual(expect.objectContaining({ level: "critical", next: expect.objectContaining({ title: "Owner must choose recovery.", who: "NEEDS_PERSON" }) }))
    expect(needs.get("CD-3")).toEqual(expect.objectContaining({ level: "critical", next: null, why: expect.objectContaining({ headline: "Ferry sold out." }) }))
  })

  it("adds Heads-up orders that are not in Needs you, as a warning with no decision", () => {
    const needs = buildNeeds({ needsYou: [], watch: { "CD-4": "watch" }, lines: { "CD-4": "Check-in closes in 3 h." }, pending: [] })
    expect(needs.get("CD-4")).toEqual({ level: "warn", badge: "Heads-up", why: { headline: "Check-in closes in 3 h.", detail: null, blockedOn: null }, next: null })
  })

  it("lists BahnBot's open decisions, hand-overs first, drafts titled plainly", () => {
    const list = botQueue([pending("CD-5", { action: "draft_customer_update", headline: "Send the customer an update: Hello" }), pending("CD-6", { action: "escalate", headline: "Owner must decide." })])
    expect(list.map((b) => [b.ref, b.title, b.who])).toEqual([
      ["CD-6", "Owner must decide.", "NEEDS_PERSON"],
      ["CD-5", "Review a drafted customer update", "NEEDS_APPROVAL"],
    ])
  })
})
