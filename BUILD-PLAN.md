# Build plan v2: Recovery Control Room

Bahn's Car Delivery Control Room challenge, Prompt Operations Hackathon, 24–25 Oct 2026.
**Hand-in: Sunday 15:00.** A 2–3 min video and a public GitHub repo that runs from a fresh clone.

v1 is kept in `BUILD-PLAN.v1.md`. This version folds in the grilling session, the LLM-council review and the map/watch additions.

---

## 1. The pitch

> Bahn's ops team shouldn't have to hold the whole chain in their head. Our agent holds it for them. It **watches every trip, warns early when a travel plan looks sketchy**, gathers the facts, and brings a person one decision, with proof for every fact. It knows when to stop, and it learns from every correction.

**One story carries the video: CD-420299.** The ferry booking call timed out with no confirmation. The agent did *not* rebook. It checked what the provider actually knows, and brought one decision to a person.

## 2. Scope

**One agent, the Recovery agent**, with three triggers:

| Trigger | What starts it |
|---|---|
| **Watch** (new) | A scheduled sweep over every order with travel. No event needed. |
| **On the road** | An alert, a missed or sold-out ferry, a breakdown, a driver message. |
| **Ask** | An ops person talks to it about a case. |

Its job covers two of the brief's areas: **On the road** (gather facts, ask the driver, propose) and **Driver travel** (replan trains, ferry, flights, hotels, last stretch; compare; propose a booking). It stops before any purchase.

**Out of scope:** driver support chat, real phone calls over a carrier, anything live. **Voice calls in the browser are in scope** (section 6b): the agent talks to a driver or site, with a teammate playing that person.

### Demo orders
Deep demo on **three**: CD-420299 (hero), CD-420322 (warning light, driver safe), CD-420154 (approved ≠ done). The map and Watch also show CD-420399, CD-420603 and CD-420449 so the idea is seen working beyond one example. All six get a real recorded trace.

---

## 3. Fixed rules (from the brief)

1. The agent **never contacts a customer**. It drafts; a person sends.
2. **A person decides** every booking, date change, cost or customer message.
3. Reading, looking up, and asking the driver or site need no approval. **A Watch warning is a flag, not an action**, so it needs no approval.
4. Everything outside the agent is mocked: phone, ferry prices, maps, driver replies.
5. The UI is for ops people. No JSON or raw IDs on main screens.
6. **Time is frozen at the snapshot, `2026-10-21T09:00Z`.** One `lib/clock.ts`; nothing calls `Date.now()` in agent or UI paths. Dates come from the data.
7. **Voice calls go only to drivers and sites, never to a customer.** The guard checks the callee's role before a call starts. Every call opens by saying it is an AI, and the agent makes no commitments on a call.

Rules are enforced in **code** (`lib/policy/guard.ts`), not in the prompt.

---

## 4. Architecture

```
Next.js starter ── Postgres (starter seed) ── new tables
        │
        ├── /api/agent/run        tool loop (Claude API, TS)
        ├── /api/agent/watch      sweep: cheap signals first, LLM only on flagged cases
        ├── /api/agent/chat       ops talk to the agent about a case
        ├── /api/decisions/:id    go ahead / change / take over / not this
        └── scripts/dream.ts      learn from reviews → candidate policy
```

**Default mode is recorded traces.** The app is fully usable with no API key, and a visible "recorded run" badge says so. Live runs need `ANTHROPIC_API_KEY`.

### New tables (separate from the starter's, so reseeding still works)
`agent_runs`, `agent_steps` (the trace), `decisions`, `case_chain`, `watch_flags`, `mishaps` (one row per mishap with its root-cause category and evidence), `failure_sources` (route, mode, make and dealership records with k-of-n), `policy_versions` (guard, Watch and risk-model parameters, plus lessons), `casebook` (one row per past order with mishaps, fixes, outcome and blockers), `learning_runs` (rounds, candidates, held-out metrics), `reopen_events` (a blocker cleared on a past fix), `interventions` (feeds Dream and the ledger).

### Typed actions (`lib/actions/*.ts`)
Each propose tool declares its **parameters, validation, who approves, the effects of each response, and the facts that would block it** (the blockers the reopen watcher in section 8.7 re-checks). One declaration drives the decision card's diff, the guard's rules, the mock executor and the ledger counts.

### Agent tools

| Kind | Tool | Approval |
|---|---|---|
| Read | `get_case`, `get_travel_options`, `get_ferry_terminals`, `get_road_estimate`, `check_provider_status` | no |
| Ask | `message_driver` (recorded replies), `call_site`, `call_driver` (voice, section 6b; recorded call when voice is off) | no |
| Plan | `price_alternatives` (deterministic mock engine) | no |
| Flag | `raise_heads_up(case, risk, evidence)` | no |
| Propose | `propose_booking`, `propose_hotel`, `propose_date_change`, `propose_cost`, `draft_customer_update` | **yes** |
| Stop | `escalate(reason, what_i_know, what_i_dont_know)` | no |

### Human responses (every decision card)
**Go ahead · Change it · Take over · Not this** (a reason is required). The last three are *interventions*. Approved is not done: a mock executor moves `APPROVED → EXECUTING → EXECUTED | FAILED`, writes the effect, and spawns the next chain step.

### Evidence ladder (everywhere)
Every fact shows **source · time · strength**, in plain words:

`Claimed` (driver/customer said) → `Reported` (app message) → `Observed` (tracking signal, site reply) → `Verified` (gate scan, booking confirmed by provider).

Chips read "driver said", "seen in photo", "confirmed by provider". Mapping rules live in `lib/present/evidence.ts`.

---

## 5. Watch: the pre-check agent (new)

Ops shouldn't find out a trip is in trouble when it's already late.

**Cheap first.** A deterministic sweep (no LLM) scores every order with travel, using the data already in the packet:

| Signal | Example |
|---|---|
| **Slack to the cutoff** | Driver's best arrival at the terminal vs `check_in_cutoff_at`. Slack under N minutes. |
| **Availability** | Selected crossing sold out, or the only remaining option. |
| **Stale quote** | `checked_at` older than N hours against the frozen "now". |
| **Unknown outcome** | A booking attempt timed out with no confirmation (CD-420299). |
| **Missed milestone** | `MISSED_CHECK_IN`, or a tracking gap alert. |
| **Positioning** | Driver can't credibly reach pickup after the previous duty (CD-420399). |
| **ETA vs promise** | Driver-app ETA is later than the delivery promise, or is old. |
| **Open question** | Driver fitness unconfirmed (CD-420449). |

Each case gets **Fine / Watch / Likely to slip**. Only **Watch and above** reach the LLM, which writes the one-line warning in plain words and decides the cheap next step (ask the driver, refresh the quote). If that doesn't settle it, it brings a person one decision.

**On Today:** a "Heads-up" section above the quiet fold, e.g. *"CD-420603: ferry check-in closes in 3 h 0 m"*, with the driver's own words beside it as a claim (*"The queue before the terminal has barely moved"*, driver said). The packet has no verified position for that driver, so Watch measures time to the cutoff, not the driver's arrival. (An earlier draft of this plan quoted "6 h 40 m" and "about 5 h at best"; those numbers were not in the data.) Each heads-up links to the case with the evidence and the map.

**It re-checks** when new information lands (a recorded driver reply, a refreshed quote) and clears or escalates the flag.

**Thresholds are guard parameters** (`slack_min_minutes`, `quote_max_age_hours`, …). Dream can tune them from ops corrections, which ties Watch to learning.

The sweep itself runs with no key. Only the warning wording and next-step choice need the LLM, and both are in the recorded traces.

---

## 5b. Risk outlook: root causes of failure (new)

Watch asks "is **this trip** in trouble now?" The risk outlook asks a different question: **which sources of failure keep causing trouble, and which upcoming orders are about to run into them?** Dream owns it, and ops see it on the dashboard.

**The driver is the symptom, not the subject.** Different drivers can be about to take the same route, visit the same dealership, or collect the same make of car. Nothing here scores or ranks a driver. The unit is the **source of failure**.

### Four sources of failure
| Source | What it is | Examples of mishaps that count |
|---|---|---|
| **a) Routes** | A corridor or city pair, with the legs on it. | Delays, tracking gaps, positioning at risk, ETA past the promise. |
| **b) Modes of transport** | Ferry line, train, flight, road, bus, taxi. | Sold-out crossing, timed-out booking, missed check-in, a broken connection. |
| **c) Car makes** | The make (and model where there is enough data). | Warning light and safety stop, condition claims, vehicle-related incidents. |
| **d) Dealerships** | A site, rolled up to its customer where useful. | Vehicle not found, unclear release documents, access conflicts, rejected pickup proof. |

### Attributing the root cause
Each mishap order gets a **root-cause category** (route, mode, vehicle, dealership, or *unclear*), stored in a `mishaps` table.
- **Rules first:** a deterministic map from alert signal, incident kind, travel status and visit outcome to a category. For example, `FERRY_SOLD_OUT` → mode; `VEHICLE_NOT_FOUND` → dealership; `SAFETY_STOP` → vehicle.
- **LLM only for the ambiguous cases,** which proposes a category with its evidence. Anything it can't support stays *unclear*.
- **An alert is a reason to look, not a diagnosis.** So the cause is a hypothesis, shown with an evidence chip, and *unclear* is a valid answer. A make pattern only counts vehicle-attributable mishaps, and a route pattern only counts route and mode ones.

### What the data supports (be honest about it)
21 of 100 orders have a mishap (any alert, incident, failed site visit, sold-out crossing, rejected pickup proof or failed agent action). Patterns exist but samples are small. Counting any mishap: Volvo 3 of 5, Toyota 2 of 3, Porsche 1 of 21; FR→FI 3 of 3, DE→FI 3 of 9. Counting only the causes that belong to the source (the rule below), FR→FI drops to 2 of 3 and DE→FI to 2 of 9. (An earlier draft said 24 orders, Volvo 5 of 8 and DE→FI 4 of 9; the data does not support those.)
- Every pattern shows **"k of n"**, never a bare percentage.
- Rates are **shrunk toward the overall rate**, so a 2-of-2 can't look like certainty.
- **Under 3 orders:** "too few to say." It is visible in the drill-down but never on the dashboard.

### What ops see
A **Risk outlook** strip on Today, between Heads-up and the quiet fold. Each item is a failure source with its record and the upcoming exposure, in plain words:
> **FR → FI route**: 3 of 3 past orders had a problem (small sample). **2 upcoming orders** are on it.
> **Vela Coast Lines ferries**: 1 sold-out option of 3 checked. **3 upcoming orders** depend on one.

"Upcoming" means not delivered or cancelled, measured against the frozen "now". Drivers appear only as "2 drivers about to hit this", never as a ranking. Clicking an item opens the orders behind it, each with its own Watch status.

### How it drives Dream
The risk model is a set of **policy parameters**, versioned in `policy_versions` next to the guard and Watch settings: the signal-to-cause map, the minimum sample size, the shrinkage strength, and the thresholds that decide when a source is "elevated".
- A Dream run proposes changes from ops corrections and from the mishap record. Example: *"FR → FI orders: require a ferry check-in slack of 150 minutes instead of 90."* Root-cause lessons also change what Watch does about the orders on that source.
- **Backtest:** leave-one-order-out across the 100 orders. Fit the source rates on the other 99, then ask whether the held-out order's sources ranked it higher if it had a mishap. It is reported as it comes out, including "no better than chance", and labelled a **small-sample check** with n shown.
- A person adopts, changes or rejects it, like any other policy change, with rollback and an override if it scores worse.

---

## 6. Travel map (new)

**Embedded in the app, no Google Maps API and no key.** Leaflet with OpenStreetMap tiles. Each road leg also gets an **Open in Google Maps** link (a plain URL) for the driver's navigation.

One `TravelMap` component, two uses:
- **Ops case view**, for any flagged travel case: the driver's planned route, legs and ETAs.
- **Driver preview** on the decision card: a phone-frame mock of what the driver will see after approval. This is also the "who gets told" line.

### Legs
- **By mode:** drive, train, flight, ferry, hotel stop. Bus and taxi have no options in the packet, only expense claims (5 bus, 3 taxi positioning lines), so they appear as agent-estimated last-stretch legs unless an expense backs them.
- **By evidence:** booked is a solid line, quoted is dashed, sold out is red and struck through, agent-estimated is hatched.
- **Chips:** time and price on every leg. "Compare options" toggles the agent's priced alternatives; they are not all drawn at once.
- **Fallback:** if tiles don't load, the same legs render as a schematic route strip (stop → stop with mode icons and times). The strip is also the compact view on the decision card.

### Synthetic geo layer (new)
The dataset has no coordinates and terminals are city-level, so we generate a **synthetic geo layer**, committed and clearly labelled:
- `scripts/geo-seed.ts` builds `data/geo/*.json`.
- **Stops:** real city-centre coordinates for the ~30 cities in the packet. Fictional terminals are placed near their port city, drawn as an *approximate area*, never a gate pin.
- **Route geometry:** curved or great-circle polylines per mode (ferry as a sea arc).
- **Times:** distance ÷ a speed profile per mode plus fixed buffers. These fill gaps only. Wherever the packet has a timetable, quote or booking time, **the packet's time wins**.
- Every synthetic value carries `synthetic: true`, and the map footnote reads "Indicative routes."
- No live driver dot, because the data has no position.

### ETAs, never blended
Each leg shows its time with a basis chip (timetable / quote / booked / estimate). The overall arrival is a range with its basis written out. The driver app's ETA appears separately: *"Driver app said 13:21, received 11:16"*, in amber when old against the frozen "now".

---

## 6b. Voice calls: the agent talks to drivers and sites (new)

The brief's own example has the agent asking the driver whether they are safe. A voice call shows that better than a chat bubble. We reuse the voice stack from **[prometheus](https://github.com/Abdullah12has/prometheus)** instead of building one.

### What we take from prometheus
- **The speech pipeline:** local streaming ASR (Nemotron 3.5 via a Rust bridge, `native/asr`), local TTS (Kyutai Pocket TTS, `speech/tts_worker.py`), and `speech_runtime.py`.
- **The browser call protocol** (`backend/VOICE_API.md`): a one-time ticket, a WebSocket carrying 16 kHz PCM, barge-in, captions, and per-turn status (played / interrupted / unconfirmed).
- **The browser client:** `VoicePanel.tsx`, `voice-audio.ts` and `voice-capture.worklet.js`.
- **The safety design, which already matches our rules:** the introduction must say it is an AI, the agent makes no commitments, and the call outcome is stored as a **proposal** for a person to review, never applied to records.
- The bundled default voice only. **No voice cloning.**

### What we change (it does not work as-is)
- **The system prompt and introduction are hard-coded for M&A sales calls** ("interested in selling your company?"). We fork `voice.py` and replace `SAFETY_PROMPT`, `DEFAULT_INTRODUCTION` and the `_propose_outcome` keys with a car-delivery call: what we need to know and why, one question at a time, and no promises about dates, costs or bookings.
- **`company_id` links to its `companies` table.** We replace it with the order reference, and build the call context from the case: the order, car, the questions still open, and what the evidence ladder already has.
- **The call outcome maps to our facts.** Each answer becomes a fact with an evidence chip, **"site said on a call"** or **"driver said on a call"** (`Claimed`). The transcript lands in the case thread as one call item that expands.
- **The LLM** runs through prometheus's OpenAI-compatible client (`LLM_BASE_URL` / `LLM_MODEL`), pointed at Claude. Unset `LLM_REASONING_EFFORT`, which was tuned for Gemini.
- **Auth.** prometheus needs its operator session cookie, a CSRF token and an allowed `Origin`. We allow `localhost:3000` and add a thin proxy in Next.js so the control room does not need a second login.

### How it runs
- **A sidecar in `voice/`:** the forked Python service on its own port, beside the Next.js app. Same Postgres container, its own tables (`voice_agents`, `voice_sessions`).
- **Off by default.** The fresh-clone path stays one command with no key. With voice off, `call_site` and `call_driver` return a **recorded call**: the transcript and a short audio file committed in `traces/`, played in the thread with a "recorded call" badge.
- **Live voice is opt-in:** `make voice`. It needs macOS on Apple Silicon (Metal), Rust, `uv`, ffmpeg and the pinned ASR model download. The README says so plainly.

### Where it shows up
- **CD-420299 (hero):** the agent calls the ferry line's desk to ask whether the timed-out booking exists, and does not rebook. A teammate plays the desk.
- **CD-420322:** the agent calls the driver: "Are you safe? Where exactly are you?"
- **Case view:** a **Call** button beside "Ask the agent", with live captions while the call runs and the four turn statuses afterwards. "Phone calling unavailable" is labelled separately, as prometheus does.

### Before we use it
- **The repo has no licence file**, so by default nobody else may reuse it. Get the owner to add a licence, or confirm in writing that we may reuse it, before it goes in our public repo. Credit it in the README and in `docs/AI-LOG.md`.
- **Keep its `THIRD_PARTY_NOTICES.md`.** The ASR model (OpenMDW-1.1) and Pocket TTS have their own terms. Never commit model weights.
- **Everything stays fictional.** The people on the other end are teammates playing made-up drivers and site staff from the packet.

---

## 7. The control room (UI)

The interaction model comes from how Linear's public product handles a team's queue (its marketing page, its Triage, Inbox and display-options docs, and the Pulse screen you shared). We take **patterns**, not code, assets, branding or its developer-tool look.

### 7.1 What we borrow, and what we don't

| Linear pattern | What it does there | Our use |
|---|---|---|
| **Triage inbox** | Items wait for a decision: Accept `1`, Decline `2`, Duplicate `3`, Snooze `H`. Triage items are hidden from normal views. | Today's **Needs you** queue, with the four responses on one key each. Quiet orders fold away. |
| **Inbox** | Priority and Other tabs, `J`/`K` to move, read/unread, snooze, quick search. | A keyboard-first queue with a dot for "new since you last looked". |
| **Pulse** (your screenshot) | A feed of narrative updates. Each card has a title, a status pill ("Project on track" green, "Project at risk" amber), an author and age, one or two bullet reasons, and a small action row. Pill tabs (For me / Popular / Recent) and "Today" date dividers. | Our **Heads-up** and **Risk outlook** cards use this format. The agent is the author. See 7.4. |
| **Sidebar** | Rounded app frame. Grouped navigation with collapsible headers ("Workspace", "Favorites"), icons, a search icon and a compose icon at the top. | Our sidebar uses the same grouping, with "Pinned" views in place of Favorites. |
| **List + detail split** | Select a row and the detail opens beside it. | Today opens the case in a right pane, so triage doesn't mean navigating away. |
| **Activity stream with humans, agents and system mixed** | One feed, each actor visible. | The case **thread: who said what and when**. |
| **Properties panel** | Status, owner, labels and deadline in one place. | Case properties. |
| **Agent as a teammate** | The agent is mentioned inline, shows a "thinking" state, and leaves a draft awaiting review. | "Ask the agent" is an inline message in the thread, with a visible working state. |
| **Display options** | Group by, order by, which properties show. Personal by default, can be saved for everyone. | Today's view options. |
| **Command menu, list/board toggle, undo toast** | `⌘K`, `⌘B`, a short undo. | The same, with the starter's lanes kept as **All orders**. |

**We do not copy:**
- Linear's code, assets, logo, wording or exact visual identity.
- **Its developer-tool look.** The brief says the control room "must not look like a developer tool". Linear's dark, dense, issue-key style suits engineers. Ours is lighter, calmer, larger and in plain words.

The `reverse-engineer-anything` skill is available in this environment if we ever need to measure public layout details. It is optional, and must only be pointed at public pages, never behind a login.

### 7.2 Principles
1. **A glance answers "what's wrong and what do I do?"** Every row has the reason in plain words and the next action.
2. **Keyboard-first, mouse-friendly.** Every key is also a visible button.
3. **Plain words.** No JSON and no internal IDs. The order reference (CD-420299) is a business reference ops already use.
4. **One accent colour** for "needs you". Evidence strength, status and mode use an icon plus text, never colour alone.
5. **Say what you don't know.** Recorded-run badge, "small sample", "not enough history", "estimate".
6. **Calm.** Generous spacing, motion only where it tells you something, reduced-motion respected.

### 7.3 Layout
```
┌──────────┬───────────────────────────┬──────────────────────────────────┐
│ Sidebar  │ Queue / feed              │ Case (detail)                    │
│ 224 px   │ ~440 px                   │ remaining width                  │
└──────────┴───────────────────────────┴──────────────────────────────────┘
```
- **Sidebar:** a rounded, framed shell like the Pulse screenshot.
  - Top: workspace name, search icon, `⌘K` hint.
  - Main group: **Today** (count), **Heads-up** (count), **Risk outlook**, **What the agent learned** (dot when there is new data).
  - **Workspace** group (collapsible): All orders, Drivers, Places, Inbox.
  - **Pinned** group: saved views (for example "Ferry orders", "Hamburg pickups").
  - Counts come from the data. Collapsible below 1200 px.
- **Feed column:** a readable single column, about 720 px wide at most, with "Today" and "Yesterday" date dividers.
- **Case pane:** `Enter` opens it full width at `/orders/[ref]`. Below 900 px the panes stack.
- **Header strip:** the frozen "now" chip and the **recorded run** badge.

### 7.4 Screens

**Today**
- **Pill tabs at the top** (as in Pulse): **Needs you · Heads-up · All**. Sections below each: Needs you · Heads-up · Risk outlook · Back on the table · Handled quietly (one line that expands).
- **Needs you row (44 px):** car and reference · one sentence of *why* · the deadline that decides it ("ferry check-in closes in 6 h 40 m") · who it's waiting on · the recommended response as a ghost button · a new-since-last-look dot.
- **Heads-up and Risk outlook use the Pulse card format:**
  - A title: the order, or the failure source.
  - A **status pill with icon and text:** *On track*, *Watch*, *Likely to slip* (and for sources, *Learning / Emerging / Reliable*).
  - The author, the **Recovery agent**, and the age.
  - One or two bullet reasons in plain words. For example: "Driver can arrive in about 5 h at best", "Check-in closes in 6 h 40 m", "1 of 3 crossings checked was sold out (small sample)".
  - A small action row: open the case, ask the agent, snooze. No emoji reactions.
  - Heads-up cards add a **slack bar** (time left before the cutoff). Risk cards add "k of n" and the number of upcoming orders exposed.
- **View options:** group by reason, deadline, route, mode, car make or dealership; order by; which properties show. Personal views saved locally.
- **Empty:** "Nothing needs you. N orders are on track." with the quiet line open.

**Case (detail pane)**, top to bottom:
1. **Headline:** one sentence of what happened, with the car and reference.
2. **Decision card**, pinned under the headline when there is one. It shows the **diff**, the **cost**, **who gets told**, and what happens after each response. Buttons with keys: **Go ahead `1` · Change it `2` · Take over `3` · Not this `4`** (a reason is required), plus **Snooze `H`**. After Go ahead there is a 5-second undo until the executor starts.
3. **Thread:** one merged feed of driver, site, ops, agent and system messages, each with an actor icon, time and source. Agent steps collapse into one line ("Checked the provider, asked the driver, priced 3 options") that expands to the trace. **Ask the agent** sits at the bottom of the thread as an inline message.
4. **Route:** the route strip first, with the map beneath when tiles load.
5. **Facts**, each with an **evidence chip** ("driver said", "seen in photo", "confirmed by provider").
6. **Chain:** the dependent steps and their status.
7. **Properties panel** (right edge, collapsible): deadline, driver, route, car, dealership, owner.

**Risk outlook:** failure sources grouped by type (route, mode, car make, dealership), as Pulse-style cards. No driver is ranked.

**What the agent learned:** the round history v1 → v2 → v3 with the same metrics each time (lead time, hit rate, false alarms, each with n and held-out or in-sample); lessons with their linked cases; the candidate diff with Go ahead / Change it / Not this, versions and rollback; and a **New since v3** chip when data has arrived.

**All orders, Drivers, Places, Inbox:** the starter's pages, restyled with the same tokens. All orders offers list or board (`⌘B`). These are secondary and must not distract from Today.

### 7.5 Components
`SidebarNav` · `QueueRow` · `PulseCard` · `StatusPill` · `PillTabs` · `DateDivider` · `ReasonLine` · `DeadlineChip` · `EvidenceChip` · `ThreadItem` (driver / site / ops / agent / system) · `AgentStatusLine` · `PropertiesPanel` · `DecisionCard` · `ResponseButton` · `UndoToast` · `RouteStrip` · `TravelMap` · `SlackBar` · `MaturityPill` · `LearningRound` · `ViewOptionsMenu` · `CommandMenu` · `ShortcutHelp` · `RecordedBadge` · `NowChip`.

### 7.6 Keyboard map
| Key | Action |
|---|---|
| `J` / `K` or `↓` / `↑` | Next / previous row |
| `Enter` | Open the case full width |
| `1` `2` `3` `4` | Go ahead / Change it / Take over / Not this |
| `H` | Snooze |
| `G` then `T` / `H` / `L` / `O` | Go to Today / Heads-up / Learned / All orders |
| `⌘K` | Command menu |
| `⌘F` | Search the queue |
| `⌘B` | List / board |
| `?` | Shortcut help |
| `Esc` | Close the pane or clear search |

Shortcuts show in tooltips and on the buttons, so nothing has to be memorised.

### 7.7 Visual system
- **Theme:** light by default, with a dark theme, as tokens on `:root`. No dependency on an external design skill.
- **Type:** one family, bundled in the repo (no network font fetch, so a fresh clone looks the same offline). Body 15 px, secondary 13 px, tabular figures for times and money.
- **Density:** 44 px queue rows, an 8 px spacing grid, a readable measure for the feed and the thread.
- **Accent:** one, for "needs you" (the unread dot, the recommended action, an urgent deadline).
- **Status pills:** icon plus text. *On track* (check), *Watch* (clock), *Likely to slip* (alert).
- **Evidence strength:** four steps as icon plus text: Claimed (outline), Reported, Observed, Verified (filled).
- **Modes:** an icon and a label per mode. Booked is solid, quoted is dashed, agent-estimated is hatched, sold out is struck through.
- **Frame:** a rounded app shell with hairline borders instead of heavy shadows, as in the reference.
- **Motion:** 120 ms for selection and pane changes only.

### 7.8 States (designed, not afterthoughts)
| State | Treatment |
|---|---|
| Loading | Skeleton rows at the real row height. |
| Empty queue | A sentence and the quiet line. |
| Agent working | `AgentStatusLine` with the current step. |
| Recorded run | A visible badge, and a "run live" action when a key exists. |
| Tiles failed | The route strip stands alone. |
| Stale data | The deadline or ETA turns amber with its age. |
| Error | A plain sentence and a retry. |
| Small sample | A tag on every "k of n". |

### 7.9 Accessibility
Visible focus rings. AA contrast on both themes. Every action reachable by keyboard. Meaning never carried by colour alone. Reduced motion respected. Buttons have text labels, not just icons.

### 7.10 UI build order (inside the schedule in section 9)
| When | UI work |
|---|---|
| 20:30–23:00 | Tokens, app shell, `DecisionCard` with the four responses and the undo. |
| 23:00–01:30 | Sidebar, queue and `QueueRow`, split pane, case thread, properties, evidence chips, the empty, loading and error states. `J` / `K` / `1`–`4` / `Enter`. |
| 07:30–10:00 | `PulseCard` for Heads-up and Risk outlook, slack bar, pill tabs, maturity pills. |
| 10:00–12:30 | "What the agent learned" screen. |
| 12:30–13:15 | Route strip, then the map and driver preview. |
| 13:15 | Freeze. Run the **tired ops person** subagent on every screen and fix what it finds. |

**Cut first:** `⌘K`, then view options beyond group-by, then `⌘B`, then the dark theme. **Never cut:** the queue, the decision card, the thread, evidence chips, the empty and loading states.

### 7.11 Review checklist (the tired ops person)
- Can I tell in one glance what needs me and why?
- Can I decide without opening three things?
- Do I know what happens after I press the button?
- Can I see where every fact came from?
- Is anything shown that I don't need?
- Does any screen look like an engineering tool?

---

## 8. Dream: casebook, replay simulator and learning loop

Dream is an ops-facing system that gets better as data arrives. It builds on two ideas from recent research, taking the ideas and not the code:
- **Dream-RSI** ([paper](https://arxiv.org/pdf/2609.14858)): treat history as a **replay simulator**, and test alternative policies against stored outcomes instead of learning by live trial and error.
- **Harness²** ([paper](https://hyper.ai/en/papers/2610.14224)): keep the model's weights frozen and improve the **harness around it** (policy, thresholds, tool rules, lessons). A contrastive propose → probe → compose loop works per case, and experience is accumulated across cases.

Our "harness" is the versioned **policy**: guard rules, Watch thresholds, risk-model parameters and plain-language lessons. The model never changes. A person adopts every policy change.

### 8.1 One engine, three uses
A single pure function, `evaluate(policy, order, t)`, returns the flags, risk and root-cause exposure **as they would have been known at time `t`**. It reads only events with `recorded_at` and `received_at` at or before `t`, so there is no leakage from the future.
- **Watch** runs it at the frozen "now".
- **Replay** runs it at earlier checkpoints on past orders.
- **Simulation** runs it on perturbed copies of real orders.

Build it once. It is also why Watch, risk and Dream fit in the time.

### 8.2 The casebook
Every past order becomes a **case**, derived from existing tables with no new data: its timeline, its mishaps with root cause, the fix that was tried (decision, review, execution result), the outcome, and **what blocked the fix** (the typed action's preconditions). Closed, failed, rejected and cancelled cases are kept, because they are where the learning is. Stored in `casebook`.

### 8.3 Replay and simulation
- **Replay:** for each mishap order, run `evaluate` at checkpoints before the mishap (for example 24 h, 6 h and 1 h before the alert was raised) and ask whether the policy would have flagged it, and how early. The packet's 1,352 timestamped events make this possible.
- **Simulation:** stress a **real** order with a known failure type: ferry sold out, ETA slips 2 hours, quote goes stale, site not ready, warning light. The failure types come from the public research on how vehicle-delivery companies fail (damage disputes, cascading delays, no-shows), used only as templates.
- Simulated runs are labelled and **never written back as orders**, so the brief's rule of no invented orders still holds.

### 8.4 The learning loop (Harness²-style)
Per round:
1. **Probe:** replay every case. Find **misses** (a mishap the policy would not have flagged in time) and **false alarms**.
2. **Propose:** the LLM proposes a candidate change for a miss: a parameter diff and a plain-language lesson, shown with a **contrastive pair** (a similar case that did *not* fail). Recorded in the trace.
3. **Probe again:** a deterministic replay of the candidate against the incumbent on held-out cases (leave-one-order-out). No LLM in scoring.
4. **Compose:** keep the changes that help and drop the ones that hurt, into one candidate policy.
5. **Stop** when no candidate beats the incumbent by a margin for two rounds, or after three rounds in the demo.

The screen shows the history v1 → v2 → v3 with the same metrics each time:
- **Lead time:** how many hours before the mishap the policy would have flagged it.
- **Hit rate and false alarms.**
- Each metric shows **n**, and is labelled held-out or in-sample.

### 8.5 When does it "predict"? Maturity per failure type
Each failure type (for example ferry sold-out, vehicle-not-found, tracking gap) carries a label:

| Label | Meaning |
|---|---|
| **Learning** | Too few cases, or held-out results not better than chance. Shown, never presented as a prediction. |
| **Emerging** | Enough cases and a held-out improvement. Flags say "pattern seen in k cases". |
| **Reliable** | Enough cases, a held-out improvement, and no regression across rounds. |

The thresholds are policy parameters. With about 24 mishap orders most types will start at **Learning**, and the screen says so. A flag on an order always shows its maturity label and the similar past cases behind it.

### 8.6 It improves as new data arrives
New orders, events and ops interventions are appended to the casebook. Affected failure sources are marked **stale**, a **"New since v3: 4 events"** chip appears, and a Dream run is queued (and can be started on demand). In the demo, a recorded new event arrives and a run shows how the candidate changes.

### 8.7 Fixes are tracked, and a change can bring the deal back
Every fix stores what blocked it and what happened. A **reopen watcher** re-evaluates those blockers whenever the underlying facts change. Examples from the data:
- A sold-out crossing gets a refreshed quote with capacity.
- A timed-out booking gets a provider confirmation.
- A rejected proposal's missing evidence arrives.
- The driver confirms fitness, or a site confirms access.
- A waiting or cancelled order loses the thing that blocked it.

When a blocker clears:
1. The case appears on Today under **Back on the table**, with what changed and the earlier fix. A person decides.
2. It **triggers a learning run**: compare the earlier fix and outcome with the new facts, then update the casebook and the candidate lessons (for example, "sold-out crossings often reopen after a refresh: recheck before cancelling").

### 8.8 What ops see
**"What the agent learned"**: the round history, lessons with their linked cases, metrics with n and maturity, the "New since" chip, the candidate diff, and Go ahead / Change it / Not this, with versions, rollback and an override reason if the candidate scores worse. On every flagged order, **"Why flagged"** shows the similar past cases.

### 8.9 Honest limits
There are 100 orders, 24 with a mishap, and few events per mishap. The loop finds patterns, not proof. No accuracy percentages, no "learning curve" claims, and held-out and in-sample results are always labelled. The loop is bounded by rounds and by margin.

---

## 9. Schedule (Sat 20:30 → Sun 15:00)

| When | What |
|---|---|
| **Parallel track (a coding agent or teammate, from 20:30)** | **Voice (section 6b):** get prometheus running on its own, then fork the prompt and outcome, the order context and the proxy. **Gate at 01:30: one browser call about CD-420322 works end to end.** If it doesn't, keep only the recorded calls. Sunday 07:30–10:00: wire `call_site` / `call_driver` into the agent, record the two calls for `traces/`. |
| **20:30–23:00** | **Hero slice on CD-420299 only:** typed actions (with blockers recorded), guard, mock executor, `check_provider_status`, one real trace, decision card with the four responses. **Gate at 23:00. If it doesn't work, nothing else matters.** |
| 23:00–01:30 | Case view with the attributed thread and evidence chips. Today page with the quiet fold. Empty and loading states. |
| 01:30–07:30 | **Sleep.** |
| 07:30–10:00 | **The engine:** `evaluate(policy, order, t)`, Watch, mishap root-cause attribution, failure sources, casebook, Heads-up and Risk outlook on Today, the LLM warning line, recorded traces for the other cases. |
| 10:00–12:30 | **Dream** (section 8): replay at checkpoints with the lead-time metric, the learning loop recorded for three rounds, maturity labels, new-data ingest, the reopen watcher, the "What the agent learned" screen. |
| 12:30–13:15 | **Route strip first, then the map and driver preview** (section 6). |
| 13:15 | **Feature freeze.** Polish, `docs/AI-LOG.md`. |
| 13:45–14:30 | Record the video. Script and time it first; one or two takes. |
| 14:30–14:50 | **Fresh-clone test** in a new directory, no API key, one command. Fix what breaks. |
| 14:50–15:00 | Submit. No code changes after 14:50. |

**This no longer fits comfortably, and I'd rather say so now.** The engine, Dream and the map together need roughly two to three more hours than the morning has. The buffer is 10 minutes. Two honest options: (1) shorten sleep to about 02:00–07:00 and use the extra hour at the start of the morning, or (2) accept the cuts below. **Cut in this order if time slips:**
1. Case chat (keep a stub).
2. Live voice: keep the recorded calls in the thread.
3. Map tiles: keep the route strip.
4. "Why flagged" similar-case links.
5. LLM Propose step: use candidate changes written by hand from the ~10 reviews, and record the loop from those.
6. Simulation (perturbed orders): keep replay only.
7. Learning rounds: two instead of three.
8. LLM attribution of ambiguous mishaps (leave them *unclear*).
9. Dream override flow: keep lessons, score, adopt and rollback.
10. Watch LLM wording: keep the deterministic flags with templated text.

**Never cut:** the hero slice, the thread, evidence chips, the four responses, the replay with the lead-time metric (it is the proof that Dream works), and the fresh-clone test.

**Cut for good:** chaos button, simulated driver persona (recorded replies show in the thread instead), "Plan B while waiting", standalone Trust page, voice notes.

---

## 10. How we work with AI (30% of the score, capture it as we go)

- `docs/AI-LOG.md`, written during the build: what we asked for, what we kept, what we threw away and why. Include at least five times we did not take the first answer. Known ones already:
  - Reframed CD-420299 from "failed → Plan B" to "unknown outcome → verify".
  - Cut the chaos button and simulated persona after council review.
  - Dropped synthetic orders; kept synthetic geo only.
  - Replaced "approve" with an intervention model.
  - Reused the prometheus voice stack instead of building speech, and rewrote its M&A sales prompt for driver and site calls.
- Save prompts, discarded agent output and the moments a human overrode the agent.
- Run a subagent as a **tired ops person** that reviews every screen: "What's wrong? What do I do?"
- Commit the agent traces (`traces/*.json`).
- Use parallel coding agents for independent pieces (UI, agent, geo) and say so in the video.

---

## 11. Video script (2:45)

1. **0:00–0:20** The problem: one missed ferry becomes a chain someone has to remember.
2. **0:20–0:45** Today: what needs you, the Heads-up, everything else folded away.
3. **0:45–1:35** CD-420299: the thread, the evidence chips, the agent checks the provider and does not rebook (a 10-second clip of its voice call to the ferry desk), the map with the plan, one decision, Go ahead, and what happens next.
4. **1:35–1:55** Watch: a heads-up on CD-420603 before anything has gone wrong.
5. **1:55–2:20** What the agent learned: replay shows how early it would have flagged past failures, a human's edit becomes a lesson, and a person adopts it. A cleared blocker puts an old case back on the table.
6. **2:20–2:45** How we built it: the AI log, the tired-ops reviewer, what we threw away.

---

## 12. Definition of done

- [ ] `git clone` → README steps → app runs with seeded data **and no API key**
- [ ] CD-420299, CD-420322 and CD-420154 run end to end with saved traces; the other three have traces too
- [ ] No customer message leaves without approval (a test proves it)
- [ ] Every fact on the case view has an evidence chip
- [ ] The case view has the who-said-what-and-when thread
- [ ] Watch flags at least three cases from real data signals and shows slack in plain words
- [ ] Every mishap order has a root-cause category (route, mode, vehicle, dealership or unclear) with an evidence chip
- [ ] Risk outlook on Today lists failure sources (routes, modes, car makes, dealerships) with k-of-n and the upcoming orders exposed; under 3 orders says "too few to say"; no driver is scored or ranked
- [ ] Replay: for past mishap orders, `evaluate` at earlier checkpoints reports whether and how early it would have flagged them (lead time, hit rate, false alarms), each with n and labelled held-out or in-sample
- [ ] The learning loop has recorded rounds v1 → v2 → v3, and a candidate that scores worse can't be adopted without an override and reason *(Built: rounds, scoring, override rule. On this packet, scored without future data, no candidate beats v1, so the honest history is v1 only.)*
- [ ] Each failure type shows a maturity label (Learning / Emerging / Reliable); flags show their label and similar past cases
- [ ] New data appends to the casebook, marks sources stale, and queues a Dream run
- [ ] A cleared blocker on a past fix shows the case under "Back on the table" and triggers a learning run
- [ ] Simulated runs are labelled and never stored as orders
- [ ] The map renders legs by mode, with chips, ETAs with basis, and the route-strip fallback
- [ ] Synthetic geo is labelled; packet times win over synthetic ones
- [ ] Rejecting or taking over keeps the history and records the reason
- [ ] With voice off, `call_site` / `call_driver` play a recorded call in the thread; with `make voice`, a live browser call works on CD-420322
- [ ] Call answers become facts with "said on a call" chips; the guard refuses a call to a customer (a test proves it)
- [ ] prometheus reuse is licensed or permitted in writing, credited, and its third-party notices kept; no model weights committed
- [ ] "What the agent learned" shows lessons linked to cases, a labelled small-sample score, adopt and rollback
- [ ] Every number shown in the video is checked against the data
- [ ] Video uploaded, repo public, no secrets committed
