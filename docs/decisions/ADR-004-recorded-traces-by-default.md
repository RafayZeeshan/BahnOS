# ADR-004: Recorded agent traces by default, live runs with an API key

## Status
Accepted

## Date
2026-10-24

## Context
The submission "should run from a fresh clone with the steps in your README". Judges may not have, or want to spend, an API key. The brief also says "the agent has to be real: a language model doing the work in a loop", and asks for "agent traces … if you have them".

## Decision
- The agent is a tool loop calling the **Claude API from TypeScript** (`/api/agent/run`, `/api/agent/watch`, `/api/agent/chat`).
- **Default mode replays recorded traces** from `traces/*.json`. These are real runs, captured during the build and committed. A visible **"recorded run"** badge says so.
- **Live mode** turns on when `ANTHROPIC_API_KEY` is set in the app's `.env`. A "run live" action then appears beside the badge.
- The model ID comes from configuration, not code.
- The video shows at least one **live** run, so that the "real agent" claim is visible and not only asserted.

## Alternatives Considered

### Live only
- Rejected: A fresh clone without a key would show an empty or broken app.

### Hand-written fake traces
- Rejected: That fails "the agent has to be real", and would be dishonest in the AI log.

## Consequences
- Every demo order needs a trace recorded before the 13:15 freeze.
- If the replay and live paths drift apart, a recorded run may show behaviour the live code no longer has. Re-record after any change to a tool or the prompt.
- The key lives only in a git-ignored `.env`. `.env` and `.env.*` are already ignored at the repo root; `.env.example` lists `ANTHROPIC_API_KEY=` with no value.
- The Next.js app reads `.env` from the directory it runs in (`starter/`), not from the repo root. The README must say where to put the key.
