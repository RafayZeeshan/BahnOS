# Architecture decisions

Why the Recovery Control Room is built the way it is. The source is [BUILD-PLAN.md](../../BUILD-PLAN.md).

Don't delete an ADR. When a decision changes, write a new one that supersedes it.

| ADR | Decision | Status |
|---|---|---|
| [001](ADR-001-one-recovery-agent.md) | One Recovery agent with three triggers (Watch, On the road, Ask) | Accepted |
| [002](ADR-002-rules-enforced-in-code.md) | Enforce the brief's rules in code, through typed actions and a guard | Accepted |
| [003](ADR-003-frozen-clock.md) | Freeze time at the snapshot, `2026-10-21T09:00Z` | Accepted |
| [004](ADR-004-recorded-traces-by-default.md) | Recorded agent traces by default, live runs with an API key | Accepted |
| [005](ADR-005-build-on-starter-separate-tables.md) | Build on the Next.js starter, with new tables kept separate | Accepted |
| [006](ADR-006-four-responses-and-executor.md) | Four human responses, and "approved is not done" | Accepted |
| [007](ADR-007-evidence-ladder.md) | Show every fact with an evidence ladder | Accepted |
| [008](ADR-008-watch-cheap-first.md) | Watch: a rule-based sweep first, the LLM only on flagged cases | Accepted |
| [009](ADR-009-risk-by-failure-source.md) | Model risk by source of failure, never by driver | Accepted |
| [010](ADR-010-single-evaluate-engine.md) | One `evaluate(policy, order, t)` engine for Watch, replay and simulation | Accepted |
| [011](ADR-011-dream-policy-learning.md) | Dream learns by changing the policy around a fixed model; a person adopts each change | Accepted |
| [012](ADR-012-map-leaflet-synthetic-geo.md) | Leaflet map on a labelled synthetic geo layer, with a route-strip fallback | Accepted |
| [013](ADR-013-triage-ui-model.md) | A triage queue, not a board; Linear's interaction patterns but not its look | Accepted; visual system superseded by 016 |
| [014](ADR-014-voice-calls-via-prometheus.md) | Voice calls to drivers and sites through a prometheus sidecar | **Proposed**: pending licence |
| [015](ADR-015-in-memory-packet-index.md) | Read the packet through an in-memory index for the agent and the engine | Accepted |
| [016](ADR-016-premium-ui-system.md) | A premium visual system on Motion and Geist, with details on demand | Accepted |
| [017](ADR-017-ops-map-and-answer-book.md) | Bring in the team's ops map and answer book; the product is BahnOS and the agent BahnBot | Accepted |
