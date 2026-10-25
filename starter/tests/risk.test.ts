import { describe, expect, it } from "vitest"
import { attributeMishaps } from "@/lib/risk/attribute"
import { failureSources } from "@/lib/risk/sources"
import { POLICY_V1 } from "@/lib/policy/defaults"

const NOW = "2026-10-21T09:00:00.000Z"

describe("root-cause attribution (ADR-009)", () => {
  const mishaps = attributeMishaps()
  const causesOf = (order: string) => [...new Set(mishaps.filter((m) => m.order === order).map((m) => m.cause))].sort()

  it("finds the mishap orders and gives every mishap a cause", () => {
    const orders = new Set(mishaps.map((m) => m.order))
    expect(orders.size).toBe(21)
    expect(mishaps.every((m) => ["route", "mode", "vehicle", "dealership", "unclear"].includes(m.cause))).toBe(true)
  })

  it("attributes by rule and cites the record", () => {
    expect(causesOf("CD-420299")).toEqual(["mode"])
    expect(causesOf("CD-420322")).toEqual(["route", "vehicle"])
    const stop = mishaps.find((m) => m.order === "CD-420322" && m.signal === "SAFETY_STOP")!
    expect(stop.evidence).toEqual(expect.objectContaining({ label: "system alert" }))
    expect(stop.attributedBy).toBe("rule")
  })

  it("keeps a driver's illness as unclear, never as a driver problem", () => {
    expect(causesOf("CD-420449")).toEqual(["unclear"])
  })
})

describe("failure sources (ADR-009)", () => {
  const sources = failureSources(POLICY_V1, NOW)
  const find = (kind: string, key: string) => sources.find((s) => s.kind === kind && s.key === key)!

  it("counts k of n per route, using only route and mode mishaps", () => {
    // A third FR → FI order had a problem of another kind, which does not count against the route.
    const frFi = find("route", "FR → FI")
    expect([frFi.k, frFi.n]).toEqual([2, 3])
  })

  it("shrinks a small record toward the overall rate", () => {
    const frFi = find("route", "FR → FI")
    expect(frFi.rate).toBeCloseTo(2 / 3)
    expect(frFi.shrunk).toBeLessThan(frFi.rate)
    expect(frFi.shrunk).toBeGreaterThan(frFi.base)
  })

  it("counts a mode problem only against that mode", () => {
    expect(find("mode", "train").k).toBe(0)
    expect(find("mode", "ferry").k).toBeGreaterThan(0)
  })

  it("counts a make's record from vehicle mishaps only", () => {
    const porsche = find("make", "Porsche")
    expect(porsche.n).toBe(21)
    expect(porsche.k).toBeLessThanOrEqual(1)
  })

  it("says too few to say under the minimum sample, and keeps those off the dashboard", () => {
    const tiny = sources.find((s) => s.n < 3)!
    expect(tiny.maturity).toBe("too_few")
    expect(tiny.sentence).toMatch(/too few to say/)
    expect(sources.filter((s) => s.dashboard).every((s) => s.n >= 3)).toBe(true)
  })

  it("writes k of n in plain words, never a bare percentage", () => {
    const frFi = find("route", "FR → FI")
    expect(frFi.sentence).toBe("2 of 3 orders on this route had a problem (small sample).")
    expect(sources.map((s) => s.sentence).join(" ")).not.toMatch(/%/)
  })

  it("counts upcoming orders exposed, and drivers only as a number", () => {
    const frFi = find("route", "FR → FI")
    expect(frFi.upcoming.orders).toBeGreaterThanOrEqual(0)
    expect(typeof frFi.upcoming.drivers).toBe("number")
    expect(JSON.stringify(sources)).not.toMatch(/drv-\d+/)
  })

  it("orders the dashboard by how elevated the source is", () => {
    const dash = sources.filter((s) => s.dashboard)
    const scores = dash.map((s) => s.shrunk)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })
})
