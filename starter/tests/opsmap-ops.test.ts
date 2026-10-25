import { describe, expect, it } from "vitest"
import { buildOps, type Need } from "@/lib/opsmap/ops"

describe("ops map model on the packet (ADR-017)", () => {
  const need: Need = { level: "critical", badge: "Needs you", why: { headline: "Owner must decide.", detail: null, blockedOn: "you" }, next: null }
  const model = buildOps(new Map([["CD-420322", need]]))

  it("draws every order as a lane between known cities", () => {
    expect(model.orders).toHaveLength(100)
    const drawn = model.orders.filter((o) => model.cities[o.from] && model.cities[o.to])
    expect(drawn.length).toBeGreaterThan(90)
  })

  it("colours an order from BahnOS's queue, and others from their own records", () => {
    const bentley = model.orders.find((o) => o.ref === "CD-420322")!
    expect(bentley).toEqual(expect.objectContaining({ risk: "critical", needsYou: true, badge: "Needs you", why: need.why }))
    expect(model.orders.filter((o) => o.needsYou)).toHaveLength(1)
    expect(new Set(model.orders.map((o) => o.risk))).toEqual(new Set(["critical", "warn", "moving", "done", "idle"]))
  })

  it("keeps who said what, and the event log, at or before the snapshot", () => {
    const bentley = model.orders.find((o) => o.ref === "CD-420322")!
    expect(bentley.story.length).toBeGreaterThan(0)
    expect(bentley.story.some((s) => s.actor === "agent" && s.who === "Journey monitor")).toBe(true)
    expect(model.events.every((e) => e.t <= model.snapshot)).toBe(true)
  })
})
