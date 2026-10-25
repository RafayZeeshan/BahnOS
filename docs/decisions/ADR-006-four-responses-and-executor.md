# ADR-006: Four human responses, and "approved is not done"

## Status
Accepted

## Date
2026-10-24

## Context
The brief says "a way to accept it or change it", "a person may reject an agent's suggestion without losing the case history", and the judges ask "when a person decides, is it clear what happens next?". A single Approve button hides why a person disagreed. It also hides that an approved action can still fail. CD-420154 in the packet shows an approved action that did not complete.

## Decision
- Every decision card offers **Go ahead `1` · Change it `2` · Take over `3` · Not this `4`**, plus **Snooze `H`**.
- **Change it, Take over and Not this are *interventions*.** Each needs a reason, is stored in `interventions`, and feeds learning (ADR-011).
- The card shows the **change preview, the cost, who gets told, and what happens after each response**, all derived from the action's declaration (ADR-002).
- After Go ahead there is a **5-second undo** before the executor starts.
- A **mock executor** moves the action `APPROVED → EXECUTING → EXECUTED | FAILED`, writes the effect, and creates the next step in the chain (`case_chain`).
- Rejecting or taking over keeps the full history.

## Alternatives Considered

### A single Approve / Reject pair
- Rejected: It loses the "change it" path, and Reject records no reason, so nothing can be learned from it. This was replaced during planning, as logged in `docs/AI-LOG.md`.

### Approval immediately marks the work done
- Rejected: This is the CD-420154 failure. "Approved" and "executed" are different facts.

## Consequences
- The chain view can show work still in progress after approval.
- Dream gets a labelled stream of human corrections to learn from.
- Keys `1`–`4` are global while a decision card has focus, and every key also has a visible button.
