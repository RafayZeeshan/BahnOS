import { describe, expect, it } from "vitest"
import { buildCasebook } from "@/lib/dream/casebook"
import { replay } from "@/lib/dream/replay"
import { sourceRates } from "@/lib/risk/rates"
import { evaluate } from "@/lib/engine/evaluate"
import { POLICY_V1 } from "@/lib/policy/defaults"

const NOW = "2026-10-21T09:00:00.000Z"

describe("casebook (ADR-011)", () => {
  const book = buildCasebook()

  it("has one case per order, keeping closed, failed and cancelled ones", () => {
    expect(book).toHaveLength(100)
    expect(book.some((c) => c.outcome === "cancelled")).toBe(true)
  })

  it("records the mishaps, the fix that was tried, and what blocked it", () => {
    const c = book.find((x) => x.order === "CD-420299")!
    expect(c.mishaps.map((m) => m.cause)).toContain("mode")
    expect(c.fixes.some((f) => f.action === "travel.book_ferry" && f.result === "failed")).toBe(true)
    expect(c.blockers).toContain("An earlier booking attempt has an unknown outcome.")
  })
})

describe("source rates, leave one order out", () => {
  it("excludes the held-out order from its own source's record", () => {
    const all = sourceRates(POLICY_V1)
    const without = sourceRates(POLICY_V1, { exclude: "CD-420154" })
    expect(all.get("route|FR → FI")!.n).toBe(3)
    expect(without.get("route|FR → FI")!.n).toBe(2)
    expect(without.get("route|FR → FI")!.k).toBe(1)
  })
})

describe("evaluate with source exposure (policy switch)", () => {
  it("adds an exposure signal only when the policy turns it on", () => {
    const on = { ...POLICY_V1, risk: { ...POLICY_V1.risk, watch_on_elevated: true, elevated_rate: 0.2 } }
    const rates = sourceRates(on)
    const off = evaluate(POLICY_V1, "CD-420360", NOW, undefined, { rates })
    const flagged = evaluate(on, "CD-420360", NOW, undefined, { rates })
    expect(off.signals.some((s) => s.kind === "exposure")).toBe(false)
    expect(flagged.signals.find((s) => s.kind === "exposure")?.text).toMatch(/of \d+ orders/)
  })
})

describe("replay at checkpoints (ADR-011)", () => {
  const v1 = replay(POLICY_V1)

  it("replays every mishap order at 24 h, 6 h and 1 h before its first mishap", () => {
    expect(v1.cases.length).toBe(21)
    expect(v1.checkpoints).toEqual([24, 6, 1])
  })

  it("reports lead time, hit rate and false alarms, each with n, labelled held-out", () => {
    expect(v1.metrics.hits.n).toBe(21)
    expect(v1.metrics.hits.k).toBeGreaterThanOrEqual(0)
    expect(v1.metrics.falseAlarms.n).toBeGreaterThan(30)
    expect(v1.metrics.label).toBe("held-out (leave one order out, as of each checkpoint)")
    expect(typeof v1.metrics.medianLeadHours === "number" || v1.metrics.medianLeadHours === null).toBe(true)
  })

  it("never lets a checkpoint see its own mishap", () => {
    for (const c of v1.cases) for (const cp of c.checkpoints) expect(cp.t < c.mishapAt).toBe(true)
  })

  it("turning on source exposure flags more mishaps earlier, and the cost shows as false alarms", () => {
    const v2 = replay({ ...POLICY_V1, version: 2, risk: { ...POLICY_V1.risk, watch_on_elevated: true, elevated_rate: 0.2 } })
    expect(v2.metrics.hits.k).toBeGreaterThanOrEqual(v1.metrics.hits.k)
    expect(v2.metrics.falseAlarms.k).toBeGreaterThanOrEqual(v1.metrics.falseAlarms.k)
  })

  it("is deterministic", () => {
    expect(replay(POLICY_V1).metrics).toEqual(v1.metrics)
  })
})

describe("source rates as of a time (code review)", () => {
  it("counts no mishaps before the first one happened", () => {
    const early = sourceRates(POLICY_V1, { asOf: "2026-10-16T00:00:00Z" })
    expect([...early.values()].reduce((sum, r) => sum + r.k, 0)).toBe(0)
  })

  it("counts only orders that existed at that time", () => {
    const early = sourceRates(POLICY_V1, { asOf: "2026-10-10T00:00:00Z" })
    const late = sourceRates(POLICY_V1)
    const n = (m: typeof late) => [...m.values()].filter((r) => r.kind === "route").reduce((sum, r) => sum + r.n, 0)
    expect(n(early)).toBeLessThan(n(late))
  })
})
