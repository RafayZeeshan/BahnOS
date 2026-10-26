# BahnOS

Our entry for Bahn's Car Delivery Control Room challenge (Prompt Operations Hackathon, 24–25 October 2026).

Bahn's ops team shouldn't have to hold the whole chain in their head. In **BahnOS**, an agent called **BahnBot** watches every trip, warns early when a travel plan looks shaky, gathers the facts, and brings a person **one decision, with evidence for every fact**. It never contacts a customer, never buys anything on its own, and knows when to stop. A learning loop proposes changes to its own rules, and a person adopts them.

Everything in this repo is fictional: the packet's orders, people and messages, and the recorded follow-ups and calls we added.

## Run it

You need **Node.js 24** and **Docker**.

```sh
cd starter
cp .env.example .env
npm ci
docker compose up -d --wait
npm run setup
npm run dev
```

Then open http://localhost:3000.

`npm run setup` pushes the schema, seeds the packet and its attachments, then seeds the agent tables (policy v1, the casebook, failure sources, a first learning round) and loads the recorded agent runs and Watch lines from `traces/`.

**No API key is needed.** Without one, the app shows the packet, Watch, the Risk outlook, Dream and any recorded agent runs. To run BahnBot live (Ask BahnBot, `npm run agent:record`), put `ANTHROPIC_API_KEY=` in `starter/.env`. `CLAUDE_API_KEY` in the repo-root `.env` also works. An `OPENROUTER_API_KEY` is used instead when set, which is how the recorded runs were made. The model defaults to `claude-sonnet-5-5` (`anthropic/claude-sonnet-5.5` on OpenRouter); set `AGENT_MODEL` to change it.

If port 5438 or 9009 is taken, change it in `starter/compose.yaml` and the matching line of `starter/.env`.

### Useful commands (from `starter/`)

| Command | What it does |
|---|---|
| `npm test` | The test suite (Vitest). Database tests run when `DATABASE_URL` is set. |
| `npm run typecheck` / `npm run build` | Type check / production build |
| `npm run agent:record -- CD-420299` | Run the agent live on a demo order and save the trace to `traces/` |
| `npm run watch:record` | Have the model write Watch's one-line warnings live, saved to `traces/watch/lines.json` |
| `npm run agent:load` | Load the recorded runs and Watch lines into the database (part of `setup`) |
| `npm run dream` | Run one learning round from the adopted policy |
| `npm run demo:reset` | Put the agent state back to the start of the demo |
| `npm run geo:seed` | Rebuild the map's geo layer in `data/geo/` |

## What you'll see

Light and dark themes follow the system; the moon/sun button in the header bar switches them.

- **Ops map:** the whole network on one screen: every order as a lane between two cities, coloured by what it needs, with BahnBot's open decisions on the lanes, local clocks for Finland, Denmark and Germany, handovers at risk, the next deadlines, an activity timeline you can brush, and a disruption watch of public holidays and live headlines. It shows the records at the snapshot; a lane opens its case. Ported from our team's BahnOS ops map (ADR-017).
- **Answer book:** 80 driver-support questions, each saying whether BahnBot may answer it alone, must check the records, must ask one question first, or must hand it to a person, with what it must never say and the corner cases. BahnBot looks entries up with its `answer_book` tool, in the driver's own market.
- **Today:** only the orders that need a person, one line each: the car, one plain reason, the deadline that decides it, and the next move. Everything else folds into "on track". `J`/`K` to move, `Enter` to open, `⌘K` to jump, `?` for all shortcuts.
- **A case:** the situation as the headline, then one decision card: the change, the cost and who gets told as tiles, and **Go ahead `1` · Change it `2` · Take over `3` · Not this `4`**. The last three need a reason. Go ahead has a 5-second undo, and approved is not done until the executor reports back. BahnBot's reasoning, evidence chips (*driver said*, *quoted by provider, not booked*, *confirmed by provider*) and a preview of the driver's app sit behind "Why, and what happens next". Activity, Route (a stepper and a map), Facts and Order are tabs. Ask BahnBot from the Activity tab. Open work from Bahn's other agents (for CD-420299, the failed booking) is one click under the card.
- **Heads-up (Watch):** a rules-only sweep over every active order. At the snapshot it flags 9 of 76. Only those 9 go to the model, which writes one plain warning line and picks the cheap next step (ask the driver, check what the provider holds).
- **Risk outlook:** which routes, modes, makes and dealerships keep causing trouble, always as *k of n* with a meter, shrunk for small samples. No driver is scored or ranked. A second tab, **On the map**, draws every upcoming order that leans on a risky source as a lane, coloured by its worst trouble rate. Pick a source to see where it bites, or a lane to see what it leans on; each card's "On the map" link opens the map filtered to that source.
- **Learning:** each candidate change to Watch is replayed on past orders, using only what was known at each checkpoint and scored on orders it did not learn from. A person adopts any change. On this packet the honest answer is that nothing beats v1: v1 catches 2 of 21 past problems ahead of time with no false alarms, and every change tried catches the same 2. Tabs show each try, the versions, a stress test on simulated orders, and how sure the agent is per kind of problem.

## How it's built

- `starter/`: the packet's Next.js + Postgres starter, extended. Agent state lives in its own tables, so reseeding the packet is safe.
- `starter/lib/agent/`: BahnBot's tool loop (Claude API), tools, recorded calls and traces.
- `traces/`: the six demo runs and Watch's warning lines, recorded live with Claude Sonnet 5.5 through OpenRouter. With no key, the app replays these.
- `starter/lib/policy/guard.ts`: the brief's rules, enforced in code: no customer contact, a person approves every change.
- `starter/lib/engine/evaluate.ts`: one engine, `evaluate(policy, order, t)`, shared by Watch, replay and simulation. It never reads past `t`.
- `starter/lib/dream/`: casebook, replay, learning loop, versions, new data, simulation.
- `starter/app/map/`, `starter/lib/opsmap/`: the ops map, ported from the team's BahnOS (ADR-017). It is written in Tailwind, scoped to that page and the answer book.
- `starter/lib/answers/`: the answer book and BahnBot's lookup into it.
- `starter/app/ui/`: the design system (ADR-018, Kursbuch): tokens for light and dark, and a small component kit on Motion.
- `docs/decisions/`: 18 architecture decision records. ADRs 001–016 call BahnBot "the Recovery agent", its earlier name. `docs/SPEC.md` and `tasks/plan.md` are the spec and task list we built from.
- `docs/AI-LOG.md`: how we worked with Claude Code, including what we threw away.

## What's not done, and why

- **Live voice is not wired in.** The plan reuses the [prometheus](https://github.com/Abdullah12has/prometheus) voice stack, but that repository has no licence, so we haven't copied any of its code. Calls are recorded, fictional transcripts that the browser can read aloud.
- **No new policy version.** An early build showed a v2 catching 8 of 21 problems a day ahead. A code review found that replay was reading facts from after each checkpoint. Once that was fixed, the gain disappeared, so the loop now keeps nothing. 21 past problems are too few to learn from yet.
- Watch does not yet look at site readiness or vehicle warnings. The stress test says so.

The packet's original README is in [docs/PACKET-README.md](docs/PACKET-README.md). The brief is in [PARTICIPANT-BRIEF.md](PARTICIPANT-BRIEF.md).
