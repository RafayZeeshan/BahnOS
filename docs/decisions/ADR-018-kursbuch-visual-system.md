# ADR-018: The Kursbuch visual system: the day set as a timetable

## Status
Accepted. Supersedes the visual-system part of [ADR-016](ADR-016-premium-ui-system.md). ADR-016's details-on-demand model and ADR-013's interaction model (triage queue, keyboard, four responses, case order) stand.

## Date
2026-10-26

## Context
ADR-016's dark, orange-accent look with rounded cards read as the generic look of a modern SaaS inbox. The team asked for an overhaul of the whole UI for Bahn's ops staff, keeping all behaviour, copy and data, and keeping both light and dark themes. Four directions were sketched; the team chose Kursbuch, the rail and ferry timetable books that the people Bahn moves through Finland, Denmark and Germany read every day.

## Decision
- **The day set as a timetable.** Today's queue is a timetable: Order, Car and reason, Leg and next move, and Due, with the time left right-aligned in tabular figures like a departure. A heavy 2 px rule opens every table and section; hairlines separate rows. Corners are square.
- **One reversed plate.** The selected row is set in reverse (ink ground, paper type) and slides to the next row with Motion. This is the one authored movement; pages no longer fade or count up on load.
- **Colour has jobs.** Ink means act: the primary response fills in ink. Signal red means needs you and late, and opens the decision block with a 4 px rule. Route legs take a mode colour (road ochre, ferry teal, rail red, flight violet), and their pattern still says booked, quoted or estimated.
- **Shell.** A black header bar replaces the sidebar: the work (Today, Heads-up, Ops map, Risk outlook, Answer book, Learning) in the bar, and the records behind one Records menu. The snapshot time, shortcuts and the theme toggle sit on the right.
- **Type.** Archivo, bundled through `@fontsource-variable/archivo` (OFL): condensed and uppercase for page titles, column heads and labels, normal width for reading. Geist Mono stays for order references.
- **Headings before labels.** A case's headline comes first, with reference, route and driver under it; the decision's heading comes before "BahnBot proposes".
- **Light and dark** come from one token set in `app/ui/theme.css`; the starter's tokens and the ops map's Tailwind colours map onto it, as before.

## Consequences
- Every page picks the system up through the same class names; the ops map and answer book keep their Tailwind layout with square corners and condensed titles.
- One new runtime dependency (`@fontsource-variable/archivo`); `geist` is still used for the mono face.
- The design record lives in `DESIGN.md` and `.impeccable/`, alongside `PRODUCT.md`.
