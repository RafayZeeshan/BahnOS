# ADR-008: Watch runs a rule-based sweep first and calls the LLM only on flagged cases

## Status
Accepted

## Date
2026-10-24

## Context
Ops should not find out a trip is in trouble only when it is already late. The brief asks the agent to "do the cheap work first", and the control room must stay "high signal and low noise, even with hundreds of orders". Running an LLM over every order on every sweep is slow and costly, and it can't run without a key.

## Decision
- A **rule-based sweep with no LLM** scores every order with travel, using signals already in the packet:

| Signal | What it checks |
|---|---|
| Slack to the cutoff | Driver's best arrival vs `check_in_cutoff_at` |
| Availability | Selected crossing sold out, or the only option left |
| Stale quote | `checked_at` older than N hours |
| Unknown outcome | Booking attempt timed out, no confirmation |
| Missed milestone | `MISSED_CHECK_IN`, tracking gap |
| Positioning | Driver can't credibly reach pickup after the previous duty |
| ETA vs promise | Driver-app ETA later than the promise, or old |
| Open question | Driver fitness unconfirmed |

- Each order gets **Fine / Watch / Likely to slip**. Only Watch and above go to the LLM, which writes a one-line warning in plain words and picks the cheap next step (ask the driver, refresh the quote).
- It **re-checks** when new information arrives, then clears or escalates the flag.
- Thresholds (`slack_min_minutes`, `quote_max_age_hours`, …) are **policy parameters** in `policy_versions`, so Dream can tune them (ADR-011).
- The sweep is the `evaluate` function run at the frozen "now" (ADR-010).

## Alternatives Considered

### LLM over every order
- Rejected: Cost, latency and noise, and it can't run without a key.

### Rules only, with templated text
- Pros: No LLM at all.
- Cons: The wording is stiff, and there is no judgement about the next step.
- Kept as the **fallback**: it is #10 on the cut list.

## Consequences
- Watch works with no API key. Only the warning text and the next-step choice need the model, and both are in recorded traces.
- Today gets a **Heads-up** section, for example "CD-420603: ferry check-in closes in 6 h 40 m; the driver can arrive in about 5 h at best."
- The definition of done requires at least three real flags from data signals.
