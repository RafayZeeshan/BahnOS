# ADR-010: One `evaluate(policy, order, t)` engine for Watch, replay and simulation

## Status
Accepted

## Date
2026-10-24

## Context
Watch (ADR-008), risk (ADR-009) and Dream (ADR-011) all need the same answer: given a policy, what flags, risk and root-cause exposure would this order have shown? Building three versions of that would not fit the time, and the versions would disagree. Replay also needs to stay honest: a past checkpoint must not see events from after it.

## Decision
- A **pure function** `evaluate(policy, order, t)` returns the flags, risk and root-cause exposure **as they would have been known at time `t`**.
- It reads only events with `recorded_at` **and** `received_at` at or before `t`, so no future information leaks in.
- Three uses:
  - **Watch:** `t` = the frozen "now" (ADR-003).
  - **Replay:** `t` = checkpoints before a past mishap (for example 24 h, 6 h and 1 h before the alert).
  - **Simulation:** run on perturbed copies of real orders (ferry sold out, ETA +2 h, stale quote, site not ready, warning light).
- No LLM inside `evaluate`. Scoring stays deterministic.

## Alternatives Considered

### Separate Watch logic and replay logic
- Rejected: The two would drift apart, so replay results would not describe what Watch actually does.

### Replay from the current state of each record
- Rejected: Leaks the future, so lead times would be inflated.

## Consequences
- The packet's 1,352 timestamped events make replay possible. Records without both timestamps are excluded at early checkpoints.
- Simulated orders are labelled and **never written back as orders**. The brief's "no invented orders" holds (synthetic orders were dropped during planning).
- Build this first on Sunday morning. Watch, risk and Dream depend on it.
