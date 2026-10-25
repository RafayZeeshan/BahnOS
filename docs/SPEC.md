# Spec: Recovery Control Room

Derived from [BUILD-PLAN.md](../BUILD-PLAN.md) and the ADRs in [docs/decisions/](decisions/README.md). This spec adds no requirements of its own. Where the two disagree, the ADR wins.

## Objective
Bahn's ops team gets a control room where an agent watches every trip, gathers facts, and brings a person only the orders that need one, each with one decision and evidence for every fact. Judged on: the control room (40%), how we worked with AI (30%), and taste (30%). Hand-in: Sunday 2026-10-25 15:00, a 2–3 min video and a public repo that runs from a fresh clone.

## Users
Operations people at Bahn. Not engineers. They need to know what is wrong and what to do at a glance.

## Tech stack
- The packet's starter: Next.js 16, React 19, TypeScript, Drizzle ORM, Postgres 17 and RustFS (attachments) via Docker Compose.
- The agent: a Claude API tool loop in TypeScript (`@anthropic-ai/sdk`). The model ID comes from configuration.
- Map: Leaflet with OpenStreetMap tiles.
- Tests: Vitest for unit and integration tests.
- Voice (optional sidecar): forked prometheus voice service in Python and Rust, in `voice/`.

## Commands (from `starter/`)
```
cp .env.example .env
npm ci
docker compose up -d --wait
npm run db:push && npm run db:seed && npm run attachments:seed
npm run agent:seed        # our tables, policy v1, recorded traces
npm run dev               # http://localhost:3000
npm test                  # vitest
npm run typecheck
npm run build
```

## Capabilities and acceptance criteria

### C1. Agent core (ADR-001, 002, 004)
- One Recovery agent with three triggers: Watch, On the road, Ask.
- Tools as listed in ADR-002, plus `call_site` and `call_driver` (ADR-014).
- `lib/policy/guard.ts` refuses: any contact with a customer, and any propose action that goes ahead without approval. Tests prove both.
- Typed actions in `lib/actions/*.ts` declare parameters, validation, approver, the effect of each response, and blockers.
- Default mode replays `traces/*.json` with a "recorded run" badge. Live mode runs when `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) is set in `starter/.env` or the repo-root `.env`.
- `escalate` records what the agent knows and what it doesn't.

### C2. Time (ADR-003)
- `lib/clock.ts` returns `2026-10-21T09:00:00Z`. A test fails if agent or UI paths call `Date.now()` or a zero-argument `new Date()`.

### C3. Data (ADR-005)
- New tables as listed in ADR-005, separate from the starter's. `npm run db:seed` still works after they exist.

### C4. Decisions (ADR-006)
- Every decision card offers Go ahead / Change it / Take over / Not this (a reason is required for the last three), plus Snooze.
- Interventions are stored. A 5-second undo runs before execution.
- The executor moves the action `APPROVED → EXECUTING → EXECUTED | FAILED`, writes the effect, and creates the next chain step.
- History is never lost.

### C5. Evidence (ADR-007)
- `lib/present/evidence.ts` maps every fact to Claimed / Reported / Observed / Verified, with a source and time, as icon + text.
- Every fact on the case view has a chip.

### C6. Watch (ADR-008)
- A rule-based sweep over every order with travel, using the eight signals in ADR-008.
- Each order gets Fine / Watch / Likely to slip. The LLM writes the line only for Watch and above.
- Thresholds are policy parameters.
- At least three real flags from the data, with slack in plain words.

### C7. Risk outlook (ADR-009)
- Every mishap order gets a cause (route / mode / vehicle / dealership / unclear) with evidence.
- Failure sources show "k of n" with shrinkage. Under 3 orders shows "too few to say", in the drill-down only.
- Upcoming exposure is counted at the frozen "now".
- No driver is ranked or scored anywhere.

### C8. Engine (ADR-010)
- A pure `evaluate(policy, order, t)` that ignores events whose `recorded_at` or `received_at` is after `t`. A test proves there is no leakage.
- Simulated orders are labelled and never stored as orders.

### C9. Dream (ADR-011)
- Casebook built from existing tables.
- Replay at checkpoints reports lead time, hit rate and false alarms, each with n and labelled held-out or in-sample.
- Recorded learning rounds v1 → v2 → v3.
- Maturity label per failure type.
- Adopt / change / reject / rollback. A candidate that scores worse needs an override and a reason.
- New data marks sources stale and queues a run.
- The reopen watcher puts cases under "Back on the table" and starts a learning run.

### C10. Map (ADR-012)
- `data/geo/*.json` from `scripts/geo-seed.ts`, every value marked `synthetic: true`.
- Times from the packet win over synthetic ones.
- Route strip always shown. The Leaflet map when tiles load.
- Leg style by evidence. ETA with its basis. Driver preview on the decision card.

### C11. Control room UI (ADR-013)
- Today: Needs you / Heads-up / Risk outlook / Back on the table / Handled quietly.
- Three panes. The case view in the order from ADR-013.
- Designed states for loading, empty, error, recorded run, stale data, tiles failed and small sample.
- Keyboard map with visible buttons. AA contrast. No JSON or raw IDs on main screens.
- Light theme, plus dark.

### C12. Voice (ADR-014)
- `call_site` / `call_driver` refuse customers.
- With voice off, they play a recorded call (transcript + audio) in the thread.
- With `make voice`, a live browser call works on CD-420322.
- Call answers become "said on a call" facts.
- Blocked until: the prometheus licence or written permission, plus `uv`, `cargo` and `ffmpeg` on the machine.

### C13. Hand-in (BUILD-PLAN §10–12)
- The README runs from a fresh clone with no key.
- `docs/AI-LOG.md` lists at least five times we did not take the first answer.
- Traces committed for CD-420299, CD-420322, CD-420154, CD-420399, CD-420603 and CD-420449.
- The tired-ops-person review has been run.
- No secrets committed.

## Boundaries
- **Always:** packet data only (no invented orders); the frozen clock; guard checks before tools run; evidence chips; tests with each change; commits that stage only the task's files.
- **Ask first:** new heavy dependencies, changes to the starter's seed or schema, anything touching secrets, installs that need admin, adding prometheus code before its licence is settled.
- **Never:** contact a customer; real bookings, calls or payments; commit `.env` or model weights; rank drivers; claim accuracy percentages.
