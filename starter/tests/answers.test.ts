import { describe, expect, it } from "vitest"
import { KNOWLEDGE } from "@/lib/answers/knowledge"
import { searchAnswers } from "@/lib/answers/search"

describe("answer book lookup (ADR-017)", () => {
  it("finds the entry a driver's question is about", () => {
    expect(searchAnswers("Can I take a taxi to the terminal?")[0].id).toBe("exp-taxi")
    expect(searchAnswers("A red warning light is on in the car")[0].id).toBe("road-warning-light")
  })

  it("carries the routing, cautions and corner cases, so BahnBot knows whether it may answer", () => {
    const hit = searchAnswers("A red warning light is on in the car")[0]
    const entry = KNOWLEDGE.find((e) => e.id === hit.id)!
    expect(hit).toEqual(expect.objectContaining({ routing: entry.routing, answer: entry.answer }))
    expect(hit.cautions).toEqual(entry.cautions ?? [])
    expect(hit.corners).toEqual(entry.corners ?? [])
  })

  it("never answers a German-only entry for a driver in Finland", () => {
    expect(searchAnswers("How do I get red plates?", "DE").map((h) => h.id)).toContain("doc-red-plates-de")
    expect(searchAnswers("How do I get red plates?", "FI").map((h) => h.id)).not.toContain("doc-red-plates-de")
  })

  it("offers a driver from outside Finland, Germany and Denmark only the entries for every market", () => {
    const hits = searchAnswers("How do I get red plates?", "OTHER")
    expect(hits.every((h) => h.market === "ALL")).toBe(true)
  })

  it("returns nothing for a question it has no entry for, rather than a guess", () => {
    expect(searchAnswers("zzz qqq")).toEqual([])
  })
})
