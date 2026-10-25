# ADR-011: Dream learns by changing the policy around a fixed model, and a person adopts each change

## Status
Accepted

## Date
2026-10-24

## Context
We want the agent to get better as corrections and data arrive, and to show that honestly. Two research ideas shape it (we take the ideas, not the code):
- **Dream-RSI** ([paper](https://arxiv.org/pdf/2609.14858)): use history as a replay simulator, and test alternative policies against stored outcomes.
- **Harness²** ([paper](https://hyper.ai/en/papers/2610.14224)): keep model weights fixed and improve the harness around the model, with a propose → probe → compose loop.

**Check both links before citing them in the video or README.**

Data limits: 100 orders, 24 with a mishap, and few events per mishap.

## Decision
- **The "harness" is the versioned policy** in `policy_versions`: guard rules, Watch thresholds, risk-model parameters and plain-language lessons. The model never changes.
- **Casebook:** every past order becomes a case (timeline, mishaps with cause, the fix tried, the outcome, and what blocked the fix), derived from existing tables. Closed, failed, rejected and cancelled cases are kept.
- **Learning loop, per round:**
  1. **Probe:** replay every case and find misses and false alarms.
  2. **Propose:** the LLM proposes a parameter change and a lesson for a miss, shown next to a **contrastive pair** (a similar case that did not fail).
  3. **Probe again:** a deterministic replay, leave one order out, candidate vs incumbent. No LLM in scoring.
  4. **Compose:** keep what helps, drop what hurts.
  5. **Stop** when no candidate beats the incumbent by a margin for two rounds, or after three rounds in the demo.
- **Metrics each round:** lead time, hit rate and false alarms, each with **n** and labelled **held-out** or **in-sample**. Results are reported as they come out, including "no better than chance".
- **Maturity per failure type:** *Learning* (too few cases, or no held-out gain), *Emerging*, *Reliable*. The thresholds are policy parameters.
- **A person adopts, changes or rejects** each candidate policy. Rollback is available. Adopting a candidate that scores worse needs an override and a reason.
- **New data:** appended to the casebook, affected sources marked stale, a "New since v3" chip shown, and a run queued.
- **Reopen watcher:** re-checks the blockers stored on past fixes (ADR-002). When a blocker clears, the case goes under **Back on the table** for a person to decide, and a learning run starts.

## Alternatives Considered

### Fine-tune or prompt-tune the model
- Rejected: Not possible in the time, not explainable to ops, and not reversible by a person.

### Let changes apply automatically when they score better
- Rejected: Breaks "a person decides". The sample is too small to trust any automatic gain.

### Report accuracy percentages
- Rejected: Misleading at n≈24. No accuracy or "learning curve" claims.

## Consequences
- This is the largest and riskiest part of the plan. Most failure types will honestly show *Learning*.
- **Never cut:** replay with the lead-time metric, which proves the loop works. The LLM Propose step, simulation, the third round, LLM attribution and the override flow are on the cut list in that order.
- Ops see this on **What the agent learned**, and in **Why flagged** on each flagged order.
