// New data (ADR-011): recorded, fictional follow-up facts that arrive after the snapshot when someone plays them.
// The packet stays untouched (ADR-015). Each fact marks its order's sources stale, queues a learning run, and
// lets the reopen watcher re-check the blockers on that order's earlier fixes.
import { exposureFor, keysOf, SOURCE_KINDS } from "@/lib/risk/rates"
import type { Case } from "./casebook"

export type Fact = { id: string; order: string; text: string; source: string; clears: string | null }
export type FactEffect = { cleared: string[]; reopen: boolean; staleSources: string[]; queueRun: boolean }

export const RECORDED_FACTS: Fact[] = [
  {
    id: "fact-420299-provider",
    order: "CD-420299",
    text: "Vela Coast Lines' desk confirmed it holds no reservation for the timed-out request. Nothing was charged.",
    source: "provider desk (recorded follow-up)",
    clears: "An earlier booking attempt has an unknown outcome.",
  },
  {
    id: "fact-420154-capacity",
    order: "CD-420154",
    text: "A refreshed check shows vehicle space again on the Friday night crossing that was sold out.",
    source: "provider quote (recorded follow-up)",
    clears: "The selected crossing is sold out.",
  },
  {
    id: "fact-420449-fitness",
    order: "CD-420449",
    text: "The driver confirmed they are fit to drive tomorrow's pickup.",
    source: "driver message (recorded follow-up)",
    clears: null,
  },
]

export function applyFact(fact: Fact, casebook: Case[]): FactEffect {
  const blockers = casebook.find((c) => c.order === fact.order)?.blockers ?? []
  const cleared = fact.clears && blockers.includes(fact.clears) ? [fact.clears] : []
  const exposure = exposureFor(fact.order)
  const staleSources = exposure ? SOURCE_KINDS.flatMap((kind) => keysOf(kind, exposure).map((key) => `${kind}|${key}`)) : []
  return { cleared, reopen: cleared.length > 0, staleSources, queueRun: true }
}
