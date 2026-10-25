import { describe, expect, it } from "vitest"
import { buildQueue, type PendingDecision } from "@/lib/control/queue"
import type { AttentionItem, BoardCard, KeyDate } from "@/lib/present/types"

const attention = (tone: AttentionItem["tone"], title: string, detail: string | null = null, owner: string | null = null): AttentionItem => ({
  kind: "alert", tone, title, short: title, detail, owner, at: "2026-10-21T07:00:00Z", atLabel: "raised", section: "alerts", recordId: "r",
})
const decisive = (start: string, label = "Pickup slot", note = "in 1 d"): KeyDate => ({
  key: "pickup_slot", label, start, end: null, zone: "Europe/Berlin", source: "OPS", tone: "neutral", note,
})
const card = (reference: string, over: Partial<BoardCard> = {}): BoardCard => ({
  id: reference, reference, displayLane: "booked", status: "WAITING_FOR_PICKUP", statusLabel: "Waiting for pickup",
  routeKind: "IMPORT", routeKindLabel: "Import", customer: "Kavellora Car House", customerTier: "key", vehicle: "BMW M4",
  vehicleMake: "BMW", plate: null, origin: "Leipzig, DE", destination: "Helsinki, FI",
  from: { city: "Leipzig", country: "DE" }, to: { city: "Helsinki", country: "FI" }, openAlerts: [], acknowledgedAlerts: [],
  attention: [], attentionTone: "ok", decisive: null, work: [], updatedAt: "2026-10-21T08:00:00Z", ...over,
})
const pending = (orderRef: string, over: Partial<PendingDecision> = {}): PendingDecision => ({
  id: `dec-${orderRef}`, orderRef, action: "propose_booking", headline: "Book travel: the Saturday 12:00 sailing", ...over,
})

describe("Today queue", () => {
  it("puts an order with a pending agent decision in Needs you, with the decision as the reason", () => {
    const { needsYou } = buildQueue([card("CD-1")], [pending("CD-1")])
    expect(needsYou[0]).toEqual(expect.objectContaining({
      reference: "CD-1", why: "Book travel: the Saturday 12:00 sailing", waitingOn: "Waiting on you",
      recommended: "Go ahead", decisionId: "dec-CD-1", car: "BMW M4", route: "Leipzig → Helsinki",
    }))
  })

  it("shows only the first sentence of a long agent headline as the reason", () => {
    const { needsYou } = buildQueue([card("CD-1")], [pending("CD-1", { headline: "Book travel: the Saturday sailing. It is quoted, not held, and the hotel is extra. The desk says vehicle space is open on the later sailing but it is not held, and the driver needs a hotel night." })])
    expect(needsYou[0].why).toBe("Book travel: the Saturday sailing.")
  })

  it("leads with the agent's hand-over when an order also has a drafted customer update", () => {
    const { needsYou } = buildQueue([card("CD-1")], [
      pending("CD-1", { id: "e", action: "escalate", headline: "Owner must choose recovery." }),
      pending("CD-1", { id: "d", action: "draft_customer_update", headline: "Send the customer an update: Hello there." }),
    ])
    expect(needsYou[0].why).toBe("Owner must choose recovery.")
    expect(needsYou[0].recommended).toBe("Take over")
  })

  it("recommends taking over when the agent escalated", () => {
    const { needsYou } = buildQueue([card("CD-1")], [pending("CD-1", { action: "escalate", headline: "Owner must choose recovery." })])
    expect(needsYou[0].recommended).toBe("Take over")
  })

  it("includes danger and warning items from the records, in plain words, and folds the rest away", () => {
    const { needsYou, quiet } = buildQueue(
      [
        card("CD-2", { attention: [attention("danger", "Incident: Travel capacity", "Awaiting decision", "Driver travel")], attentionTone: "danger" }),
        card("CD-3", { attention: [attention("neutral", "Open conversation")], attentionTone: "neutral" }),
        card("CD-4"),
      ],
      [],
    )
    expect(needsYou.map((q) => q.reference)).toEqual(["CD-2"])
    expect(needsYou[0].why).toBe("Travel capacity. Awaiting decision.")
    expect(needsYou[0].waitingOn).toBe("Driver travel")
    expect(needsYou[0].recommended).toBe("Open")
    expect(quiet.map((q) => q.reference).sort()).toEqual(["CD-3", "CD-4"])
  })

  it("orders pending decisions first, then danger before warning, then the nearest deadline", () => {
    const { needsYou } = buildQueue(
      [
        card("W-late", { attention: [attention("warn", "w")], attentionTone: "warn", decisive: decisive("2026-10-25T09:00:00Z") }),
        card("W-soon", { attention: [attention("warn", "w")], attentionTone: "warn", decisive: decisive("2026-10-22T09:00:00Z") }),
        card("D", { attention: [attention("danger", "d")], attentionTone: "danger" }),
        card("P"),
      ],
      [pending("P")],
    )
    expect(needsYou.map((q) => q.reference)).toEqual(["P", "D", "W-soon", "W-late"])
  })

  it("shows the deadline that decides the order in plain words", () => {
    const { needsYou } = buildQueue([card("CD-1", { decisive: decisive("2026-10-23T09:00:00Z", "Pickup slot", "in 2 d") })], [pending("CD-1")])
    expect(needsYou[0].deadline).toEqual({ label: "Pickup slot", at: "2026-10-23T09:00:00Z", note: "in 2 d" })
  })

  it("only treats upcoming work as a deadline, not when the order was created or delivered", () => {
    const created: KeyDate = { ...decisive("2026-10-08T09:00:00Z", "Order created", "13 d ago"), key: "created" }
    const { needsYou } = buildQueue([card("CD-1", { decisive: created })], [pending("CD-1")])
    expect(needsYou[0].deadline).toBeNull()
  })

  it("does not repeat the label when the note already says it", () => {
    const passed = decisive("2026-10-20T09:00:00Z", "Pickup slot", "slot has passed and no pickup is recorded")
    const { needsYou } = buildQueue([card("CD-1", { decisive: passed })], [pending("CD-1")])
    expect(needsYou[0].deadline).toEqual({ label: "Pickup slot", at: "2026-10-20T09:00:00Z", note: "passed, no pickup recorded" })
  })

  it("never shows a raw record id as the reason", () => {
    const { needsYou } = buildQueue([card("CD-1", { attention: [attention("danger", "Agent action failed", "agent-x4ac988b20000595f timed out")], attentionTone: "danger" })], [])
    expect(needsYou[0].why).not.toMatch(/agent-x[0-9a-f]+/)
  })
})

describe("Today queue with Watch", () => {
  it("shows a ferry check-in as the deadline when it closes before the card's own date", () => {
    const { needsYou } = buildQueue(
      [card("CD-1", { attention: [attention("warn", "w")], attentionTone: "warn", decisive: decisive("2026-10-23T10:00:00Z", "Delivery promise", "in 2 d") })],
      [],
      { "CD-1": { level: "watch", cutoff: { at: "2026-10-21T12:00:00Z", minutes: 180 } } },
    )
    expect(needsYou[0].deadline).toEqual({ label: "Ferry check-in", at: "2026-10-21T12:00:00Z", note: "closes in 3 h" })
    expect(needsYou[0].headsUp).toBe(true)
  })

  it("lists every order under All, urgent first", () => {
    const { all } = buildQueue([card("Q"), card("U", { attention: [attention("danger", "d")], attentionTone: "danger" })], [])
    expect(all.map((a) => a.reference)).toEqual(["U", "Q"])
  })

  it("cleans the reason and marks unconfirmed sources", () => {
    const { needsYou } = buildQueue([card("CD-1", { attention: [attention("warn", "Open alert: Ferry connection risk", "Review ferry cutoff for CD-1; source is a conversation, not a verified outcome.")], attentionTone: "warn" })], [])
    expect(needsYou[0].why).toBe("Ferry connection risk. Review ferry cutoff.")
    expect(needsYou[0].notConfirmed).toBe(true)
  })

  it("says Unassigned instead of Nobody named", () => {
    const { needsYou } = buildQueue([card("CD-1", { attention: [attention("warn", "w")], attentionTone: "warn" })], [])
    expect(needsYou[0].waitingOn).toBe("Unassigned")
  })
})
