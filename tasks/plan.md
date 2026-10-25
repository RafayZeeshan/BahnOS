# Task plan

Source: [docs/SPEC.md](../docs/SPEC.md). Each task follows test first, then code, then the full test run, typecheck, build and its own commit. Tasks run in this order unless a dependency says otherwise. Status: `[ ]` pending, `[x]` done, `[!]` blocked.

## Phase 0: Setup
- [x] **T0 Working baseline.** Install dependencies, add Vitest (`npm test`), start Docker, push the schema, seed, boot the app. The env loader reads `starter/.env`, then the root `.env`; `ANTHROPIC_API_KEY` falls back to `CLAUDE_API_KEY`. *Accept:* `npm test`, `npm run typecheck` and `npm run build` pass; `/` loads the seeded orders. *Needs:* Docker running.
- [x] **T1 Frozen clock** (ADR-003). `lib/clock.ts` plus a scan test for `Date.now()` and zero-argument `new Date()` in agent and UI paths. *Accept:* the test fails on a planted call and passes clean.
- [x] **T2 Agent tables** (ADR-005). Drizzle schema for the new tables; `npm run agent:seed` writes policy v1. *Accept:* push and both seeds run twice without error.

## Phase 1: Hero slice (gate)
- [x] **T3 Evidence ladder** (ADR-007). `lib/present/evidence.ts`. *Accept:* unit tests for each strength across the packet's record kinds.
- [x] **T4 Typed actions and guard** (ADR-002). *Accept:* tests show a customer contact is refused, a propose action without approval is refused, a read is allowed, and each action's blockers are listed.
- [x] **T5 Agent loop and traces** (ADR-001, 004). *Live check passed via OpenRouter: CD-420299 calls `check_provider_status` before proposing.* Tool implementations over the packet, the Claude loop, trace record and replay, `/api/agent/run`. *Accept:* a replay test reproduces the stored steps; with a key, a live run on CD-420299 calls `check_provider_status` and does not propose a rebooking before verifying.
- [x] **T6 Decisions and executor** (ADR-006). `/api/decisions/:id`, interventions, undo window, state machine, chain step. *Accept:* the state machine is tested for every transition; a missing reason is refused for interventions.
- [x] **T7 CD-420299 end to end.** *Recorded live trace; Go ahead ran the booking to EXECUTED.* Recorded trace plus a minimal decision card page. *Accept:* opening CD-420299 shows the headline, facts with chips and the decision; Go ahead runs through to EXECUTED. **Gate.**

## Phase 2: Control room
- [x] **T8 Shell and tokens** (ADR-013). Tokens (light + dark), bundled font, sidebar, header with the "now" chip and recorded badge.
- [x] **T9 Today queue.** Needs you rows, quiet fold, split pane, `J`/`K`/`Enter`/`1`–`4`/`H`/`Esc`, empty, loading and error states.
- [x] **T10 Case view.** Headline, decision card, thread, facts, chain, properties.
- [x] **T11 Ask the agent** (ADR-001). `/api/agent/chat` plus the inline thread composer with a working state. *Answers live.*

## Phase 3: Engine, Watch and risk
- [x] **T12 `evaluate(policy, order, t)`** (ADR-010). *Accept:* a no-leakage test, and determinism.
- [x] **T13 Watch** (ADR-008). *LLM lines recorded live for all 9 flagged orders.* Sweep, levels, `/api/agent/watch`, LLM line on flagged orders, Heads-up cards with the slack bar. *Accept:* at least 3 real flags; CD-420603 slack is correct against the data.
- [x] **T14 Mishaps and failure sources** (ADR-009). Rules-first attribution, k-of-n with shrinkage, the Risk outlook strip and drill-down. *Accept:* every mishap order has a cause; under 3 orders shows "too few to say"; no driver is scored.

## Phase 4: Dream
- [x] **T15 Casebook and replay** (ADR-011). *Accept:* lead time, hit rate and false alarms with n, labelled held-out or in-sample.
- [x] **T16 Learning loop.** Propose, probe, compose, stop; recorded rounds v1 → v3; maturity labels; adopt, rollback and override; the "What the agent learned" screen.
- [x] **T17 New data and reopen watcher.** Stale marking, the "New since" chip, Back on the table, a triggered run.
- [x] **T18 Simulation.** Perturbed copies of orders, labelled and never stored as orders.

## Phase 5: Map
- [x] **T19 Geo seed and route strip** (ADR-012).
- [x] **T20 Leaflet map and driver preview.**

## Phase 6: Voice (ADR-014)
- [x] **T21 Recorded calls.** `call_site` / `call_driver` with a guard on the callee's role, recorded call items in the thread, and "said on a call" facts.
- [!] **T22 Live voice sidecar.** Blocked: prometheus licence or written permission, plus `uv`, `cargo` and `ffmpeg` installed.

## Phase 7: Finish
- [x] **T23 Traces** for all six demo orders. *Recorded live through OpenRouter.*
- [x] **T24 Secondary pages.** Restyle, `⌘K`, `⌘B`, view options. *Done: `⌘K` command menu, `?` shortcut help, G-then-letter navigation; the starter pages share the tokens. Cut, per the plan's cut list: `⌘B` and view options beyond the tabs.*
- [x] **T25 Hand-in.** README fresh-clone steps, `docs/AI-LOG.md`, the tired-ops review with fixes, a fresh-clone test in a new directory.
