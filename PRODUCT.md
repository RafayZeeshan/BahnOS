# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Bahn's operations team, about 50 people running deliveries across Finland, Denmark and Germany. They sit at a desk for a whole shift, on phone calls, email and paperwork, and something changes every hour. They are not engineers. The design target is "the tired ops person": late in a shift, scanning for what needs them, deciding quickly, and needing to trust where every fact came from.

Secondary (not designed for first): hackathon judges and demo viewers.

## Product Purpose

BahnOS is a control room where people and agents work together to get every car delivered. An agent, BahnBot, watches every trip, warns early when a travel plan looks shaky, gathers the facts, and brings a person one decision with evidence for every fact. Everything else stays out of the way.

Success: a person sees only the orders that need them, and for each one can tell in seconds what happened, what BahnBot already found out, what it suggests, and what happens after they press the button.

## Positioning

Not a portal of forms and not a board of lanes. The agent does the legwork in the background; the interface is a triage queue that hands a person one decision at a time, with provenance on every fact (driver said / quoted by provider, not booked / confirmed by provider) and four explicit responses: Go ahead, Change it, Take over, Not this.

## Operating Context

- Freelance drivers move one car at a time, often across borders by train, flight and ferry. Typical trouble: missed train, car not ready at pickup, surprise paperwork, sold-out ferry, conflicting addresses, warning lights on the road.
- The people the team depends on (sellers, drivers, ferry lines, receivers) are not Bahn staff and can be late, wrong or silent.
- Surfaces: Today (triage queue), Case (decision card, activity, route, facts, order), Heads-up (Watch), Ops map, Risk outlook, Learning (Dream), Answer book, and records pages (All orders, Inbox, Drivers, Places, Customers).
- Interaction model from ADR-013: keyboard-first queue (J/K, Enter, 1–4, ⌘K, ?), list + detail split, details on demand.
- The data is a frozen snapshot ("Now 21 Oct 09:00 UTC"); deadlines and clocks are relative to it.

## Capabilities and Constraints

- Next.js + Postgres starter, extended; React 19, Motion, Archivo and Geist Mono bundled locally, MapLibre/Leaflet maps. The ops map and answer book are written in Tailwind; the rest uses plain CSS tokens in `starter/app/ui/theme.css`.
- Hard rules enforced in code: BahnBot never contacts a customer and never buys anything on its own; a person approves every change. Approved is not done until the executor reports back.
- Works offline from the network (no hosted fonts).
- Light and dark themes are required: dark follows the system, a toggle in the header bar remembers a choice.

## Brand Commitments

- Product name BahnOS; the agent is BahnBot. Bahn is the delivery company.
- Voice: plain words a non-engineer reads at a glance. It "must not look like a developer tool".
- Light and dark themes must both exist (confirmed 2026-10-26).

## Evidence on Hand

- Fictional packet data in `dataset/` and recorded agent runs in `traces/`; all orders, people and messages are fictional.
- Car model illustrations in `starter/public/car-images`, labelled "Illustration of the model, not this car" (see `starter/ASSET-SOURCES.md`).
- No real customers, testimonials or metrics exist; do not invent them.

## Product Principles

1. Bring a person only what needs them; everything on track folds away.
2. One decision at a time, with the reason, the deadline and the next move on the first screen.
3. Every fact shows where it came from.
4. The person decides; the agent does the legwork and says what happens next.
5. Calm under pressure: nothing shown that the person doesn't need.

## Accessibility & Inclusion

Status, evidence and mode are never carried by colour alone (icon + text). Reduced motion is respected. Long shifts at a desk: legibility and contrast in both themes matter more than flourish.
