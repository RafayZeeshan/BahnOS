import { describe, expect, it } from "vitest"
import { sweep } from "@/lib/watch/sweep"
import { POLICY_V1 } from "@/lib/policy/defaults"

const NOW = "2026-10-21T09:00:00.000Z"

describe("Watch sweep (ADR-008)", () => {
  const cards = sweep(POLICY_V1, NOW)

  it("flags at least three orders from real signals, and leaves the rest alone", () => {
    expect(cards.length).toBeGreaterThanOrEqual(3)
    expect(cards.length).toBeLessThan(20)
    expect(cards.every((c) => (c.level as string) !== "fine")).toBe(true)
  })

  it("puts likely-to-slip first", () => {
    const levels = cards.map((c) => c.level)
    expect(levels.indexOf("watch")).toBeGreaterThan(levels.lastIndexOf("likely_to_slip"))
  })

  it("shows the slack for a cutoff in plain words, with a bar", () => {
    const card = cards.find((c) => c.order === "CD-420603")!
    expect(card.slack).toEqual({ minutes: 180, of: 180, label: "3 h 0 m to check-in" })
    expect(card.bullets).toContain("Ferry check-in closes in 3 h 0 m.")
  })

  it("adds the driver's own words as a claim when they explain the risk", () => {
    const card = cards.find((c) => c.order === "CD-420603")!
    expect(card.claims[0]).toEqual(expect.objectContaining({ text: expect.stringMatching(/queue/), label: "driver said" }))
  })

  it("writes a one-line warning from the signals when no model wrote one", () => {
    const card = cards.find((c) => c.order === "CD-420299")!
    expect(card.line).toBe("The planned crossing is sold out and nothing is booked. A booking attempt timed out with no confirmation.")
    expect(card.lineSource).toBe("template")
  })

  it("uses the model's line when a recorded run wrote one", () => {
    const withLine = sweep(POLICY_V1, NOW, { "CD-420603": "Check-in closes at 14:00 local and the driver is still in the queue." })
    const card = withLine.find((c) => c.order === "CD-420603")!
    expect(card.line).toBe("Check-in closes at 14:00 local and the driver is still in the queue.")
    expect(card.lineSource).toBe("model")
  })

  it("names the car and route, never a driver ranking", () => {
    const card = cards.find((c) => c.order === "CD-420299")!
    expect(card.car).toBe("BMW M4")
    expect(card.route).toBe("Leipzig → Helsinki")
    expect(JSON.stringify(cards)).not.toMatch(/drv-\d+/)
  })
})
