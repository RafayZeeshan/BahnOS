# ADR-017: Bring in the team's ops map and answer book; call the product BahnOS and the agent BahnBot

## Status
Accepted

## Date
2026-10-25

## Context
Our team also built a separate BahnOS prototype (github.com/toivonenlate/OperationsHackathonPrometheus). It has two strong pieces this product lacked:

- an **ops map**: every order as a lane between two cities on a MapLibre map, with local market clocks, headline numbers, filters, an inspector, an activity timeline, an event log and a disruption watch;
- an **answer book**: 80 driver-support questions, each with a routing that says whether the bot may answer it alone (ANSWER), only from the records (LOOKUP), only after asking one question (ASK), or never (ESCALATE), plus cautions, corner cases and per-market rules.

Its own bot is thin: rule-generated suggestions and a live simulation of the snapshot. The team asked to take the map and the answer book, use the bot logic sparingly, and use the names BahnOS and BahnBot.

## Decision
- **Ops map at `/map`, Today stays home.** The lane model, story, handover checks, market clocks and disruption watch are ported (`lib/opsmap/`, `app/map/`). Which orders need a person, why, and the next decision come from BahnOS itself: the Today queue, Watch's model-written lines and BahnBot's open decisions (`lib/opsmap/needs.ts`). The map's left queue lists BahnBot's open decisions, and deciding happens on the case.
- **At the snapshot, no live simulation.** The prototype played the snapshot forward and raised its own suggestions. That would be a second source of decisions beside BahnBot and would break the frozen clock (ADR-003), so it is left out.
- **The disruption watch stays live.** Public holidays (Nager.Date) and Google News headlines per market, failing soft offline. The team chose to keep them. The market clocks also show real local time. Both are marked as live and never feed a case.
- **The answer book is BahnBot's.** It is served at `/answers`, and BahnBot reads it through a read-only `answer_book` tool that takes the order and applies the driver's home market. A driver from outside Finland, Germany and Denmark gets only the entries for every market. The prompt tells BahnBot to look policy up rather than answer from memory, and to follow the routing.
- **Tailwind only where the ported code needs it.** The map and the answer book are written in Tailwind v4. Its utilities are generated only from `app/map` and `app/answers`, with a base reset scoped to `.tw`. Our own styles sit in a lower cascade layer, so no other page changes. Tailwind's colour names point at our tokens, so both pages follow light and dark.
- **Names.** The product is BahnOS and the agent is BahnBot, on every screen and in BahnBot's prompt. Bahn's own packet agents keep their titles (Journey monitor, Travel planning agent), on the map as on the case. ADRs 001–016 keep "Recovery agent", the earlier name.

## Alternatives Considered

### Make the ops map the home screen
- Rejected by the team: Today stays the front door, with the map one click away.

### Port the live simulation
- Rejected: two sources of truth for decisions, and it contradicts the frozen snapshot.

### Rewrite the map in our own CSS
- Pros: one styling system.
- Cons: about 2,500 lines of carefully tuned layout to retype by hand, with a high risk of drift from the team's design.
- Rejected: scoped Tailwind keeps their code close to the original and leaves every other page alone.

## Consequences
- New runtime dependency `maplibre-gl` and build-time `tailwindcss`. Basemap tiles come from CARTO, dark or light to match the theme. Offline, the map says so and still draws the lanes.
- The map depends on the dataset files at `../dataset/data`, as the rest of the agent code does.
- BahnBot's recorded runs were re-recorded with the new prompt and tool.
