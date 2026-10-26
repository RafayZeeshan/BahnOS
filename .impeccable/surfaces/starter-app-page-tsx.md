---
version: 1
slug: "starter-app-page-tsx"
primary_target: "starter/app/page.tsx"
related_targets: ["starter/app/case/[ref]/page.tsx","starter/app/map/page.tsx"]
---

# BahnOS control room

Scope: the whole app (Today, Case, Heads-up, Ops map, Risk outlook, Learning, Answer book, records). Visitor mode: Operate.
Audience and job: Bahn ops staff at a desk all shift, triaging the orders that need a person and deciding one case at a time.
Constraints: light and dark themes both required; plain words; keyboard model and all behaviour stay; fonts bundled, no network.
Unresolved: none.

## Direction contract

THESIS: The day set as a timetable. Every order that needs a person is a row of times in a timetable's column rhythm, and every route is a vertical line of stops. Refuses the category default of rounded grey cards with one soft accent in a sidebar app.

OWN-WORLD: Thin timetable paper: white ground (near-black in dark), ink-black type, heavy 2px rules opening each table and hairlines between rows, square corners. Archivo, condensed and uppercase for headings and column heads, normal width for reading; tabular figures for every time. Black means act (primary buttons fill black), signal red means needs you and late, ochre road, teal ferry, red rail as leg colours.

STORY: The person reads the timetable top to bottom, sees what is late in red right-aligned times, opens one row, reads the situation and one decision with each fact's source, and presses a numbered response.

FIRST VIEWPORT: Black header bar with BahnOS, the section nav and the snapshot clock. Left, a timetable titled NEEDS YOU with Order, Car and reason, Leg and Due columns, the selected row marked red. Right, the open case: headline, a red-ruled decision block with fact rows and their sources, numbered responses in black, and the route as a stop line beside it.

FORM: Kursbuch (rail and ferry timetable books), candidate 1 of 7, chosen as the pick card. seed:ff5c46900a1b2e93

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
