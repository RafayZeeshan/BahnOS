// Root cause per mishap (ADR-009): rules first, from the signal to a source of failure.
// An alert is a reason to look, so the cause is a hypothesis with its evidence; "unclear" is a valid answer.
import { packet, type Packet } from "@/lib/packet"
import { evidenceFor, type Evidence } from "@/lib/present/evidence"

export type Cause = "route" | "mode" | "vehicle" | "dealership" | "unclear"
export type Mishap = { order: string; signal: string; cause: Cause; mode: string | null; at: string; evidence: Evidence; attributedBy: "rule" | "model" }

// A mishap is any alert, incident, failed site visit, sold-out crossing, rejected pickup proof or failed agent action.
const RULES: Record<string, Cause> = {
  FERRY_SOLD_OUT: "mode", FR_IMPORT_TRAVEL_DECISION: "mode", FERRY_CONNECTION_RISK: "mode", FERRY_TRACKING_GAP_CONTEXT: "mode",
  TRAVEL_CAPACITY: "mode", SOLD_OUT_CROSSING: "mode", BOOKING_FAILED: "mode",
  TRACKING_GAP: "route", POSITIONING_AT_RISK: "route", DELIVERY_PROMISE_UNACHIEVABLE: "route",
  SAFETY_STOP: "vehicle", VEHICLE_WARNING: "vehicle", CONDITION_CLAIM: "vehicle", CONDITION_CLAIM_REVIEW: "vehicle",
  POST_DELIVERY_CONDITION_CLAIM: "vehicle",
  RELEASE_DOCUMENT_UNCLEAR: "dealership", SITE_ACCESS_UNCONFIRMED: "dealership", SITE_ACCESS_CONFLICT: "dealership",
  EMPTY_PICKUP: "dealership", VEHICLE_NOT_FOUND: "dealership", PICKUP_PROOF_REJECTED: "dealership", PROOF_REJECTED: "dealership",
}

// Every mode rule in this packet is about a ferry crossing; a mode problem only counts against its own mode.
const MODE_OF: Record<string, string> = {
  FERRY_SOLD_OUT: "ferry", FR_IMPORT_TRAVEL_DECISION: "ferry", FERRY_CONNECTION_RISK: "ferry", FERRY_TRACKING_GAP_CONTEXT: "ferry",
  TRAVEL_CAPACITY: "ferry", SOLD_OUT_CROSSING: "ferry", BOOKING_FAILED: "ferry",
}

export function attributeMishaps(p: Packet = packet()): Mishap[] {
  const out: Mishap[] = []
  const ref = (orderId: unknown) => String(p.byId("orders", String(orderId))?.reference ?? orderId)
  const add = (orderId: unknown, signal: string, at: string, evidence: Evidence) =>
    out.push({ order: ref(orderId), signal, cause: RULES[signal] ?? "unclear", mode: MODE_OF[signal] ?? null, at, evidence, attributedBy: "rule" })

  for (const a of p.all("alerts")) add(a.order_id, String(a.signal), String(a.triggered_at), evidenceFor({ kind: "alert", at: String(a.triggered_at) }))
  for (const i of p.all("incidents")) add(i.order_id, String(i.kind), String(i.opened_at), evidenceFor({ kind: "event", at: String(i.opened_at) }))
  for (const v of p.all("site_visits")) {
    if (v.outcome === "VEHICLE_NOT_FOUND") add(v.order_id, "VEHICLE_NOT_FOUND", String(v.arrived_at), { strength: "observed", label: "driver visit recorded", at: String(v.arrived_at) })
  }
  for (const o of p.all("travel_options")) {
    if (o.status === "SOLD_OUT") add(o.order_id, "SOLD_OUT_CROSSING", String(o.checked_at), evidenceFor({ kind: "travel_option", status: "SOLD_OUT", at: String(o.checked_at) }))
  }
  for (const proof of p.all("proofs")) {
    if (proof.status === "REJECTED") add(proof.order_id, "PROOF_REJECTED", String(proof.reviewed_at ?? proof.submitted_at ?? ""), { strength: "observed", label: "photo rejected in review", at: String(proof.reviewed_at ?? "") })
  }
  for (const a of p.all("agent_proposals")) {
    const execution = a.execution as Record<string, unknown> | null
    if (execution?.error) add(a.order_id, "BOOKING_FAILED", String(execution.attempted_at), evidenceFor({ kind: "booking_attempt", outcome: /timed out/i.test(String(execution.error)) ? "TIMED_OUT" : "FAILED", at: String(execution.attempted_at) }))
  }
  return out.sort((a, b) => a.order.localeCompare(b.order) || a.at.localeCompare(b.at))
}
