# ADR-009: Model risk by source of failure, never by driver

## Status
Accepted

## Date
2026-10-24

## Context
Watch asks whether *this trip* is in trouble now. A different question is which sources of failure keep causing trouble, and which upcoming orders are about to run into them. 24 of the 100 orders have a mishap. Patterns exist but samples are small: Volvo 5 of 8, Toyota 2 of 3, Porsche 1 of 21; FR→FI 3 of 3, DE→FI 4 of 9; the worst dealerships 2 of 3 or 2 of 4.

Drivers are freelancers. Ranking them from 24 mishaps would be unfair and statistically meaningless, and it is the wrong unit: different drivers take the same route, visit the same dealership, or collect the same make.

## Decision
- The unit is the **source of failure**: **route**, **mode of transport**, **car make**, **dealership**.
- Each mishap order gets a **root-cause category** (route, mode, vehicle, dealership, or *unclear*) in `mishaps`:
  - **Rules first**, mapping signal to cause, for example `FERRY_SOLD_OUT` → mode, `VEHICLE_NOT_FOUND` → dealership, `SAFETY_STOP` → vehicle.
  - **LLM only for ambiguous cases.** It proposes a category with evidence; anything it can't support stays *unclear*.
  - A make's record counts only vehicle-attributed mishaps. A route's record counts only route and mode mishaps.
- **Honest statistics:**
  - Always show **"k of n"**, never a bare percentage.
  - Rates are **shrunk toward the overall rate**.
  - **Under 3 orders: "too few to say."** Visible in the drill-down, never on the dashboard.
- "Upcoming" means neither delivered nor cancelled at the frozen "now".
- Drivers appear only as a count ("2 drivers about to hit this"), never ranked or scored.
- The cause map, minimum sample, shrinkage strength and "elevated" thresholds are versioned policy parameters.

## Alternatives Considered

### Per-driver reliability scores
- Rejected: Unfair to freelancers, too small a sample, and the wrong unit.

### Percentages with confidence intervals
- Rejected: Not plain words for ops, and intervals on n=3 are mostly noise.

## Consequences
- Today shows a **Risk outlook** strip between Heads-up and the quiet fold.
- Most sources will sit at "small sample". The UI must say so, not hide it.
- Root cause is a hypothesis with an evidence chip (ADR-007), not a verdict.
