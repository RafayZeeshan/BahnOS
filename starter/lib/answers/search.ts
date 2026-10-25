// BahnBot's lookup into the answer book (ADR-017): the entries a question is about, with the
// routing that says whether BahnBot may answer, plus what it must never assert.
import { type CornerCase, type Entry, KNOWLEDGE, type Market, type Routing } from "./knowledge"

export type AnswerHit = {
  id: string
  topic: string
  routing: Routing
  answer: string
  reads: string[]
  cautions: string[]
  corners: CornerCase[]
  escalate_to: string | null
  market: Market
}

const STOP = new Set(("a an and are as at be but by can do does for from have how i if in is it its me my of on or " +
  "so that the this to was we what when where which who why will with you your").split(" "))
const MAX_HITS = 3

const words = (text: string): string[] =>
  text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))

function score(entry: Entry, asked: Set<string>): number {
  const hits = (text: string, weight: number) => words(text).reduce((n, w) => n + (asked.has(w) ? weight : 0), 0)
  return entry.triggers.reduce((n, t) => n + hits(t, 3), 0) + hits(entry.topic, 1) + hits(entry.answer, 1)
}

/** A driver's market; OTHER is a driver from outside Finland, Germany and Denmark. */
export type DriverMarket = Exclude<Market, "ALL"> | "OTHER"

/** Best matches first. An entry for one market is never offered for a driver in another. */
export function searchAnswers(question: string, market?: DriverMarket): AnswerHit[] {
  const asked = new Set(words(question))
  if (!asked.size) return []
  return KNOWLEDGE
    .filter((e) => !market || e.market === "ALL" || e.market === market)
    .map((e) => ({ e, s: score(e, asked) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_HITS)
    .map(({ e }) => ({
      id: e.id, topic: e.topic, routing: e.routing, answer: e.answer, reads: e.reads ?? [], cautions: e.cautions ?? [],
      corners: e.corners ?? [], escalate_to: e.escalateTo ?? null, market: e.market,
    }))
}
