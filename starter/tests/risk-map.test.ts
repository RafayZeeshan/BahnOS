import { describe, expect, it } from "vitest"
import { orderPlaces } from "@/lib/opsmap/places"
import { buildRiskMap } from "@/lib/opsmap/risk"
import { CITY } from "@/lib/opsmap/ops"
import { POLICY_V1 } from "@/lib/policy/defaults"
import { failureSources, type FailureSource } from "@/lib/risk/sources"

const source = (key: string, refs: string[], over: Partial<FailureSource> = {}): FailureSource => ({
  kind: "route", key, label: `${key} route`, k: 2, n: 9, rate: 0.22, base: 0.1, shrunk: 0.18, elevated: false, maturity: "small_sample",
  sentence: "", upcoming: { orders: refs.length, drivers: 0, refs }, examples: [], dashboard: true, ...over,
})
const places = { "CD-1": { from: "Hamburg", to: "Helsinki" }, "CD-2": { from: "Lyon", to: "Lahti" }, "CD-3": { from: "Nowhere", to: "Helsinki" } }

describe("risk map (Risk outlook, on the map)", () => {
  it("draws each exposed order once, with every source it leans on and its worst risk", () => {
    const map = buildRiskMap([source("DE→FI", ["CD-1"]), source("ferry", ["CD-1", "CD-2"], { kind: "mode", shrunk: 0.3 })], places, CITY)
    expect(map.lanes).toEqual([
      expect.objectContaining({ ref: "CD-1", from: "Hamburg", to: "Helsinki", sources: ["route:DE→FI", "mode:ferry"], heat: 0.3 }),
      expect.objectContaining({ ref: "CD-2", sources: ["mode:ferry"], heat: 0.3 }),
    ])
    expect(map.sources.map((s) => s.id)).toEqual(["route:DE→FI", "mode:ferry"])
    expect(map.cities.Hamburg).toEqual(CITY.Hamburg)
  })

  it("leaves out an order whose city it cannot place, and says how many", () => {
    const map = buildRiskMap([source("x", ["CD-3", "CD-1"])], places, CITY)
    expect(map.lanes.map((l) => l.ref)).toEqual(["CD-1"])
    expect(map.unplaced).toBe(1)
  })

  it("places nearly every order the packet's risk sources lean on", () => {
    const sources = failureSources(POLICY_V1, "2026-10-21T09:00:00.000Z")
    const refs = [...new Set(sources.flatMap((s) => s.upcoming.refs))]
    const map = buildRiskMap(sources, orderPlaces(), CITY)
    expect(refs.length).toBeGreaterThan(10)
    expect(map.lanes.length).toBeGreaterThanOrEqual(refs.length - 3)
  })
})
