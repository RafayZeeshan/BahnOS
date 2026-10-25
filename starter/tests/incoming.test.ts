import { describe, expect, it } from "vitest"
import { RECORDED_FACTS, applyFact } from "@/lib/dream/incoming"
import { buildCasebook } from "@/lib/dream/casebook"

describe("new data and the reopen watcher (ADR-011)", () => {
  const book = buildCasebook()

  it("has recorded follow-up facts for real orders, labelled as recorded", () => {
    expect(RECORDED_FACTS.length).toBeGreaterThanOrEqual(2)
    for (const f of RECORDED_FACTS) {
      expect(book.some((c) => c.order === f.order)).toBe(true)
      expect(f.source).toMatch(/recorded/)
    }
  })

  it("a provider confirming no reservation clears the unknown-outcome blocker on CD-420299", () => {
    const fact = RECORDED_FACTS.find((f) => f.order === "CD-420299")!
    const effect = applyFact(fact, book)
    expect(effect.cleared).toEqual(["An earlier booking attempt has an unknown outcome."])
    expect(effect.reopen).toBe(true)
  })

  it("a refreshed quote with space clears a sold-out blocker", () => {
    const fact = RECORDED_FACTS.find((f) => f.clears === "The selected crossing is sold out.")!
    const effect = applyFact(fact, book)
    expect(effect.cleared).toEqual(["The selected crossing is sold out."])
  })

  it("marks the order's failure sources stale and queues a learning run", () => {
    const fact = RECORDED_FACTS[0]
    const effect = applyFact(fact, book)
    expect(effect.staleSources.length).toBeGreaterThan(0)
    expect(effect.staleSources.every((k) => /^(route|mode|make|dealership)\|/.test(k))).toBe(true)
    expect(effect.queueRun).toBe(true)
  })

  it("does not reopen a case whose blocker is not the one the fact clears", () => {
    const effect = applyFact({ ...RECORDED_FACTS[0], order: "CD-420004" }, book)
    expect(effect.reopen).toBe(false)
    expect(effect.cleared).toEqual([])
  })
})
