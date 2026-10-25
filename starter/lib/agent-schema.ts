// Agent state, kept apart from the starter's tables so `npm run db:seed` can reseed the packet (ADR-005).
// Timestamps are always written explicitly from lib/clock or the packet, never from the database clock.
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core"

type Json = Record<string, unknown>
const at = (name: string) => timestamp(name, { withTimezone: true })

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    orderRef: text("order_ref").notNull(),
    trigger: text("trigger").notNull(), // watch | on_the_road | ask
    mode: text("mode").notNull(), // recorded | live
    status: text("status").notNull(), // running | done | failed
    model: text("model"),
    summary: text("summary"),
    startedAt: at("started_at").notNull(),
    finishedAt: at("finished_at"),
  },
  (t) => [index("agent_runs_order_idx").on(t.orderRef)],
)

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(), // thought | tool_call | tool_result | guard_refusal | message
    tool: text("tool"),
    input: jsonb("input").$type<Json>(),
    output: jsonb("output").$type<unknown>(),
    text: text("text"),
    at: at("at").notNull(),
  },
  (t) => [index("agent_steps_run_idx").on(t.runId, t.seq)],
)

export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => agentRuns.id),
    orderRef: text("order_ref").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Json>().notNull(),
    /** A person's edit from "Change it"; the agent's payload stays as proposed. */
    approvedPayload: jsonb("approved_payload").$type<Json>(),
    // Set when BahnBot's newer proposal of the same kind replaced this one (lib/decisions/supersede.ts).
    supersededBy: text("superseded_by"),
    headline: text("headline").notNull(),
    // PROPOSED | APPROVED | EXECUTING | EXECUTED | FAILED | DECLINED | TAKEN_OVER | SNOOZED
    status: text("status").notNull(),
    response: text("response"),
    reason: text("reason"),
    decidedBy: text("decided_by"),
    decidedAt: at("decided_at"),
    undoUntil: at("undo_until"),
    blockers: jsonb("blockers").$type<string[]>().notNull(),
    evidence: jsonb("evidence").$type<Json[]>().notNull(),
    effect: jsonb("effect").$type<Json>(),
    createdAt: at("created_at").notNull(),
  },
  (t) => [index("decisions_order_idx").on(t.orderRef), index("decisions_status_idx").on(t.status)],
)

export const caseChain = pgTable("case_chain", {
  id: text("id").primaryKey(),
  orderRef: text("order_ref").notNull(),
  decisionId: text("decision_id").references(() => decisions.id),
  seq: integer("seq").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(), // waiting | in_progress | done | failed
  createdAt: at("created_at").notNull(),
})

export const watchFlags = pgTable(
  "watch_flags",
  {
    id: text("id").primaryKey(),
    orderRef: text("order_ref").notNull(),
    level: text("level").notNull(), // fine | watch | likely_to_slip
    signals: jsonb("signals").$type<Json[]>().notNull(),
    line: text("line").notNull(),
    lineSource: text("line_source").notNull(), // template | model
    nextStep: text("next_step"), // the cheap next step the model picked (ADR-008), when it wrote the line
    policyVersion: integer("policy_version").notNull(),
    evaluatedAt: at("evaluated_at").notNull(),
    clearedAt: at("cleared_at"),
  },
  (t) => [index("watch_flags_order_idx").on(t.orderRef)],
)

export const mishaps = pgTable("mishaps", {
  id: text("id").primaryKey(),
  orderRef: text("order_ref").notNull(),
  cause: text("cause").notNull(), // route | mode | vehicle | dealership | unclear
  signal: text("signal").notNull(),
  evidence: jsonb("evidence").$type<Json[]>().notNull(),
  attributedBy: text("attributed_by").notNull(), // rule | model
  occurredAt: at("occurred_at").notNull(),
})

export const failureSources = pgTable("failure_sources", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // route | mode | make | dealership
  key: text("key").notNull(),
  label: text("label").notNull(),
  k: integer("k").notNull(),
  n: integer("n").notNull(),
  shrunkRate: real("shrunk_rate").notNull(),
  upcoming: integer("upcoming").notNull(),
  stale: boolean("stale").notNull(),
  policyVersion: integer("policy_version").notNull(),
})

export const policyVersions = pgTable("policy_versions", {
  version: integer("version").primaryKey(),
  params: jsonb("params").$type<Json>().notNull(),
  status: text("status").notNull(), // CANDIDATE | ADOPTED | REJECTED | ROLLED_BACK
  parentVersion: integer("parent_version"),
  createdAt: at("created_at").notNull(),
  adoptedAt: at("adopted_at"),
  adoptedBy: text("adopted_by"),
  overrideReason: text("override_reason"),
})

export const casebook = pgTable("casebook", {
  orderRef: text("order_ref").primaryKey(),
  mishaps: jsonb("mishaps").$type<Json[]>().notNull(),
  fixes: jsonb("fixes").$type<Json[]>().notNull(),
  outcome: text("outcome").notNull(),
  blockers: jsonb("blockers").$type<Json[]>().notNull(),
  updatedAt: at("updated_at").notNull(),
})

export const learningRuns = pgTable("learning_runs", {
  id: text("id").primaryKey(),
  round: integer("round").notNull(),
  fromVersion: integer("from_version").notNull(),
  candidateVersion: integer("candidate_version"),
  trigger: text("trigger").notNull(), // manual | new_data | reopen
  candidate: jsonb("candidate").$type<Json>(),
  metrics: jsonb("metrics").$type<Json>().notNull(),
  status: text("status").notNull(), // queued | done
  createdAt: at("created_at").notNull(),
})

export const reopenEvents = pgTable("reopen_events", {
  id: text("id").primaryKey(),
  orderRef: text("order_ref").notNull(),
  decisionId: text("decision_id").references(() => decisions.id),
  blocker: text("blocker").notNull(),
  clearedBy: jsonb("cleared_by").$type<Json>().notNull(),
  status: text("status").notNull(), // open | decided
  at: at("at").notNull(),
})

export const interventions = pgTable("interventions", {
  id: text("id").primaryKey(),
  decisionId: text("decision_id")
    .notNull()
    .references(() => decisions.id),
  orderRef: text("order_ref").notNull(),
  response: text("response").notNull(), // change_it | take_over | not_this
  reason: text("reason").notNull(),
  actor: text("actor").notNull(),
  at: at("at").notNull(),
})

// New facts that arrive after the snapshot (ADR-011); the packet itself never changes (ADR-015).
export const incomingFacts = pgTable("incoming_facts", {
  id: text("id").primaryKey(),
  orderRef: text("order_ref").notNull(),
  text: text("text").notNull(),
  source: text("source").notNull(),
  clears: text("clears"),
  arrivedAt: at("arrived_at").notNull(),
})
