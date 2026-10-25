# ADR-003: Freeze time at the snapshot

## Status
Accepted

## Date
2026-10-24

## Context
The dataset is one fixed snapshot with no live clock. Every deadline, slack value, stale quote and "upcoming order" depends on what "now" is. If code reads the wall clock, then a slack bar such as "check-in closes in 6 h 40 m" would be wrong the day after the hackathon. Judges watching later would see nonsense, and the numbers in the video would not match the app.

## Decision
- "Now" is **`2026-10-21T09:00Z`**, served by one module, `lib/clock.ts`.
- Nothing in agent or UI paths calls `Date.now()` or `new Date()` without an argument. A lint rule or grep check in CI enforces this.
- The header shows a **"now" chip**, so a viewer knows the time is frozen.
- The replay engine (ADR-010) passes an explicit time `t` instead of reading the clock.

## Alternatives Considered

### Real wall-clock time
- Rejected: Every deadline in the packet is already in the past.

### Shift all data timestamps to be relative to today
- Pros: The app looks live.
- Cons: Rewrites the packet, makes the record timestamps disagree with the attachments, and adds a step to seeding.
- Rejected.

## Consequences
- Every number is reproducible from a fresh clone on any day.
- Code that needs elapsed time for real work (timeouts, the undo window) still uses the real clock. That is allowed outside the agent and UI paths.
