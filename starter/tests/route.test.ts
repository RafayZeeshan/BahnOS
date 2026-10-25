import { describe, expect, it } from "vitest"
import { buildRoute, googleMapsLink } from "@/lib/geo/route"

describe("route legs (ADR-012)", () => {
  const route = buildRoute("CD-420299")!

  it("runs pickup → terminal → crossing → delivery for a ferry order", () => {
    expect(route.legs.map((l) => `${l.mode}:${l.from.name}→${l.to.name}`)).toEqual([
      "drive:Leipzig→West Baltic Vehicle Terminal",
      "ferry:West Baltic Vehicle Terminal→South Finland Vehicle Terminal",
      "drive:South Finland Vehicle Terminal→Helsinki",
    ])
  })

  it("lets the packet's times win: the quoted crossing and its road time", () => {
    const [toTerminal, ferry] = route.legs
    expect(ferry.departAt).toBe("2026-10-24T12:00:00Z")
    expect(ferry.arriveAt).toBe("2026-10-25T16:00:00Z")
    expect(ferry.basis).toBe("quote")
    expect(ferry.status).toBe("quoted")
    expect(ferry.priceCents).toBe(38700)
    expect(toTerminal.minutes).toBe(7 * 60)
    expect(toTerminal.basis).toBe("quote")
  })

  it("marks estimates and fictional terminals as synthetic", () => {
    const last = route.legs[2]
    expect(last.basis).toBe("estimate")
    expect(last.synthetic).toBe(true)
    expect(route.legs[1].from.synthetic).toBe(true)
    expect(route.legs[1].from.approximate).toBe(true)
  })

  it("keeps the sold-out crossing as a struck alternative, not a leg", () => {
    expect(route.alternatives).toEqual([expect.objectContaining({ status: "sold_out", departAt: "2026-10-23T22:00:00Z" })])
  })

  it("gives the arrival as a range with its basis written out", () => {
    expect(route.arrival!.basis).toMatch(/quote/)
    expect(route.arrival!.earliest <= route.arrival!.latest).toBe(true)
  })

  it("uses the booked crossing when there is one", () => {
    const booked = buildRoute("CD-420603")!
    expect(booked.legs.find((l) => l.mode === "ferry")?.status).toBe("booked")
  })

  it("draws a single estimated road leg for a domestic order", () => {
    const domestic = buildRoute("CD-420322")!
    expect(domestic.legs).toHaveLength(1)
    expect(domestic.legs[0]).toEqual(expect.objectContaining({ mode: "drive", basis: "estimate", synthetic: true }))
  })

  it("shows the driver app's ETA separately, with its age", () => {
    const moving = buildRoute("CD-420603")!
    expect(moving.driverEta === null || typeof moving.driverEta.receivedAt === "string").toBe(true)
  })

  it("builds a plain Google Maps directions link for a road leg", () => {
    expect(googleMapsLink(route.legs[0])).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=51.34,12.375&destination=53.581,9.933&travelmode=driving",
    )
  })
})
