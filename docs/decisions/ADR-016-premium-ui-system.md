# ADR-016: A premium visual system on Motion, with details on demand

## Status
Accepted. Supersedes the visual-system part of [ADR-013](ADR-013-triage-ui-model.md); ADR-013's interaction model (triage queue, keyboard, four responses, case order) stands.

## Date
2026-10-25

## Context
After the build, the team judged the app to look plain and to carry too much text: every case opened with the agent's full reasoning, the whole message thread, every fact and every Watch signal. Taste is 30% of the score, and the brief asks for a screen a tired ops person reads at a glance. The team asked for the frontend to be rebuilt with "Framer UI components" and to feel premium.

"Framer" could mean components exported from a Framer project, or Motion (formerly Framer Motion), the open-source animation library Framer is built on. The team chose Motion plus a component set written in code.

## Decision
- **Motion** (`motion@13.5.1`, MIT) for interactive movement: the sliding selection in the queue, the sidebar and the segmented control, tab underlines, height-animated disclosures, the undo toast with a countdown ring, and counting numbers. `MotionConfig reducedMotion="user"` respects reduced motion.
- **Entrance animations are plain CSS**, not Motion. A JavaScript entrance stalls in a background tab, so content could stay invisible; CSS cannot.
- **Geist Sans and Geist Mono**, bundled through the `geist` package (OFL), so type works offline. This replaces the Google Fonts link.
- **One token set, light and dark** (`app/ui/theme.css`): calm neutral surfaces, hairline borders, one accent (orange) for "needs you" and the agent, semantic colours only for status. Dark follows the system, and a toggle in the sidebar remembers a choice. The starter's own tokens are mapped onto ours, so its pages (All orders, Inbox, records) match without being rewritten.
- **Details on demand.** Each queue row is one line: car photo, car, one reason, the deadline, the next move. A case shows the situation as the headline, then one decision card with three or four fact tiles and the responses. The agent's reasoning, evidence, what each response does and the driver's-app preview sit behind "Why, and what happens next". The thread, route, facts and order details sit in tabs, and the thread shows the latest four messages.
- **The case headline is the situation, not the ask**: the first sentence of the agent's summary, else Watch's one-line warning, else the decision. The decision card carries the ask.
- **Car photos** from `public/car-images` illustrate the model, labelled "Illustration of the model, not this car", as `ASSET-SOURCES.md` requires.

## Alternatives Considered

### Export components from a Framer project (unframer)
- Pros: Framer's own visual polish.
- Cons: needs the team's Framer project and licences for any marketplace components. The exports are mostly static layout, not app widgets with keyboard and state.
- Rejected: the team chose Motion.

### A component library (shadcn/ui, Radix themes)
- Pros: fast, accessible primitives.
- Cons: the recognisable "generic SaaS" look. Pulls in Tailwind, which the starter does not use.
- Rejected: our own small kit on our tokens is less code and looks like ours.

### Keep ADR-013's light, warm, larger look and only trim text
- Rejected by the team: it still read as plain.

## Consequences
- ADR-013's "120 ms motion" and "body 15 px" become 200–340 ms springs and eases, with 14 px body. Rows are denser, so more of the queue fits at once.
- Text lives one click deeper. The tired-ops checklist (BUILD-PLAN §7.11) still holds: the reason, the deadline and the next move stay on the first screen.
- Two new runtime dependencies: `motion` and `geist`.
