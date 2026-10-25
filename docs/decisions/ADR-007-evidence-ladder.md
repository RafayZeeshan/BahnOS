# ADR-007: Show every fact with an evidence ladder

## Status
Accepted

## Date
2026-10-24

## Context
The judges ask "Can you see where every fact came from?" The packet is deliberately messy: a message can disagree with a stored address, an alert is a reason to look and not a diagnosis, a quote is not a booking, and a booking is not a boarding scan. `OPERATIONS-CONTEXT.md` warns that agents make exceptions harder to understand "if a quote is treated as a booking, a driver message as a fresh location, or an old instruction as the current plan".

## Decision
Every fact on screen shows **source, time and strength**, in plain words. There are four strengths:

| Strength | Meaning | Example chip |
|---|---|---|
| Claimed | A driver or customer said it | "driver said", "site said on a call" |
| Reported | A message in the app | "app message" |
| Observed | A tracking signal or site reply | "seen in photo" |
| Verified | A gate scan, or a booking the provider confirmed | "confirmed by provider" |

- The mapping from record type to strength lives in one place, `lib/present/evidence.ts`.
- Strength is shown as an icon plus text (outline → filled), never by colour alone.
- The agent's own conclusions carry the strength of their weakest input.

## Alternatives Considered

### Show a source link only
- Rejected: A link tells you where a fact came from but not how far to trust it, and the packet is built around that difference.

### Numeric confidence scores
- Rejected: False precision, and not plain words for ops.

## Consequences
- Every fact-producing code path must pick a strength. A missing mapping is a bug.
- Call outcomes (ADR-014) and Watch flags (ADR-008) use the same chips.
- This is a definition-of-done item: every fact on the case view has an evidence chip.
