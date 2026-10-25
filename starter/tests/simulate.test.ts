import { describe, expect, it } from "vitest"
import { PERTURBATIONS, simulate, stressTest } from "@/lib/dream/simulate"
import { packet } from "@/lib/packet"
import { POLICY_V1 } from "@/lib/policy/defaults"

const NOW = "2026-10-21T09:00:00.000Z"

describe("simulation on perturbed copies of real orders (ADR-010)", () => {
  it("offers the failure types from the plan", () => {
    expect(PERTURBATIONS.map((p) => p.id)).toEqual(["ferry_sold_out", "eta_slips_2h", "quote_goes_stale", "site_not_ready", "warning_light"])
  })

  it("labels every result as simulated and leaves the packet untouched", () => {
    const before = JSON.stringify(packet().forOrder("ord-00603", "travel_options")) + packet().all("orders").length
    const r = simulate(POLICY_V1, "CD-420603", "ferry_sold_out", NOW)
    expect(r.simulated).toBe(true)
    expect(r.label).toBe("Simulated: CD-420603 with the crossing sold out. Not a real order.")
    expect(JSON.stringify(packet().forOrder("ord-00603", "travel_options")) + packet().all("orders").length).toBe(before)
  })

  it("a sold-out crossing on a booked ferry order is likely to slip", () => {
    const r = simulate(POLICY_V1, "CD-420603", "ferry_sold_out", NOW)
    expect(r.after.level).toBe("likely_to_slip")
    expect(r.after.signals.map((s) => s.kind)).toContain("availability")
  })

  it("an ETA two hours past the promise is caught on a moving order", () => {
    const r = simulate(POLICY_V1, "CD-420603", "eta_slips_2h", NOW)
    expect(r.after.signals.map((s) => s.kind)).toContain("eta_vs_promise")
  })

  it("reports honestly when Watch does not look at a failure type", () => {
    const r = simulate(POLICY_V1, "CD-420603", "warning_light", NOW)
    expect(r.caught).toBe(false)
  })

  it("summarises how many sample orders each failure type is caught on", () => {
    const rows = stressTest(POLICY_V1, NOW)
    expect(rows.map((r) => r.perturbation)).toEqual(PERTURBATIONS.map((p) => p.id))
    for (const row of rows) {
      expect(row.n).toBeGreaterThan(0)
      expect(row.k).toBeLessThanOrEqual(row.n)
      expect(row.sentence).toMatch(/of \d+ sample orders/)
    }
  })
})
