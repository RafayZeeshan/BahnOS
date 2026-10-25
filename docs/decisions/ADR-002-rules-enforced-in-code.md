# ADR-002: Enforce the brief's rules in code, through typed actions and a guard

## Status
Accepted

## Date
2026-10-24

## Context
The brief's fixed rules:
1. The agent never contacts a customer (anyone who pays us). Drivers and pickup places are fine.
2. A person says yes before the agent changes anything: a booking, a date, a cost or a message to a customer. Asking and looking up need no yes.
3. "Build it so you could give the agent more freedom later as it earns trust."

A rule that lives only in the prompt can be talked around, and you can't test it. The judges also ask "When a person decides, is it clear what happens next?", which means each action needs a declared effect.

## Decision
- **`lib/policy/guard.ts`** checks every tool call before it runs. The prompt describes the rules, but the guard is the authority.
- **Typed actions in `lib/actions/*.ts`.** Each propose tool declares its parameters, validation, who approves, the effect of each human response, and the **facts that would block it**. One declaration drives:
  - the decision card's change preview,
  - the guard's rules,
  - the mock executor,
  - the ledger counts,
  - the blockers that the reopen watcher re-checks (ADR-011).
- **Tool classes and approval:**

| Kind | Tools | Approval |
|---|---|---|
| Read | `get_case`, `get_travel_options`, `get_ferry_terminals`, `get_road_estimate`, `check_provider_status` | no |
| Ask | `message_driver`, `call_site`, `call_driver` | no |
| Plan | `price_alternatives` | no |
| Flag | `raise_heads_up` | no |
| Propose | `propose_booking`, `propose_hotel`, `propose_date_change`, `propose_cost`, `draft_customer_update` | **yes** |
| Stop | `escalate(reason, what_i_know, what_i_dont_know)` | no |

- A Watch warning is a flag, not an action, so it needs no approval.
- The approval requirement is a policy parameter per action type, versioned in `policy_versions`. That is how the agent can get "more freedom later".

## Alternatives Considered

### Rules in the system prompt only
- Pros: Fastest to build.
- Cons: Not enforceable or testable, and it fails the judges' question about what happens next.
- Rejected.

### Hard-coded `if` checks inside each tool
- Pros: Simple.
- Cons: The card, executor and ledger would each re-describe the same action, and the copies would drift apart.
- Rejected in favour of one declaration per action.

## Consequences
- Tests can prove that no customer message leaves without approval (a definition-of-done item).
- Adding an action means writing one declaration. Forgetting the declaration means the guard refuses the call.
- Loosening approval later is a reviewed policy change, not a code change.
