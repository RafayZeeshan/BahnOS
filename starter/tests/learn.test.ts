import { describe, expect, it } from "vitest"
import { learn, score } from "@/lib/dream/learn"
import { decideVersion, maturity } from "@/lib/dream/versions"
import { POLICY_V1 } from "@/lib/policy/defaults"

describe("learning loop (ADR-011)", () => {
  const result = learn(POLICY_V1)

  it("runs at most three rounds, each probing the incumbent and scoring candidates on held-out replay", () => {
    expect(result.rounds.length).toBeGreaterThan(0)
    expect(result.rounds.length).toBeLessThanOrEqual(3)
    for (const r of result.rounds) {
      expect(r.incumbent.label).toBe("held-out (leave one order out, as of each checkpoint)")
      expect(r.candidates.length).toBeGreaterThan(0)
      expect(r.candidates.every((c) => c.metrics.label === "held-out (leave one order out, as of each checkpoint)")).toBe(true)
    }
  })

  it("keeps a change only when it beats the incumbent by the margin", () => {
    for (const r of result.rounds) {
      if (r.kept) expect(score(r.kept.metrics)).toBeGreaterThanOrEqual(score(r.incumbent) + result.margin)
    }
  })

  it("on the packet, keeps no change once replay cannot see the future, and says so by stopping after two flat rounds", () => {
    // Before the code review, replay leaked later facts and a source lesson looked like 8 of 21 caught ahead.
    // Scored as of each checkpoint, every candidate catches the same 2 of 21 as v1, so nothing is kept.
    expect(result.rounds.every((r) => r.kept === null)).toBe(true)
    expect(result.rounds).toHaveLength(2)
    expect(result.versions).toEqual([])
    for (const r of result.rounds) for (const c of r.candidates) expect(c.lesson.length).toBeGreaterThan(20)
  })

  it("produces versions v2, v3… as candidates, never adopted by itself", () => {
    expect(result.versions.every((v) => v.status === "CANDIDATE")).toBe(true)
    expect(result.versions.map((v) => v.policy.version)).toEqual(result.versions.map((_, i) => i + 2))
  })

  it("stops when nothing beats the incumbent", () => {
    const last = result.rounds.at(-1)!
    expect(result.rounds.length === 3 || last.kept === null).toBe(true)
  })

  it("says who proposed the candidates", () => {
    expect(result.proposer).toBe("rules")
  })

  it("is deterministic", () => {
    expect(learn(POLICY_V1).rounds.map((r) => r.kept?.diff)).toEqual(result.rounds.map((r) => r.kept?.diff))
  })
})

describe("adopting a version (a person decides)", () => {
  const better = { hits: { k: 8, n: 21 }, falseAlarms: { k: 2, n: 45 }, medianLeadHours: 24, label: "held-out" }
  const worse = { hits: { k: 1, n: 21 }, falseAlarms: { k: 5, n: 45 }, medianLeadHours: 1, label: "held-out" }
  const current = { hits: { k: 2, n: 21 }, falseAlarms: { k: 0, n: 45 }, medianLeadHours: 1, label: "held-out" }

  it("adopts a better candidate", () => {
    expect(decideVersion({ op: "adopt", candidate: better, adopted: current, status: "CANDIDATE" })).toEqual({ ok: true, status: "ADOPTED" })
  })

  it("refuses a worse candidate without an override reason, and accepts it with one", () => {
    expect(decideVersion({ op: "adopt", candidate: worse, adopted: current, status: "CANDIDATE" })).toEqual({
      ok: false, error: "This version scores worse than the one in use. Give a reason to adopt it anyway.",
    })
    expect(decideVersion({ op: "adopt", candidate: worse, adopted: current, override: "Seasonal ferry change", status: "CANDIDATE" })).toEqual({ ok: true, status: "ADOPTED", override: true })
  })

  it("rejects and rolls back", () => {
    expect(decideVersion({ op: "reject", candidate: worse, adopted: current, reason: "Too many alarms", status: "CANDIDATE" })).toEqual({ ok: true, status: "REJECTED" })
    expect(decideVersion({ op: "reject", candidate: worse, adopted: current, status: "CANDIDATE" })).toEqual({ ok: false, error: "Say why, so the next round can learn from it." })
    expect(decideVersion({ op: "rollback", candidate: current, adopted: better, status: "RETIRED" })).toEqual({ ok: true, status: "ROLLED_BACK" })
  })
})

describe("version rules a person cannot get around (code review)", () => {
  const m = { hits: { k: 2, n: 21 }, falseAlarms: { k: 0, n: 45 }, medianLeadHours: 1, label: "held-out" }
  it("adopts or rejects only a candidate", () => {
    expect(decideVersion({ op: "adopt", candidate: m, adopted: m, status: "REJECTED" })).toEqual({ ok: false, error: "Only a version waiting for a decision can be adopted or set aside." })
    expect(decideVersion({ op: "reject", candidate: m, adopted: m, reason: "x", status: "ADOPTED" })).toEqual({ ok: false, error: "Only a version waiting for a decision can be adopted or set aside." })
  })
  it("rolls back only to a version that was in use before", () => {
    expect(decideVersion({ op: "rollback", candidate: m, adopted: m, status: "CANDIDATE" })).toEqual({ ok: false, error: "You can only go back to a version that was in use before." })
    expect(decideVersion({ op: "rollback", candidate: m, adopted: m, status: "ROLLED_BACK" })).toEqual({ ok: true, status: "ROLLED_BACK" })
  })
})

describe("maturity per failure type", () => {
  it("is Learning with too few cases or no held-out gain, Emerging with a gain, Reliable with a gain that held across rounds", () => {
    expect(maturity({ cases: 3, gain: 2, regressed: false, rounds: 1 })).toBe("learning")
    expect(maturity({ cases: 8, gain: 0, regressed: false, rounds: 1 })).toBe("learning")
    expect(maturity({ cases: 8, gain: 2, regressed: false, rounds: 1 })).toBe("emerging")
    expect(maturity({ cases: 8, gain: 2, regressed: false, rounds: 2 })).toBe("reliable")
    expect(maturity({ cases: 8, gain: 2, regressed: true, rounds: 3 })).toBe("emerging")
  })
})

describe("version diffs in plain words", async () => {
  const { describeChange } = await import("@/lib/dream/report")
  it("describes each policy change for an ops person", () => {
    expect(describeChange({ path: "risk.watch_on_elevated", from: false, to: true }))
      .toBe("Also watch orders that ride on a route, mode, make or dealership with a poor record.")
    expect(describeChange({ path: "risk.elevated_rate", from: 0.35, to: 0.2 })).toBe("Call a source risky from 20 in 100 past orders (was 35).")
    expect(describeChange({ path: "watch.slack_min_minutes", from: 180, to: 300 })).toBe("Start watching a ferry check-in 5 h before it closes (was 3 h).")
  })
})
