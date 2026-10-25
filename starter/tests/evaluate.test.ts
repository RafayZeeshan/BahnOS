import { describe, expect, it } from "vitest"
import { evaluate } from "@/lib/engine/evaluate"
import { POLICY_V1 } from "@/lib/policy/defaults"

const NOW = "2026-10-21T09:00:00.000Z"
const kinds = (r: ReturnType<typeof evaluate>) => r.signals.map((s) => s.kind).sort()

describe("evaluate(policy, order, t) (ADR-010)", () => {
  it("CD-420299 now: a sold-out crossing with nothing booked, and a booking attempt with an unknown outcome", () => {
    const r = evaluate(POLICY_V1, "CD-420299", NOW)
    expect(r.level).toBe("likely_to_slip")
    expect(kinds(r)).toEqual(["availability", "unknown_outcome"])
    expect(r.signals.find((s) => s.kind === "unknown_outcome")?.text).toBe("A booking attempt timed out with no confirmation.")
  })

  it("does not see the future: before the 07:10 timeout there is no unknown outcome", () => {
    expect(kinds(evaluate(POLICY_V1, "CD-420299", "2026-10-21T07:05:00Z"))).toEqual(["availability"])
  })

  it("does not see the future: before the 07:00 capacity check there is nothing to flag", () => {
    const r = evaluate(POLICY_V1, "CD-420299", "2026-10-21T06:00:00Z")
    expect(r.signals).toEqual([])
    expect(r.level).toBe("fine")
  })

  it("CD-420603 now: the booked ferry's check-in closes in 3 hours", () => {
    const r = evaluate(POLICY_V1, "CD-420603", NOW)
    const cutoff = r.signals.find((s) => s.kind === "cutoff")
    expect(cutoff?.minutes).toBe(180)
    expect(cutoff?.text).toBe("Ferry check-in closes in 3 h 0 m.")
    expect(r.level).toBe("watch")
  })

  it("the same order is likely to slip once the cutoff is under the tighter threshold", () => {
    expect(evaluate(POLICY_V1, "CD-420603", "2026-10-21T11:10:00Z").level).toBe("likely_to_slip")
  })

  it("CD-420399 now: the driver reports they cannot reach the pickup", () => {
    const r = evaluate(POLICY_V1, "CD-420399", NOW)
    expect(kinds(r)).toContain("positioning")
    expect(r.level).toBe("likely_to_slip")
  })

  it("CD-420449 now: the driver's fitness is an open question", () => {
    const r = evaluate(POLICY_V1, "CD-420449", NOW)
    expect(kinds(r)).toContain("open_question")
  })

  it("does not call a quote stale when that leg is already booked", () => {
    expect(kinds(evaluate(POLICY_V1, "CD-420449", NOW))).not.toContain("stale_quote")
  })

  it("follows the policy: a looser slack threshold stops flagging the cutoff", () => {
    const loose = { ...POLICY_V1, watch: { ...POLICY_V1.watch, slack_min_minutes: 120 } }
    expect(evaluate(loose, "CD-420603", NOW).signals.find((s) => s.kind === "cutoff")).toBeUndefined()
  })

  it("treats a delivered order as no longer active", () => {
    const delivered = evaluate(POLICY_V1, "CD-420455", NOW)
    expect(delivered.active).toBe(false)
    expect(delivered.level).toBe("fine")
  })

  it("reports the order's exposure to each source of failure", () => {
    expect(evaluate(POLICY_V1, "CD-420299", NOW).exposure).toEqual({
      route: "DE → FI", modes: ["ferry", "road"], make: "BMW", dealership: expect.any(String),
    })
  })

  it("is deterministic", () => {
    expect(evaluate(POLICY_V1, "CD-420299", NOW)).toEqual(evaluate(POLICY_V1, "CD-420299", NOW))
  })

  it("rejects an unknown order", () => {
    expect(() => evaluate(POLICY_V1, "CD-1", NOW)).toThrow("No order CD-1")
  })
})

describe("evaluate does not see the future (code review)", () => {
  it("builds the order's exposure only from travel known at t", () => {
    expect(evaluate(POLICY_V1, "CD-420154", "2026-10-21T06:00:00Z").exposure.modes).toEqual(["road"])
  })

  it("treats a crossing as booked at t even if it later missed check-in", () => {
    const r = evaluate(POLICY_V1, "CD-420194", "2026-10-16T11:30:00Z")
    expect(r.signals.map((s) => s.kind)).toContain("cutoff")
    expect(r.signals.map((s) => s.kind)).not.toContain("availability")
  })

  it("stops warning about check-in once the gate has accepted the car", () => {
    expect(evaluate(POLICY_V1, "CD-420342", "2026-10-15T11:50:00Z").signals.map((s) => s.kind)).toContain("cutoff")
    expect(evaluate(POLICY_V1, "CD-420342", "2026-10-15T11:55:00Z").signals.map((s) => s.kind)).not.toContain("cutoff")
  })
})
