// What the ops map shows about each order that needs a person, from BahnOS's own records:
// the Today queue, Watch's flags and lines, and BahnBot's open decisions (ADR-017).
import { decisionRank, decisionTitle, shortHeadline } from "../control/wording"
import type { PendingDecision, QueueItem } from "../control/queue"
import type { Need } from "./ops"
import type { NextDecision } from "./story"

export type BotItem = { id: string; ref: string; title: string; who: NextDecision["who"] }

const whoFor = (action: string): NextDecision["who"] => (action === "escalate" ? "NEEDS_PERSON" : "NEEDS_APPROVAL")

function topDecision(list: PendingDecision[]): PendingDecision | undefined {
  return [...list].sort((a, b) => decisionRank(a.action) - decisionRank(b.action) || a.id.localeCompare(b.id))[0]
}

export function buildNeeds(input: {
  needsYou: QueueItem[]
  watch: Record<string, string>
  lines: Record<string, string>
  pending: PendingDecision[]
}): Map<string, Need> {
  const needs = new Map<string, Need>()
  const byOrder = new Map<string, PendingDecision[]>()
  for (const d of input.pending) byOrder.set(d.orderRef, [...(byOrder.get(d.orderRef) ?? []), d])

  for (const item of input.needsYou) {
    const top = topDecision(byOrder.get(item.reference) ?? [])
    needs.set(item.reference, {
      level: item.tone === "danger" || top?.action === "escalate" ? "critical" : "warn",
      badge: "Needs you",
      why: { headline: input.lines[item.reference] ?? item.why, detail: null, blockedOn: item.waitingOn.replace(/^Waiting on /, "") },
      next: top ? { title: shortHeadline(decisionTitle(top.action, top.headline)), because: null, who: whoFor(top.action), owner: null, scope: null } : null,
    })
  }
  for (const ref of Object.keys(input.watch)) {
    if (needs.has(ref)) continue
    needs.set(ref, { level: "warn", badge: "Heads-up", why: { headline: input.lines[ref] ?? "On watch", detail: null, blockedOn: null }, next: null })
  }
  return needs
}

/** BahnBot's open decisions for the map's queue: hand-overs first, then proposals, then drafts. */
export function botQueue(pending: PendingDecision[]): BotItem[] {
  return [...pending]
    .sort((a, b) => decisionRank(a.action) - decisionRank(b.action) || a.id.localeCompare(b.id))
    .map((d) => ({ id: d.id, ref: d.orderRef, title: shortHeadline(decisionTitle(d.action, d.headline)), who: whoFor(d.action) }))
}
