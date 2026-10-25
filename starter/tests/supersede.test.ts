import { describe, expect, it } from "vitest"
import { staleProposals } from "@/lib/decisions/supersede"

const row = (id: string, runId: string, action: string, createdAt: string, over: { orderRef?: string; status?: string } = {}) =>
  ({ id, runId, orderRef: over.orderRef ?? "CD-1", action, status: over.status ?? "PROPOSED", createdAt: new Date(createdAt) })

describe("one run's open BahnBot proposals per kind of action on an order", () => {
  it("retires older runs' open proposals of a kind, naming the newer proposal that replaced them", () => {
    expect(staleProposals([
      row("a", "ask-1", "propose_booking", "2026-10-21T09:06:00Z"),
      row("b", "run-2", "propose_booking", "2026-10-21T09:08:00Z"),
      row("c", "ask-3", "propose_booking", "2026-10-21T09:06:40Z", { status: "SNOOZED" }),
    ])).toEqual([{ id: "a", by: "b" }, { id: "c", by: "b" }])
  })

  it("keeps every proposal of the newest run, even two of the same kind", () => {
    expect(staleProposals([
      row("a", "run-2", "propose_booking", "2026-10-21T09:08:00Z"),
      row("b", "run-2", "propose_booking", "2026-10-21T09:08:00Z"),
    ])).toEqual([])
  })

  it("leaves different kinds of action, and other orders, alone", () => {
    expect(staleProposals([
      row("a", "ask-1", "propose_booking", "2026-10-21T09:06:00Z"),
      row("b", "run-2", "propose_hotel", "2026-10-21T09:08:00Z"),
      row("c", "run-3", "propose_booking", "2026-10-21T09:08:00Z", { orderRef: "CD-2" }),
    ])).toEqual([])
  })

  it("never touches a decision a person already made", () => {
    expect(staleProposals([
      row("a", "ask-1", "propose_booking", "2026-10-21T09:06:00Z", { status: "EXECUTED" }),
      row("b", "run-2", "propose_booking", "2026-10-21T09:08:00Z"),
    ])).toEqual([])
  })

  it("breaks a tie on time by id, so the result never depends on read order", () => {
    expect(staleProposals([row("b", "run-b", "escalate", "2026-10-21T09:06:00Z"), row("a", "run-a", "escalate", "2026-10-21T09:06:00Z")]))
      .toEqual([{ id: "a", by: "b" }])
  })
})
