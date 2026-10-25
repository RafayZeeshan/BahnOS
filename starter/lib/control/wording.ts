// Turns system text into plain words for a main screen: no record-type prefixes, no order ids inside
// sentences, and "source is a conversation" becomes a small "not confirmed" tag instead of a clause.
const PREFIX = /^(Open alert|Owned alert|Incident):\s*/i
const UNCONFIRMED = /;?\s*source is a conversation, not a verified outcome\.?/i
const ORDER_IN_TEXT = /\s+for CD-\d+/g

export function plainReason(text: string): { text: string; notConfirmed: boolean } {
  const notConfirmed = UNCONFIRMED.test(text)
  let clean = text.replace(PREFIX, "").replace(UNCONFIRMED, ".").replace(ORDER_IN_TEXT, "")
  clean = clean.replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim()
  return { text: clean, notConfirmed }
}

const HEADLINE_MAX = 140

/** A headline fits on a line or two. Longer text keeps its first sentence; the rest belongs under it. */
export function shortHeadline(text: string): string {
  if (text.trim().length <= HEADLINE_MAX) return text.trim()
  const first = (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim()
  if (first.length <= HEADLINE_MAX) return first
  const cut = first.slice(0, HEADLINE_MAX - 1)
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:(-]+$/, "")}…`
}

// When an order has several open decisions, the agent's hand-over leads and a drafted message comes last.
const DECISION_RANK: Record<string, number> = { escalate: 0, draft_customer_update: 2 }
export const decisionRank = (action: string): number => DECISION_RANK[action] ?? 1

/** A drafted message is reviewed, not headlined by its first words. */
export function decisionTitle(action: string, headline: string): string {
  return action === "draft_customer_update" ? "Review a drafted customer update" : headline
}

const SITUATION_MIN = 40

/** The agent's summary as a headline: its first sentence without the order reference, or null when that says too little. */
export function situationFrom(summary: string): string | null {
  const rest = summary.trim().replace(/^CD-\d+[:,]?\s+/, "")
  let sentence = (rest.match(/^.*?[.!?](\s|$)/)?.[0] ?? rest).trim().replace(/\s+(?:for|on|of|in)\s+CD-\d+/g, "")
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1)
  return sentence.length >= SITUATION_MIN ? shortHeadline(sentence) : null
}
