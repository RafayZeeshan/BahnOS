// Today's queue (ADR-013): only the orders that need a person, each with one plain reason,
// the deadline that decides it, who it waits on and the recommended response.
import type { BoardCard, Tone } from "@/lib/present/types"
import { decisionRank, decisionTitle, plainReason, shortHeadline } from "./wording"

export type PendingDecision = { id: string; orderRef: string; action: string; headline: string }

export type QueueItem = {
  reference: string
  car: string
  route: string
  customer: string
  why: string
  deadline: { label: string; at: string; note: string | null } | null
  waitingOn: string
  recommended: "Go ahead" | "Take over" | "Open"
  decisionId: string | null
  tone: Tone
  notConfirmed: boolean
  headsUp: boolean
}

export type WatchState = { level: string; cutoff: { at: string; minutes: number } | null }

export type QuietItem = { reference: string; car: string; route: string; status: string }

const URGENT: Tone[] = ["danger", "warn"]
const RANK: Record<Tone, number> = { danger: 0, warn: 1, accent: 2, neutral: 3, ok: 4 }
// Internal record ids never reach a main screen (BUILD-PLAN rule 5).
const RAW_ID = /\b[a-z]+-x[0-9a-f]{6,}\b\s*/g

function sentence(text: string): string {
  const clean = text.replace(RAW_ID, "").replace(/\s+/g, " ").trim()
  return /[.!?]$/.test(clean) ? clean : `${clean}.`
}

// Dates that are still work to do; when an order was created or delivered is history, not a deadline.
const DEADLINE_KEYS = new Set(["requested_pickup", "pickup_slot", "driver_start", "promise", "eta"])

// The starter writes full sentences for its board; a queue row has room for a few words.
const SHORT_NOTES: [RegExp, string][] = [
  [/^slot has passed and no pickup is recorded/, "passed, no pickup recorded"],
  [/^slot has started and no driver is booked/, "started, no driver booked"],
  [/^promise has passed and no delivery is recorded/, "passed, not delivered"],
  [/^driver-app ETA .* is after the promise/, "ETA is after it"],
  [/^customer preference.*/, "requested, not agreed"],
]

function shortNote(note: string | null): string | null {
  if (!note) return null
  const base = note.split(" · ")[0]
  return SHORT_NOTES.find(([pattern]) => pattern.test(base))?.[1] ?? base
}

function reasonFrom(card: BoardCard): { text: string; notConfirmed: boolean } {
  const top = card.attention.find((a) => URGENT.includes(a.tone)) ?? card.attention[0]
  if (!top) return { text: "Needs a look.", notConfirmed: false }
  return plainReason(top.detail ? `${sentence(top.title)} ${sentence(top.detail)}` : sentence(top.title))
}

function hours(minutes: number): string {
  return minutes < 60 ? `${minutes} m` : `${Math.round(minutes / 60)} h`
}

export function buildQueue(cards: BoardCard[], pending: PendingDecision[], watch: Record<string, WatchState> = {}): { needsYou: QueueItem[]; quiet: QuietItem[]; all: (QueueItem | QuietItem)[] } {
  const byOrder = new Map<string, PendingDecision>()
  for (const d of pending) {
    const held = byOrder.get(d.orderRef)
    if (!held || decisionRank(d.action) < decisionRank(held.action)) byOrder.set(d.orderRef, d)
  }
  const needsYou: QueueItem[] = []
  const quiet: QuietItem[] = []

  for (const card of cards) {
    const decision = byOrder.get(card.reference)
    const urgent = card.attention.some((a) => URGENT.includes(a.tone))
    const route = `${card.from.city} → ${card.to.city}`
    if (!decision && !urgent) {
      quiet.push({ reference: card.reference, car: card.vehicle, route, status: card.statusLabel })
      continue
    }
    const owner = card.attention.find((a) => URGENT.includes(a.tone) && a.owner)?.owner
    const reason = decision ? { text: shortHeadline(decisionTitle(decision.action, decision.headline)), notConfirmed: false } : reasonFrom(card)
    const w = watch[card.reference]
    let deadline: QueueItem["deadline"] = card.decisive && DEADLINE_KEYS.has(card.decisive.key)
      ? { label: card.decisive.label, at: card.decisive.start, note: shortNote(card.decisive.note) }
      : null
    // A ferry check-in that closes sooner is the deadline that decides the order.
    if (w?.cutoff && (!deadline || w.cutoff.at < deadline.at)) {
      deadline = { label: "Ferry check-in", at: w.cutoff.at, note: `closes in ${hours(w.cutoff.minutes)}` }
    }
    needsYou.push({
      reference: card.reference,
      car: card.vehicle,
      route,
      customer: card.customer,
      why: reason.text,
      deadline,
      waitingOn: decision ? "Waiting on you" : owner ?? "Unassigned",
      recommended: decision ? (decision.action === "escalate" ? "Take over" : "Go ahead") : "Open",
      decisionId: decision?.id ?? null,
      tone: decision ? "accent" : card.attentionTone,
      notConfirmed: reason.notConfirmed,
      headsUp: !!w && w.level !== "fine",
    })
  }

  needsYou.sort((a, b) =>
    Number(!a.decisionId) - Number(!b.decisionId)
    || (a.decisionId ? 0 : RANK[a.tone] - RANK[b.tone])
    || (a.deadline?.at ?? "9999").localeCompare(b.deadline?.at ?? "9999"),
  )
  return { needsYou, quiet, all: [...needsYou, ...quiet] }
}
