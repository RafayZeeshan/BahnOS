# ADR-012: Leaflet map on a labelled synthetic geo layer, with a route-strip fallback

## Status
Accepted

## Date
2026-10-24

## Context
Travel cases are easier to judge on a map, and the brief allows a mocked map. The dataset has no coordinates, and its terminals are city-level and fictional. The app must run from a fresh clone with no key.

## Decision
- **Leaflet with OpenStreetMap tiles.** No Google Maps API and no key. Each road leg also has a plain **Open in Google Maps** URL for driver navigation.
- **One `TravelMap` component, two uses:** the ops case view, and a phone-frame **driver preview** on the decision card.
- **Synthetic geo layer**, built by `scripts/geo-seed.ts` into committed `data/geo/*.json`:
  - Real city-centre coordinates for the ~30 cities in the packet.
  - Fictional terminals drawn as an *approximate area* near their port city, never as a gate pin.
  - Curved or great-circle polylines per mode (a ferry is drawn as a sea arc).
  - Times = distance ÷ speed per mode + fixed buffers, **only to fill gaps**. **Times in the packet always win.**
  - Every synthetic value has `synthetic: true`, and the map footnote reads "Indicative routes."
- **Legs by evidence:** booked = solid, quoted = dashed, sold out = red and struck through, agent-estimated = hatched. Time and price chips on every leg.
- **ETAs are never blended.** Each leg shows its time with a basis (timetable / quote / booked / estimate). The overall arrival is a range. The driver app's ETA is shown separately with its age.
- **Fallback:** if tiles fail, a schematic **route strip** shows the same legs. The strip is also the compact view on the decision card.
- No live driver dot, because the data has no position.

## Alternatives Considered

### Google Maps embed
- Rejected: Needs a key, which breaks a fresh clone.

### No map, route strip only
- Kept as the fallback, and #3 on the cut list.

## Consequences
- The geo layer is fictional-world support data, not invented orders, so the brief's rule holds.
- OSM tiles need network access. Offline judges see the route strip.
- Bus and taxi legs come only from expense lines in the packet (5 bus, 3 taxi). Without an expense line they show as agent-estimated.
