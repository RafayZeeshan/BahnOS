# How we worked with AI

We built this with Claude Code (Claude Opus 5.5) as the main coding agent, with subagents for independent review and a recurring heartbeat to keep the build loop going. This log records what we asked for, what we checked, what we threw away, and where we did not take the first answer. It was written during the build, not after.

## How the work was organised

1. **Plan, then challenge it.** We wrote `BUILD-PLAN.md` and ran it past an LLM council and a grilling session. Then we asked Claude to judge it against the brief and give honest odds. The verdict: about twice the work the time allows, and it was cutting case chat, which the brief requires. We kept the plan but moved chat out of the cut list.
2. **Decisions on paper.** Claude turned the plan into 15 ADRs (`docs/decisions/`), then a spec (`docs/SPEC.md`) and a task list (`tasks/plan.md`), which we approved once.
3. **A test-first build loop.** Every task followed the same steps: a failing test, the code, the full suite, typecheck, build, and one commit. The suite grew to about 190 tests. Commits stage only the task's files.
4. **Independent review.** A "tired ops person" subagent reviewed every screen against the plan's checklist, and a code-review subagent read the agent, guard and decision code. Neither saw our reasoning, only the app and the code. Their findings are in the commits that follow them.
5. **Real browser checks.** After each UI task Claude opened the page in a browser pane and looked at it. Several bugs below were only caught that way.

## Times we did not take the first answer

| # | First answer | What we did instead | Why |
|---|---|---|---|
| 1 | CD-420299 as "the booking failed, go to Plan B" | "Unknown outcome, so verify with the provider first" | The data says the outcome is unknown, and rebooking risks a double booking. The guard now refuses a booking proposal while that blocker is open. |
| 2 | A chaos button and a simulated driver persona | Cut | Council review: spectacle, not signal. Recorded replies do the job. |
| 3 | Synthetic orders to show more cases | Dropped; only the geo layer is synthetic, and it's labelled | The brief says to keep the world as given. |
| 4 | A single "Approve" button | Go ahead / Change it / Take over / Not this, with reasons | Approve-only loses why people disagree, so nothing can be learned from it. |
| 5 | The plan's CD-420603 example: "check-in closes in 6 h 40 m; the driver can arrive in about 5 h" | "Check-in closes in 3 h 0 m", with the driver's own words shown as a claim | Checking against the data, those numbers weren't in the packet, and there's no verified driver position at all. Plan corrected. |
| 6 | The plan's risk numbers: 24 mishap orders, Volvo 5 of 8, DE→FI 4 of 9 | 21 orders, Volvo 3 of 5, DE→FI 3 of 9 (2 of 9 counting only route causes) | Counted from the data. The UI only ever shows what the data gives. |
| 7 | A test expecting FR→FI "3 of 3" | 2 of 3 | Our own rule (ADR-009) says a route answers only for route and mode problems. The third order's problem was something else. The test was wrong, not the code. |
| 8 | "Train legs: 2 of 5 had a problem" | 0 of 5 | A sold-out *ferry* was being counted against trains on the same order. Caught by reading the output, then fixed so a mode problem only counts against its own mode. |
| 9 | Watch flagging CD-420449's "26 h old quote" | Not flagged | The first fix (skip booked legs) still flagged it. The data showed the leftover quote was an unpurchased alternative, so the rule is now: stale quotes only count when nothing is booked. |
| 10 | Replay of v1 showing almost no lead time, read as "Dream doesn't work" | Kept as the honest baseline, and tried the policy lesson it points to: also watch orders on risky sources | Watch's signals are the same records that define a mishap, so v1 can't see ahead. See row 15 for what happened to the lesson. |
| 11 | Forcing a v3 policy because the plan's definition of done said "v1 → v2 → v3" | Let the stop rule decide | The stop rule is part of the design. In the end there is no v2 either (row 15). |
| 12 | Hand-writing agent traces when the API key returned 429 on every model | Refused, and waited for a working key. The six traces were then recorded live through OpenRouter | ADR-004: recorded mode replays real runs. Fake traces would be dishonest here and in this log. |
| 13 | Committing macOS-generated audio for the recorded calls | The browser's own speech engine reads the transcript | Licensing of system-voice recordings in a public repo is unclear, and the files wouldn't play the same on a judge's machine. |
| 14 | Copying prometheus's voice code into the repo | Not copied | The repository has no licence. ADR-014 stays "Proposed" until the owner adds one. |
| 15 | "v2 catches 8 of 21 past problems a median 24 h ahead", shown on the screen and in the README | Withdrawn: scored honestly, nothing beats v1 | The code-review subagent found that replay read facts from after each checkpoint: an order's later travel, final booking statuses, and other orders' later problems. Fixed with tests, the gain vanished; every candidate catches the same 2 of 21. We kept the honest "nothing to decide" result and the screen shows each try. |

## What the two reviews found

- **Tired-ops-person review (20 findings).** The worst: the case said "needs a decision" but never showed what to decide. The proposals from Bahn's own agents were hidden on another page. Also: two different deadlines for the same order, a 3-hour ferry check-in buried under "Delivery promise in 2 d", "All 100" listing only 82, raw text like "source is a conversation, not a verified outcome", and a broken phone layout. All fixed in one commit, except the starter's own board width and the map tiles' label language, which aren't ours.
- **Code review (13 findings).**
  - An undo could lose a race with execution and still say "undone". Decisions are now compare-and-set, with a test that fires three executes at once.
  - Proposal ids collided across runs.
  - The "unknown booking outcome" blocker could be cleared by a provider check for a different order.
  - "Never contact a customer" trusted a label the model filled in. Each tool now has a fixed list of who it may reach, and delivery sites are refused.
  - Replay saw the future (row 15).

## Bugs the agent made, and how they were caught

- **A stylesheet emptied by its own script.** A Python one-liner opened the CSS file for writing before reading it, which truncated it to 0 bytes. Caught when a page rendered unstyled in the browser; the file was rewritten from the last good version.
- **Stale server code.** "What the agent learned" showed v2 with the same score as v1. The same function gave the right answer outside Next, so the dev server was running stale compiled code. Touching `next.config.ts` restarted its worker.
- **A name collision.** The case API added `route` (an object) over the existing `route` (a string), which crashed the page. It was renamed `geo`.
- **Server code in the browser.** The map component imported a module that reads files, which broke the client bundle. The types and link helper moved to `lib/geo/types.ts`.
- **Class name clashes.** New CSS classes (`.facts`, `.empty`) collided with the starter's. They now use a `cr-` prefix.

## What the live runs showed

The six demo runs were first recorded on Claude Opus 5.5, then re-recorded on Claude Sonnet 5.5 (via OpenRouter) when the team made Sonnet the agent's model. We read the Sonnet runs before keeping them:

- **CD-420299:** the agent asked the ferry company *before* proposing anything: no reservation held, no charge. Then it proposed the 24 Oct sailing, a hotel night and the combined cost. It did not rebook blindly.
- **CD-420322, CD-420399:** each was handed to a person with no booking proposed (the owner's service instruction; a replacement driver), plus a drafted customer update for a person to send.
- **CD-420449:** handed to a person with a heads-up: the driver will only confirm fitness after his booked train leaves.
- **CD-420603:** the carrier confirmed the booking is still active; the agent kept it, raised a heads-up and changed nothing.
- **CD-420154:** one train booking proposed so the driver can reach the pickup.
- **One flaw we kept and note here:** the CD-420399 summary gives the pickup as "09:00–10:00" without a time zone. That is UTC, the same slot as 11:00–12:00 local.

Go ahead on the CD-420299 booking ran through to EXECUTED, and "Ask the agent" answered live, on both models.

Three things the live runs exposed:

- **Watch's model step was only half there.** ADR-008 says the model writes the warning line for each flagged order. Only orders with a recorded agent run had one, so 7 of 9 Heads-up cards showed joined-up rule text. Watch now makes one small model call per flagged order that no run already covered, with a single `write_warning` tool. Lines that are multi-line, too long or have an unknown next step are refused, and the template stays.
- **Real agent text is long.** The screens had been checked with short scripted headlines. A real hand-over reason filled the Today pane in huge type. Headlines over 140 characters now keep their first sentence, and the rest sits under the decision card's title.
- **A fresh clone never loaded the traces.** `npm run setup` seeded the agent tables but not `traces/`; only `demo:reset` did. This went unnoticed while there were no traces. `setup` now runs `agent:load`.

## What we checked by hand

- Every number on a main screen and in the README, against the packet: 9 of 76 flagged by Watch, k of n per source, the replay metrics.
- That the guard refuses customer contact and approval-less execution. Tests cover both, and a person's decision is the only path to the executor.
- That no screen shows raw record ids. The queue strips them, and the reviewers looked.

## The UI rebuild (ADR-016)

The team judged the first UI plain and too wordy. We rebuilt it on Motion and Geist, with details on demand: one line per order, one decision per case, the reasoning behind a click. Rebuilding it surfaced three bugs:

- **An approval could stall.** After Go ahead, the case refreshed and the next proposal took the approved one's place. Decisions created in the same instant came back in no fixed order. The card counting down the undo window unmounted, and the booking stayed "Approved" and never ran. Now an approval in flight stays on top, ties break by id, and any card showing a pending approval executes it once the real-time undo window has passed. Tests cover the order.
- **Demo reset left live answers behind.** `demo:reset` reloaded the recorded runs but kept every live "Ask the agent" answer, so old answers from another model showed up in the demo. Reset now clears live runs. The test is scoped to its own order, so running it never deletes real answers.
- **Entrance animations hid content in a background tab.** JavaScript-driven fades never finished there. Entrances are now plain CSS.

We also stopped the case headline repeating the decision card: the headline now says the situation, and the card says the ask.


## Bringing in the team's ops map and answer book (ADR-017)

We asked Claude to take the ops map and the answer book from our team's other prototype into this product, and to rename the product BahnOS and the agent BahnBot.

- **The first link had neither.** The Bahn-Express repository is only the challenge packet. Searching the forks found map features in two of them, but those belonged to other teams and had no licence, so Claude stopped and asked rather than port them. The right source was our own team's repository.
- **Three choices went to us, not the model.** Today stays the home screen and the map gets its own page. The map shows the snapshot instead of the prototype's live simulation, which would have been a second, simpler bot making decisions beside BahnBot. The live news and holiday feed stays.
- **Their bot logic stayed out.** The map's colours, "why it needs a person" and next decision come from BahnOS's own queue and BahnBot's decisions. Their story module called the packet's own agents "BahnBot" too; we changed it so only our agent carries that name.
- **Tailwind without breaking the rest.** The ported code is Tailwind. Our stylesheets moved into a lower cascade layer and Tailwind scans only the two ported folders, with a base reset scoped to them. The first try showed every button as a grey browser default (no base reset). The second showed the answer book unstyled: the dev server had cached the stylesheet from before that folder existed.
- **The answer book changed BahnBot's behaviour, checked live.** Asked whether a driver may keep driving with a red warning light and whether a tow is covered, BahnBot looked up the answer book, told the driver to stay stopped, and would not promise tow cover from a German-only entry without knowing the driver's market. We then made the tool take the order and apply the driver's home market itself, with a test.
- **Duplicate proposals, then fixed.** Each "Ask BahnBot" that ended in a proposal added another open proposal, so CD-420154 showed three near-identical bookings. Now a newer proposal of the same kind on an order retires the older open ones as SUPERSEDED, naming its replacement, and they re-open if the newer run is deleted, so `demo:reset` and test clean-up never lose a demo proposal.
