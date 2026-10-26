---
name: BahnOS
description: The ops control room set as a timetable, Kursbuch.
colors:
  paper: "#ffffff"
  paper-tint: "#f4f4f1"
  paper-shade: "#e9e9e4"
  hairline: "#deded8"
  hairline-strong: "#b8b8b0"
  ink: "#111111"
  ink-soft: "#45453f"
  ink-faint: "#686862"
  act-hover: "#34342f"
  signal-red: "#c8211a"
  signal-red-text: "#b21d17"
  plate-red: "#ff6b5e"
  plate-ink-soft: "#c4c4bd"
  bar-paper: "#f4f4f0"
  bar-paper-soft: "#a9a9a2"
  danger: "#b3261e"
  warn: "#9a6200"
  ok: "#1b7339"
  info: "#006a83"
  mode-road: "#c98a00"
  mode-ferry: "#00708a"
  mode-rail: "#c8211a"
  mode-flight: "#5a4fb3"
  moving: "#2d55d0"
  open-case: "#a8524b"
  paper-dark: "#0e0e0d"
  paper-tint-dark: "#191917"
  hairline-dark: "#2c2c28"
  ink-dark: "#efefe9"
  rule-dark: "#e8e8e1"
  plate-dark: "#2e2e29"
  bar-dark: "#000000"
  signal-red-dark: "#ff5a4b"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "\"wdth\" 75"
  headline:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 750
    lineHeight: 1.4
    letterSpacing: "0.07em"
    fontVariation: "\"wdth\" 75"
  figure:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "\"tnum\" 1"
  reference:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  square: "0px"
  edge: "2px"
  stop: "50%"
spacing:
  row-y: "11px"
  row-x: "16px"
  column-gap: "14px"
  section: "24px"
  page-top: "26px"
  page-x: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.edge}"
    padding: "0 14px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.act-hover}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.edge}"
    padding: "0 14px"
    height: "34px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-tint}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.edge}"
    padding: "0 10px"
    height: "28px"
  header-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bar-paper}"
    padding: "0 20px"
    height: "52px"
  nav-link:
    textColor: "{colors.bar-paper-soft}"
    padding: "0 10px"
  nav-link-current:
    textColor: "{colors.bar-paper}"
  queue-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "11px 16px"
  queue-row-hover:
    backgroundColor: "{colors.paper-tint}"
  queue-row-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.edge}"
    padding: "0 7px"
    height: "22px"
  evidence-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.edge}"
    padding: "0 6px"
    height: "20px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.edge}"
    padding: "10px 12px"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    height: "32px"
---

# Design System: BahnOS

## Overview

**Creative North Star: "The Kursbuch"**

BahnOS looks like a rail and ferry timetable book printed on thin paper. Today's work is laid out as a timetable: each order is a row in a fixed column rhythm, and the time left sits right-aligned in tabular figures, like a departure time. Each route is drawn as a vertical line of stops. Type is ink on white. A heavy rule opens every table and section, hairlines separate the rows, and corners are square. Colour is used only where it has a job to do.

The density is a timetable's: rows of 11px by 16px padding, 14px body text, labels set condensed and uppercase, and no cards floating on a tinted canvas. Depth comes from rules and one reversed plate, not from shadows. Both themes come from the same tokens. In the dark theme the paper turns near-black (#0e0e0d), the ink turns warm off-white, and the rules turn light.

The system rejects the category default it replaced: rounded grey cards with one soft accent in a sidebar app (ADR-016's look).

**Key Characteristics:**
- Heavy 2px rule above every table and section, 1px hairlines between rows, square corners.
- Archivo condensed (wdth 75) and uppercase for page titles, column heads and labels; normal width for anything people read.
- Tabular figures everywhere: body text carries `tnum`.
- Ink means act, signal red means needs you or late, and mode colours name the leg.
- One reversed plate (ink ground, paper type) marks the selected row in each list, and it slides when the selection moves.
- Flat at rest. Shadows exist only on layers that float above the page.

## Colors

The palette is paper, ink and one signal red. A small set of functional hues name evidence strength and travel mode.

### Primary
- **Timetable Ink** (ink): type, the 2px rules, the primary response fill and the reversed plate. In this system ink is the colour of acting. In the dark theme it inverts to Warm Off-White (ink-dark), and the plate becomes a lifted charcoal (plate-dark) so selection is still visible on near-black paper.
- **Signal Red** (signal-red): marks what needs you. It appears as the brand square, the 3px current-nav underline, the 4px rule that opens the decision block and the command menu, the new-since dot, the slack and risk meter fills, the focus outline, and the hot count in the bar. **Signal Red Text** (signal-red-text) is the darker red used for late and soon due times and accent badges on paper. **Plate Red** (plate-red) is the lighter red used for those same marks when they sit on the reversed plate.

### Secondary (mode colours)
- **Road Ochre** (mode-road), **Ferry Teal** (mode-ferry), **Rail Red** (mode-rail, the same value as Signal Red) and **Flight Violet** (mode-flight) colour the 4px leg lines in the route strip. Booked, quoted and estimated legs are told apart by the line pattern (solid, 7/4 dash, 3/4 dot) and are also written out in words.
- **On-the-Road Blue** (moving): "moving" on the ops map and the board lanes. Teal stays reserved for ferries.
- **Muted Case Red** (open-case): open cases on the ops map. It is the same family as Signal Red but quieter, and is kept well away from road ochre.

### Tertiary (status)
- **Danger** (danger), **Warn** (warn), **OK** (ok), **Info** (info): text colour for status badges and evidence strength. Each pairs with an 8–12% tint fill and a 45% `color-mix` inset outline. Verified evidence is OK green and observed evidence is Info teal.

### Neutral
- **Paper** (paper): the page and every surface. The light theme has no separate canvas tone.
- **Paper Tint** (paper-tint): row hover, ghost hover, the call transcript and the board background.
- **Paper Shade** (paper-shade): empty meter cells, the slack track and map placeholders.
- **Hairline** (hairline): the 1px line between rows and around thumbnails. **Strong Hairline** (hairline-strong): badge and chip outlines, field borders, tab baselines and stat dividers.
- **Ink Soft** (ink-soft) and **Ink Faint** (ink-faint): secondary and tertiary text. Ink Faint is also used for kbd hints and order references.
- **Bar Paper** (bar-paper) and **Bar Paper Soft** (bar-paper-soft): current and resting text in the black header bar.

### Named Rules
**The Ink Acts Rule.** The primary response fills in ink, never in red. Red marks what needs you, and ink marks what you do about it.

**The Red Is Urgency Rule.** Signal Red appears only where something needs a person or is late, plus the brand square and the current-nav line. It never fills a button or decorates a heading.

**The Mode Colour Rule.** Mode colours belong to route legs (and to map layers through the Tailwind mapping). They never carry status. A leg's status is carried by its line pattern and its words.

## Typography

**Display Font:** Archivo Variable, set at wdth 75 (bundled from `@fontsource-variable/archivo`, fallback ui-sans-serif, system-ui)
**Body Font:** Archivo Variable at normal width
**Label/Mono Font:** Geist Mono, used for order references and kbd hints

**Character:** One grotesque in two widths. The condensed uppercase cut is the timetable's header voice. The normal width is the reading voice. Geist Mono marks identifiers, so they read as codes rather than words.

### Hierarchy
- **Display** (750, 34px at wdth 75, uppercase, line-height 1): page titles such as TODAY and the records titles. Drops to 28px below 900px. The board and mailbox titles use the same cut at 30px.
- **Headline** (700, 27px, 1.2, -0.012em, balanced wrap): the case headline. It is normal width because it is a sentence that people read.
- **Title** (700, 20px, 1.3): the decision heading. It comes before "BahnBot proposes".
- **Body** (400, 14px, 1.5, `tnum`): rows, facts and prose. Row titles are set at 650 weight, and long prose is capped at 75ch.
- **Label** (750, 11.5–12.5px at wdth 75, uppercase, 0.06–0.07em): column heads, section heads (`h-section`), fact terms, KPI terms, timeline day markers and lane heads.
- **Figure** (700, tabular): due times at 17px, stat numbers at 24px, risk ratios at 30px and KPIs at 32px.
- **Reference** (Geist Mono 500, 12px): order numbers in the queue and on the case.

### Named Rules
**The Two Widths Rule.** Use the condensed uppercase cut for things that name a column or section. Use normal width for anything a person reads as a sentence. Headlines of cases and decisions are sentences.

**The Departure Figure Rule.** Every time, count and amount uses tabular figures, and the time left in a list is right-aligned.

## Layout

The shell is a 52px sticky black header bar above a single main column. There is no sidebar. The Today view splits into a timetable list (500–600px, then 440–520px below 1280px) and the open case. A 2px ink rule separates the two.

Every queue row shares one column template with its head row: Order (64px), Car and reason (flexible), Leg and next move (132px), Due (100px), with a 14px gap. Below 1280px the template narrows to 58/112/96. Below 900px it drops the leg column and becomes 48px / flexible / 92px, and the case pane is hidden in favour of the full case page.

Record pages use a centred frame with a maximum width of 1180px and 26px top / 32px side padding. The case is capped at 980px. Inside the case, a container query at 740px puts the decision and a 216px route column side by side. Section rhythm is 24–28px between blocks and 10–11px vertical padding inside rows. Breakpoints are at 1280, 1100, 900 and 560px.

## Elevation & Depth

Kursbuch is flat. Depth comes from rules and inversion. A 2px ink rule says "a table starts here". A 1px hairline separates rows. The reversed plate says "this one is selected". In-flow frames are drawn with inset `box-shadow` rings (1px hairline, 1.5px for fields and segmented controls), so they never shift layout.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 18px 44px -14px rgba(17,17,17,0.32), 0 0 0 1px #b8b8b0`; dark `0 24px 60px -18px rgba(0,0,0,0.85)`): the Records popover, the command menu and the driver phone preview. These are the only surfaces that leave the page.
- **Toast** (`box-shadow: 0 18px 40px -14px rgba(0,0,0,0.45)`): the undo toast, which is set on the plate.

### Named Rules
**The Flat Page Rule.** Anything that sits in the page flow has no drop shadow. A shadow means the layer floats above the timetable.

**The Opening Rule Rule.** Every table, section and list opens with a 2px ink rule (`border-top` or `inset 0 2px 0`). The decision block and the command menu open with a 4px Signal Red rule instead. A decided decision's rule fades to Strong Hairline.

## Shapes

Corners are square. Rows, sections, the plate, the command menu, thumbnails, meters and the brand mark have 0 radius. Interactive edges (buttons, badges, evidence chips, fields, kbd hints) take a barely-there 2px radius, so they read as printed boxes rather than pills. Small markers are squares: new-since dots, badge dots, meta separators, the brand mark and lane dots.

Circles appear only where the thing being drawn is round: route stop nodes (13px, 3px ink ring, filled at the destination), the evidence-strength marks (an empty ring filling to a checked disc) and the undo countdown ring. The driver-app preview keeps a phone's 30px/22px corners because it depicts a phone.

## Components

### Buttons
Printed boxes with a 1.5px ink stroke.
- **Shape:** 2px corners, 34px tall (28px small, 40px large), 14px side padding, Archivo 600 13.5px.
- **Primary:** an ink fill with paper text. In the decision, the first numbered response is primary and the others are outlined. Each response carries its key as a kbd hint (`1`–`4`, `H` for snooze).
- **Hover / Focus:** primary hover moves to #34342f. Outline and ghost buttons hover to Paper Tint. On press the button drops 1px. Focus shows a 2px Signal Red outline at a 2px offset. Disabled buttons sit at 40% opacity.
- **Ghost:** a transparent stroke and Ink Soft text, used for Snooze and Cancel.

### Chips
- **Badge:** 22px tall, 2px corners, a 1px Strong Hairline inset ring and 600 12px text. Tone variants (accent, danger, warn, ok, info) use the tone's text colour, a soft tint and a 45% ring. An optional 7px square dot comes first.
- **Evidence chip:** 20px tall, 11.5px. It always pairs a strength mark (ring, half, ring with centre, solid check) with the source's words. Shape and words both carry the strength, never colour alone.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** Paper, the same as the page. Containers are ruled sections, not raised cards.
- **Shadow Strategy:** none in the page flow (see Elevation & Depth).
- **Border:** a 2px ink rule on top, plus an optional 1px hairline frame drawn as an inset ring.
- **Internal Padding:** 18px by 20px for framed sections. Decision, risk and KPI blocks drop the frame and keep only the top rule.

### Inputs / Fields
- **Style:** Paper ground, a 1.5px Strong Hairline inset ring, 2px corners, 10px by 12px padding and 14px text.
- **Focus:** the ring turns to ink. There is no glow.
- **Error:** a Danger-coloured 600 13px line under the field.

### Navigation
- **Header bar:** 52px tall, ink in light and pure black in dark, with 20px side padding. The brand is a 12px Signal Red square followed by BAHNOS at 750 20px wdth 75. The work links are Archivo 500 13.5px in Bar Paper Soft. The current link turns Bar Paper and gets a 3px Signal Red underline that slides between links. Groups are split by 1px translucent separators. Counts sit in 18px outlined boxes, and the Today count is filled in Signal Red. Records open a fixed popover that starts with a 2px rule.
- **Segmented control:** a 1.5px ink outline with condensed uppercase 700 13px labels. The selected segment is the ink plate, and it slides.
- **Tabs:** 600 13.5px with a 1px Strong Hairline baseline. The current tab gets a sliding 3px ink underline.
- **Mobile:** below 900px the bar keeps scrolling horizontally with a fade mask at the right, and the snapshot clock and shortcut hints are hidden.

### Queue Row (signature)
One order per timetable row: the reference in Geist Mono, the car (650) over its reason (Ink Soft), the route over the next move, and the due time right-aligned as a 17px tabular figure over its label. Late and soon times turn Signal Red Text. The selected row is the reversed plate, and the plate slides from row to row with a spring (stiffness 520, damping 40, mass 0.8). On the plate, the reference and hot times switch to Plate Red and secondary text to #c4c4bd. A 5px red square in the left gutter marks a row as new since your last look.

### Decision Block (signature)
It opens with a 4px Signal Red rule. Then come the decision heading, the BahnBot attribution (an 18px red square holding the agent icon, plus 650 red text), and a fact table that starts with a 2px rule. The fact table has three columns: a 148px condensed term, the value, and the source chip on the right. Below that are the numbered responses. "Why, and what happens next" folds away behind a turning chevron.

### Route Strip (signature)
A vertical line of stops. Each leg is a 4px line in its mode colour: solid when booked, dashed when quoted, dotted when estimated, and at 35% opacity when sold out. Next to the line are the mode icon and word, the departure and duration, and a status badge.

## Do's and Don'ts

### Do:
- **Do** open every table, list and section with a 2px ink rule and separate rows with 1px hairlines.
- **Do** fill the primary response in ink (#111111 light, #efefe9 dark) and show its number key beside its label.
- **Do** set column heads, section heads and fact terms in Archivo at wdth 75, uppercase, 750, 0.06–0.07em.
- **Do** right-align due times in tabular figures and colour them Signal Red Text only when late or under six hours.
- **Do** mark the selected row of a list with the reversed plate, and only that row.
- **Do** pair every evidence colour with a shape and a word.
- **Do** take colours from the theme tokens so both themes follow. The Tailwind views map their colour names onto those tokens in `map.css`.

### Don't:
- **Don't** round containers. Section, row and menu corners are 0, and interactive edges stop at 2px. Circles are kept for things that are round in the world: stop nodes, evidence marks and the countdown ring.
- **Don't** put drop shadows on in-flow content. Only floating layers (popover, command menu, toast, phone preview) cast a shadow.
- **Don't** fill a button in Signal Red or use red for decoration. Red means needs you or late.
- **Don't** use a mode colour to say status. Teal is the ferry, not "on the road".
- **Don't** set sentence headlines in the condensed uppercase cut.
- **Don't** add load choreography. The only authored movements are the sliding plate and indicators, plus height-animated disclosure, and all of it honours reduced motion.
