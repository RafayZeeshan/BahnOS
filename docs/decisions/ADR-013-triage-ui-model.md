# ADR-013: A triage queue, not a board, borrowing Linear's interaction patterns but not its look

## Status
Accepted. The visual system below is superseded by [ADR-016](ADR-016-premium-ui-system.md); the interaction model stands.

## Date
2026-10-24

## Context
The judges give 40% to the control room and 30% to taste. They ask: does it bring a person only the orders that need them? Does one glance tell you what is wrong and what to do? Could a non-engineer use it without a tutorial? Does it work with hundreds of orders? It "must not look like a developer tool". The starter's board of lanes shows volume but "does not by itself answer which order needs a person right now".

## Decision
- **Home is Today**, with pill tabs **Needs you · Heads-up · All**. Below them: Needs you · Heads-up · Risk outlook · Back on the table · Handled quietly (a single line that expands).
- **Three-pane layout:** sidebar (224 px), queue or feed (~440 px), and the case detail. `Enter` opens the case full width. Panes stack below 900 px.
- **Patterns from Linear's public product, not its code, assets, wording or look:** a triage inbox with a key per response, a keyboard-first queue, Pulse-style narrative cards (status pill, author, age, bullet reasons, action row), a list + detail split, a mixed human/agent/system activity stream, a properties panel, and the agent as a teammate.
- **Not taken:** Linear's dark, dense, developer-tool look. Ours is lighter, calmer, larger and in plain words.
- **Case pane order:** headline → decision card → thread (who said what and when) → route → facts with evidence chips → chain → properties.
- **Visual system:** a light theme by default plus a dark theme, as `:root` tokens. One bundled font (no network fetch). Body 15 px. Tabular figures for times and money. 44 px rows. An 8 px grid. **One accent** for "needs you". Status, evidence and mode use icon + text, never colour alone. 120 ms motion, and reduced motion is respected.
- **Designed states:** loading skeletons, empty queue, agent working, recorded run, tiles failed, stale data, error, small sample.
- **Keyboard:** `J`/`K`, `Enter`, `1`–`4`, `H`, `G`+key, `⌘K`, `⌘F`, `⌘B`, `?`, `Esc`, each also shown as a visible button or tooltip.
- **Review gate:** a "tired ops person" subagent reviews every screen at freeze against the checklist in BUILD-PLAN §7.11.

## Alternatives Considered

### Keep the lanes board as home
- Rejected: It shows volume, not who needs a person now. It is kept as **All orders**.

### Copy Linear's look closely
- Rejected: Developer-tool look, branding risk, and it fails "made with care, not the first thing Claude gave you".

### A chat-first interface
- Rejected: Ops need to scan the queue. Chat lives inside the case thread as **Ask the agent**.

## Consequences
- **Cut order** if time slips: `⌘K` → view options beyond group-by → `⌘B` → dark theme.
- **Never cut:** the queue, the decision card, the thread, evidence chips, the empty and loading states.
- The starter's secondary pages are restyled with the same tokens but must not distract from Today.
