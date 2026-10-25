// One case, readable in a few seconds (ADR-013): headline, the decision, who said what and when,
// facts with their evidence, the chain of next steps and the order's properties.
import { actionFor, type Response } from "@/lib/actions"
import { HOTEL_NIGHT_CENTS } from "@/lib/agent/mocks"
import type { Step } from "@/lib/agent/trace"
import { now } from "@/lib/clock"
import { zoneOf } from "@/lib/geo/route"
import { decisionRank, decisionTitle, plainReason, shortHeadline, situationFrom } from "./wording"
import { packet, type Rec } from "@/lib/packet"
import { evidenceFor, type Evidence } from "@/lib/present/evidence"
import { fmtDateTime, fmtRange, relativeTo } from "@/lib/present/time"

export type CaseDecision = {
  id: string
  action: string
  status: string
  headline: string
  payload: Record<string, unknown>
  blockers: string[]
  evidence: Record<string, unknown>[]
  effect: Record<string, unknown> | null
  response: string | null
  reason: string | null
  decidedBy: string | null
  decidedAt: string | null
  undoUntil: string | null
  createdAt: string
}

export type CaseRun = { id: string; trigger: string; mode: string; summary: string | null; startedAt: string; steps: Step[] }
export type ChainStep = { label: string; status: string; seq: number }
export type IncomingFact = { text: string; source: string; at: string }
// watchLine: Watch's model-written warning for this order (ADR-008), when there is one.
export type CaseInput = { reference: string; decisions: CaseDecision[]; runs: CaseRun[]; chain: ChainStep[]; incoming?: IncomingFact[]; watchLine?: string | null }

export type Actor = "driver" | "customer" | "site" | "ops" | "agent" | "system"
export type CallView = { with: "driver" | "site"; who: string; transcript: { speaker: string; text: string; at: string }[] }
export type ThreadItem = { at: string; actor: Actor; who: string; text: string; evidence: Evidence; steps?: string[]; mode?: string; call?: CallView }
export type Fact = { label: string; value: string; evidence: Evidence }

export type DecisionCard = {
  id: string
  status: string
  action: string
  headline: string
  // The rest of the agent's wording, when the headline had to be shortened.
  detail: string | null
  change: string[]
  cost: { cents: number; currency: string; note: string } | null
  whoIsTold: string
  effects: Record<Response, string>
  blockers: string[]
  evidence: Evidence[]
  outcome: { response: string | null; reason: string | null; by: string | null; effect: string | null } | null
  undoUntil: string | null
}

export type AgentWork = { status: "Failed" | "Waiting for review" | "Approved, not yet done"; text: string; detail: string | null; by: string; at: string }

export type CaseView = {
  reference: string
  orderId: string
  car: string
  route: string
  customer: string
  driver: string
  headline: string
  decision: DecisionCard | null
  agentWork: AgentWork[]
  history: DecisionCard[]
  thread: ThreadItem[]
  facts: Fact[]
  chain: ChainStep[]
  properties: { label: string; value: string }[]
  recorded: boolean
}

const WHO_IS_TOLD: Record<string, string> = {
  propose_booking: "The driver gets the new sailing in the app. The customer hears nothing until you approve an update.",
  propose_hotel: "The driver gets the hotel address in the app.",
  propose_date_change: "Nobody yet. A customer update is drafted for you to send.",
  propose_cost: "Nobody. The cost is recorded on the order.",
  draft_customer_update: "The customer, but only when a person sends it.",
  escalate: "Nobody. You take it from here.",
}

const ESCALATION_EFFECTS: Record<Response, string> = {
  go_ahead: "",
  change_it: "",
  take_over: "You own the case now. BahnBot stops and keeps the history.",
  not_this: "BahnBot keeps the case and your reason is kept.",
}

const ACTOR: Record<string, Actor> = {
  driver: "driver", customer: "customer", handoff_contact: "customer", site_contact: "site", operator: "ops", agent: "agent",
}

const WHO: Record<Actor, string> = {
  driver: "Driver", customer: "Customer", site: "Site", ops: "Ops", agent: "BahnBot", system: "System",
}

const WINDOW_LABEL: Record<string, string> = {
  CUSTOMER_DELIVERY_PROMISE: "Delivery promise",
  SELECTED_PICKUP_SLOT: "Pickup slot",
}

const WINDOW_EVIDENCE: Record<string, [Evidence["strength"], string]> = {
  CUSTOMER: ["claimed", "customer said"],
  OPS: ["reported", "set by ops"],
  SYSTEM: ["reported", "system estimate"],
  SITE: ["observed", "site replied"],
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

function terminalZone(name: string): string | null {
  const lead = name.split(" ").slice(0, 2).join(" ").toLowerCase()
  const terminal = packet().all("ferry_terminals").find((t) => str(t.name).toLowerCase().startsWith(lead))
  return terminal ? str(terminal.timezone) : zoneOf(name)
}

const OPEN_WORK: Record<string, AgentWork["status"]> = { PENDING_REVIEW: "Waiting for review", APPROVED_AWAITING_EXECUTION: "Approved, not yet done" }

// What Bahn's own agents proposed or tried on this order that is still open: the decision a person faces.
function agentWork(order: Rec): AgentWork[] {
  const p = packet()
  return p.forOrder(order.id, "agent_proposals").flatMap((a): AgentWork[] => {
    const execution = a.execution as Rec | null
    const by = str(p.byId("agents", str(a.proposed_by_agent_id))?.title) || "Bahn agent"
    if (a.status === "FAILED") return [{ status: "Failed", text: str(a.summary), detail: str(execution?.error) || null, by, at: str(execution?.attempted_at) || str(a.created_at) }]
    const status = OPEN_WORK[str(a.status)]
    return status ? [{ status, text: str(a.summary), detail: null, by, at: str(a.created_at) }] : []
  }).sort((a, b) => a.at.localeCompare(b.at))
}

// What a shortened headline left out: the following sentences, or the whole text if it was cut mid-sentence.
function restAfter(full: string): string | null {
  const short = shortHeadline(full)
  if (short === full.trim()) return null
  return short.endsWith("…") ? full.trim() : full.trim().slice(short.length).trim()
}

function decisionCard(d: CaseDecision): DecisionCard {
  const change: string[] = []
  let cost: DecisionCard["cost"] = null
  if (d.action === "propose_booking") {
    const option = packet().byId("travel_options", str(d.payload.option_id))
    if (option) {
      const zone = terminalZone(str(option.from_city))
      change.push(`Book ${option.provider}, ${option.from_city} → ${option.to_city}`)
      change.push(`Departs ${fmtDateTime(str(option.departure_at), zone)}, check-in closes ${fmtDateTime(str(option.check_in_cutoff_at), zone)}`)
      if (typeof option.quote_cents === "number") {
        cost = { cents: option.quote_cents, currency: str(option.currency) || "EUR", note: "quoted at the last check, not yet booked" }
      }
    }
  } else if (d.action === "propose_hotel") {
    change.push(`One hotel night in ${str(d.payload.city)}, night of ${str(d.payload.night_of)}`)
    cost = { cents: HOTEL_NIGHT_CENTS, currency: "EUR", note: "mock rate" }
  } else if (d.action === "propose_date_change") {
    change.push(`New delivery date: ${str(d.payload.new_date)}`)
  } else if (d.action === "propose_cost") {
    cost = { cents: Number(d.payload.amount_cents ?? 0), currency: str(d.payload.currency) || "EUR", note: str(d.payload.why) }
  } else if (d.action === "draft_customer_update") {
    change.push(str(d.payload.body))
  } else if (d.action === "escalate") {
    for (const fact of (d.payload.what_i_know as string[]) ?? []) change.push(`Known: ${fact}`)
    for (const gap of (d.payload.what_i_dont_know as string[]) ?? []) change.push(`Not known: ${gap}`)
  }
  const decided = d.status !== "PROPOSED" && d.status !== "SNOOZED"
  return {
    id: d.id,
    status: d.status,
    action: d.action,
    headline: shortHeadline(decisionTitle(d.action, d.headline)),
    detail: d.action === "draft_customer_update" ? null : restAfter(d.headline),
    change,
    cost,
    whoIsTold: WHO_IS_TOLD[d.action] ?? "Nobody outside the team.",
    effects: actionFor(d.action)?.effects ?? ESCALATION_EFFECTS,
    blockers: d.blockers,
    evidence: d.evidence.filter((e) => e && typeof e.label === "string") as Evidence[],
    outcome: decided ? { response: d.response, reason: d.reason, by: d.decidedBy, effect: str(d.effect?.summary) || null } : null,
    undoUntil: d.undoUntil,
  }
}

function travelLabel(option: Rec, all: Rec[]): string {
  if (option.kind !== "FERRY") return `${String(option.kind).toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} option`
  if (option.status === "SOLD_OUT") return "Planned crossing"
  const soldOutBefore = all.some((o) => o.kind === "FERRY" && o.status === "SOLD_OUT" && str(o.departure_at) < str(option.departure_at))
  return soldOutBefore ? "Later crossing" : "Crossing option"
}

function facts(order: Rec, runs: CaseRun[]): Fact[] {
  const p = packet()
  const out: Fact[] = []
  for (const w of p.forOrder(order.id, "time_windows")) {
    const label = WINDOW_LABEL[str(w.purpose)]
    if (!label) continue
    const [strength, chip] = WINDOW_EVIDENCE[str(w.source)] ?? ["reported", "system record"]
    out.push({ label, value: fmtRange(str(w.start_at), str(w.end_at), str(w.timezone)), evidence: { strength, label: chip, at: str(w.start_at) } })
  }
  const options = p.forOrder(order.id, "travel_options")
  for (const t of options) {
    const zone = terminalZone(str(t.from_city))
    const price = typeof t.quote_cents === "number" ? `, €${Math.round(t.quote_cents / 100)}` : ""
    out.push({
      label: travelLabel(t, options),
      value: `${t.provider}, departs ${fmtDateTime(str(t.departure_at), zone)}${price}`,
      evidence: evidenceFor({ kind: "travel_option", status: str(t.status), at: str(t.checked_at) }),
    })
  }
  for (const r of p.forOrder(order.id, "travel_reservations")) {
    const from = str(r.provider) || str(r.origin_terminal) || str(r.from_city) || str(r.city)
    const zone = terminalZone(str(r.origin_terminal) || str(r.from_city) || str(r.city))
    out.push({
      label: `Booked ${String(r.kind).toLowerCase()}`,
      value: `${from}, departs ${fmtDateTime(str(r.departure_at), zone)}`,
      evidence: evidenceFor({ kind: "travel_reservation", status: str(r.status), at: str(r.booked_at ?? r.created_at) }),
    })
  }
  for (const a of p.forOrder(order.id, "agent_proposals")) {
    const execution = a.execution as Rec | null
    if (execution && /timed out/i.test(str(execution.error))) {
      out.push({
        label: "Earlier booking attempt",
        value: "Timed out with no confirmation",
        evidence: evidenceFor({ kind: "booking_attempt", outcome: "TIMED_OUT", at: str(execution.attempted_at) }),
      })
    }
  }
  for (const run of runs) {
    for (const step of run.steps) {
      const output = step.output as Rec | undefined
      if (step.kind !== "tool_result" || !output) continue
      if (step.tool === "check_provider_status" && output.evidence) {
        out.push({ label: "Provider's answer", value: str(output.answer), evidence: output.evidence as Evidence })
      }
      if ((step.tool === "call_driver" || step.tool === "call_site") && output.recorded) {
        for (const a of output.answers as { fact: string; evidence: Evidence }[]) out.push({ label: "Said on a call", value: a.fact, evidence: a.evidence })
      }
      const reply = output.reply as Rec | null | undefined
      if (step.tool === "message_driver" && reply) {
        out.push({ label: "Driver's reply", value: str(reply.text), evidence: reply.evidence as Evidence })
      }
    }
  }
  return out
}

function stepLine(steps: Step[]): string[] {
  const words: Record<string, string> = {
    get_case: "Read the case", get_travel_options: "Looked at travel options", check_provider_status: "Checked with the provider",
    message_driver: "Asked the driver", call_driver: "Called the driver", call_site: "Called the site",
    price_alternatives: "Priced alternatives", get_road_estimate: "Checked road time", get_ferry_terminals: "Looked up terminals",
  }
  return steps
    .filter((s) => s.kind === "tool_call" || s.kind === "guard_refusal" || s.kind === "blocked")
    .map((s) => s.kind === "guard_refusal" ? `Stopped by a rule: ${s.text}` : s.kind === "blocked" ? "Held back a proposal until a blocker was cleared" : words[s.tool ?? ""] ?? `Used ${s.tool}`)
}

export function buildCase(input: CaseInput): CaseView | null {
  const p = packet()
  const order = p.orderByRef(input.reference)
  if (!order) return null
  const item = p.forOrder(order.id, "order_items").find((i) => i.role === "PRIMARY")
  const vehicle = item ? p.byId("vehicles", str(item.vehicle_id)) : undefined
  const pickup = p.byId("addresses", str(order.pickup_address_id))
  const delivery = p.byId("addresses", str(order.delivery_address_id))
  const customer = p.byId("customers", str(order.customer_id))
  const assignment = p.forOrder(order.id, "work_assignments").find((a) => !a.cancelled_at)
  const driver = assignment ? p.byId("drivers", str(assignment.driver_id)) : undefined
  const site = order.pickup_site_id ? p.byId("sites", str(order.pickup_site_id)) : undefined

  const thread: ThreadItem[] = [
    ...p.forOrder(order.id, "messages").map((m): ThreadItem => {
      const actor = ACTOR[str(m.author_type)] ?? "system"
      return {
        // A packet agent is one of Bahn's existing agents, not BahnBot.
        at: str(m.authored_at), actor,
        who: actor === "agent" ? str(p.byId("agents", str(m.author_id))?.title) || "Bahn agent" : str(m.author_name_snapshot) || WHO[actor],
        text: str(m.body), evidence: evidenceFor({ kind: "message", authorType: str(m.author_type), at: str(m.authored_at) }),
      }
    }),
    ...p.forOrder(order.id, "alerts").map((a): ThreadItem => ({
      at: str(a.triggered_at), actor: "system", who: "Alert", text: str(a.summary), evidence: evidenceFor({ kind: "alert", at: str(a.triggered_at) }),
    })),
    ...input.runs.map((run): ThreadItem => ({
      at: run.startedAt, actor: "agent", who: "BahnBot", text: run.summary ?? "Working on it.",
      evidence: { strength: "reported", label: "agent wrote", at: run.startedAt }, steps: stepLine(run.steps), mode: run.mode,
    })),
    ...input.runs.flatMap((run) => run.steps
      .filter((step) => step.kind === "tool_result" && (step.tool === "call_driver" || step.tool === "call_site") && (step.output as Rec)?.recorded)
      .map((step): ThreadItem => {
        const output = step.output as Rec & { transcript: CallView["transcript"]; with: CallView["with"]; who: string }
        return {
          at: output.transcript[0]?.at ?? step.at, actor: "agent", who: "BahnBot",
          text: `Called ${output.with === "driver" ? "the driver" : output.who} (${output.transcript.length} turns).`,
          evidence: { strength: "reported", label: "recorded call", at: step.at },
          call: { with: output.with, who: output.who, transcript: output.transcript }, mode: run.mode,
        }
      })),
    ...input.decisions.filter((d) => d.decidedAt && d.response).map((d): ThreadItem => ({
      at: d.decidedAt!, actor: "ops", who: d.decidedBy ?? "Ops",
      text: `${d.response!.replace("_", " ")}: ${d.headline}${d.reason ? `. ${d.reason}` : ""}`,
      evidence: { strength: "reported", label: "ops decided", at: d.decidedAt! },
    })),
    ...(input.incoming ?? []).map((f): ThreadItem => ({
      at: f.at, actor: "system", who: f.source, text: f.text, evidence: { strength: "observed", label: f.source, at: f.at },
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  // The card at the top is the open decision, or else the latest one with its outcome.
  // An approval in flight stays on top until it is done; then the agent's hand-over, proposals, drafts; ties by id.
  const inFlight = (d: CaseDecision) => (d.status === "APPROVED" || d.status === "EXECUTING" ? 0 : 1)
  const pending = input.decisions.filter((d) => d.status === "PROPOSED" || d.status === "APPROVED" || d.status === "EXECUTING")
    .sort((a, b) => inFlight(a) - inFlight(b) || decisionRank(a.action) - decisionRank(b.action) || a.id.localeCompare(b.id))[0]
    ?? [...input.decisions].filter((d) => d.decidedAt).sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!))[0]
  const latestRun = [...input.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  // The newest open alert is the current situation; older ones are history.
  const alert = p.forOrder(order.id, "alerts").filter((a) => a.status !== "RESOLVED")
    .sort((a, b) => str(b.triggered_at).localeCompare(str(a.triggered_at)))[0]
  // The headline is the situation; the decision card below carries the ask.
  const headline = (latestRun?.summary && situationFrom(latestRun.summary))
    || (input.watchLine && shortHeadline(input.watchLine))
    || shortHeadline(pending && (pending.status === "PROPOSED" || pending.status === "APPROVED") ? decisionTitle(pending.action, pending.headline)
      : plainReason(str(alert?.summary) || "Nothing is waiting on this order.").text)

  const promise = p.forOrder(order.id, "time_windows").find((w) => w.purpose === "CUSTOMER_DELIVERY_PROMISE")
  const nowIso = now().toISOString()
  const opens = promise ? relativeTo(str(promise.start_at), nowIso) : null
  const closes = promise ? relativeTo(str(promise.end_at), nowIso) : null
  const when = (r: ReturnType<typeof relativeTo>, verb: [string, string]) => (r ? (r.past ? `${verb[1]} ${r.text}` : `${verb[0]} ${r.text}`) : "")
  const route = `${pickup?.city ?? "?"} → ${delivery?.city ?? "?"}`

  return {
    reference: input.reference,
    orderId: order.id,
    car: vehicle ? `${vehicle.make} ${vehicle.model}` : "Car not recorded",
    route,
    customer: str(customer?.name),
    driver: driver ? str(driver.display_name) : "No driver assigned",
    headline,
    decision: pending ? decisionCard(pending) : null,
    agentWork: agentWork(order),
    // A superseded proposal was replaced by BahnBot's newer one, so it is not shown as a separate decision.
    history: input.decisions.filter((d) => d !== pending && d.status !== "SUPERSEDED").map(decisionCard),
    thread,
    facts: [...facts(order, input.runs), ...(input.incoming ?? []).map((f): Fact => ({
      label: "New since the snapshot", value: f.text, evidence: { strength: "observed", label: f.source, at: f.at },
    }))],
    chain: [...input.chain].sort((a, b) => a.seq - b.seq),
    properties: [
      { label: "Deadline", value: promise
        ? `Delivery ${fmtRange(str(promise.start_at), str(promise.end_at), str(promise.timezone))} · ${when(opens, ["opens", "opened"])}, ${when(closes, ["closes", "closed"])}`
        : "None recorded" },
      { label: "Driver", value: driver ? `${driver.display_name}, home ${driver.home_city}` : "No driver assigned" },
      { label: "Route", value: route },
      { label: "Car", value: vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.model_year}` : "Not recorded" },
      { label: "Pickup place", value: site ? str(site.name) : str(pickup?.name) || "Private address" },
      { label: "Customer", value: str(customer?.name) },
    ],
    recorded: input.runs.some((r) => r.mode === "recorded"),
  }
}
