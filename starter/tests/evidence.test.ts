import { describe, expect, it } from "vitest"
import { STRENGTHS, evidenceFor, weakest } from "@/lib/present/evidence"

describe("evidence ladder", () => {
  it("orders strengths from weakest to strongest", () => {
    expect(STRENGTHS).toEqual(["claimed", "reported", "observed", "verified"])
  })

  it("treats what a driver or customer wrote as claimed", () => {
    const e = evidenceFor({ kind: "message", authorType: "driver", at: "2026-10-21T08:05:00Z" })
    expect(e.strength).toBe("claimed")
    expect(e.label).toBe("driver said")
    expect(e.at).toBe("2026-10-21T08:05:00Z")
  })

  it("treats a site contact's message as the site replying", () => {
    expect(evidenceFor({ kind: "message", authorType: "site_contact", at: "x" })).toEqual({ strength: "observed", label: "site replied", at: "x" })
  })

  it("treats operator and agent messages as reported, not proof", () => {
    expect(evidenceFor({ kind: "message", authorType: "operator", at: "x" }).strength).toBe("reported")
    expect(evidenceFor({ kind: "message", authorType: "agent", at: "x" }).label).toBe("agent wrote")
  })

  it("never treats a ferry quote as a booking", () => {
    const quote = evidenceFor({ kind: "travel_option", status: "AVAILABLE_QUOTE", at: "x" })
    expect(quote.strength).toBe("observed")
    expect(quote.label).toBe("quoted by provider, not booked")
    const soldOut = evidenceFor({ kind: "travel_option", status: "SOLD_OUT", at: "x" })
    expect(soldOut.label).toBe("provider said sold out")
  })

  it("only a provider-confirmed booking or a gate scan is verified", () => {
    expect(evidenceFor({ kind: "travel_reservation", status: "CONFIRMED", at: "x" }).strength).toBe("verified")
    expect(evidenceFor({ kind: "ferry_gate_scan", at: "x" }).strength).toBe("verified")
  })

  it("keeps a timed-out booking attempt at reported, with an unknown outcome", () => {
    const e = evidenceFor({ kind: "booking_attempt", outcome: "TIMED_OUT", at: "x" })
    expect(e.strength).toBe("reported")
    expect(e.label).toBe("booking outcome unknown")
  })

  it("treats a site profile confirmation as reported, not order-specific", () => {
    const e = evidenceFor({ kind: "endpoint_detail", source: "MANAGED_SITE_PROFILE", at: "x" })
    expect(e.strength).toBe("reported")
    expect(e.label).toBe("standard site profile")
  })

  it("treats tracking, site replies and approved photos as observed", () => {
    expect(evidenceFor({ kind: "tracking", at: "x" }).label).toBe("tracking signal")
    expect(evidenceFor({ kind: "site_reply", at: "x" }).strength).toBe("observed")
    expect(evidenceFor({ kind: "proof", status: "APPROVED", at: "x" }).label).toBe("seen in photo")
    expect(evidenceFor({ kind: "proof", status: "SUBMITTED", at: "x" }).strength).toBe("reported")
  })

  it("labels call answers by who spoke", () => {
    expect(evidenceFor({ kind: "call", speaker: "site", at: "x" }).label).toBe("site said on a call")
    expect(evidenceFor({ kind: "call", speaker: "driver", at: "x" }).label).toBe("driver said on a call")
    expect(evidenceFor({ kind: "call", speaker: "driver", at: "x" }).strength).toBe("claimed")
  })

  it("treats an alert as a reason to look, not a diagnosis", () => {
    const e = evidenceFor({ kind: "alert", at: "x" })
    expect(e.strength).toBe("reported")
    expect(e.label).toBe("system alert")
  })

  it("gives agent conclusions the strength of their weakest input", () => {
    expect(weakest(["verified", "claimed", "observed"])).toBe("claimed")
    expect(weakest([])).toBe("claimed")
  })
})
