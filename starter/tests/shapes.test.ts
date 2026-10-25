import { describe, expect, it } from "vitest"
import { buildRoute } from "@/lib/geo/route"
import { legShape, legStyle } from "@/lib/geo/shapes"

describe("map shapes (ADR-012)", () => {
  const route = buildRoute("CD-420299")!

  it("draws a road leg as a line between its stops", () => {
    const shape = legShape(route.legs[0])
    expect(shape[0]).toEqual([route.legs[0].from.lat, route.legs[0].from.lon])
    expect(shape.at(-1)).toEqual([route.legs[0].to.lat, route.legs[0].to.lon])
  })

  it("draws a ferry as a sea arc that bends away from the straight line", () => {
    const leg = route.legs[1]
    const shape = legShape(leg)
    expect(shape.length).toBeGreaterThan(10)
    const mid = shape[Math.floor(shape.length / 2)]
    const straight = [(leg.from.lat + leg.to.lat) / 2, (leg.from.lon + leg.to.lon) / 2]
    expect(Math.hypot(mid[0] - straight[0], mid[1] - straight[1])).toBeGreaterThan(0.3)
  })

  it("styles legs by evidence: booked solid, quoted dashed, estimated dotted", () => {
    expect(legStyle({ ...route.legs[1], status: "booked" }).dashArray).toBeUndefined()
    expect(legStyle(route.legs[1]).dashArray).toBe("8 6")
    expect(legStyle(route.legs[2]).dashArray).toBe("2 6")
  })
})
