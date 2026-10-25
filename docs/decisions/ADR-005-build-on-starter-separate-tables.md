# ADR-005: Build on the Next.js starter, with new tables kept separate

## Status
Accepted

## Date
2026-10-24

## Context
The packet includes an optional Next.js, TypeScript and Postgres starter that already loads all 100 orders and has an order page, an inbox, and pages for customers, drivers and places. Its board of lanes is "how people have worked so far, not the answer". The starter's `AGENTS.md` warns that its Next.js version has breaking changes compared with what coding agents know, and says to read the bundled docs first.

## Decision
- Keep the starter (Next.js, Postgres, the starter's seed) as the base.
- Put everything new in **separate tables**, so `npm run db:seed` can reseed the packet without touching our data: `agent_runs`, `agent_steps`, `decisions`, `case_chain`, `watch_flags`, `mishaps`, `failure_sources`, `policy_versions`, `casebook`, `learning_runs`, `reopen_events`, `interventions`.
- API routes:
  - `/api/agent/run`: the tool loop
  - `/api/agent/watch`: the sweep
  - `/api/agent/chat`: ops talk to the agent about a case
  - `/api/decisions/:id`: a person's response to a decision
- `scripts/dream.ts` runs the learning loop offline.
- The starter's board stays as **All orders**, restyled. **Today** (ADR-013) is the new home page.
- Coding agents read the Next.js docs in `node_modules/next/dist/docs/` before writing framework code, as the starter's `AGENTS.md` says.

## Alternatives Considered

### Start from scratch
- Rejected: Spends hours rebuilding loaders and pages the packet already gives us.

### Add columns to the starter's tables
- Rejected: Reseeding would wipe or conflict with agent state, and the diff against the packet would be harder to review.

## Consequences
- Reseeding is safe at any time.
- Joins between agent tables and packet tables go through the order reference and the packet IDs.
- The fresh-clone steps are the starter's steps plus our migration and trace seed.
