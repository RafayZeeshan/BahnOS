# ADR-014: Voice calls to drivers and sites, reusing the prometheus voice stack as a sidecar

## Status
Proposed: pending permission to reuse prometheus (the repo has no licence file)

## Date
2026-10-24

## Context
The brief's own example has the agent ask a stopped driver whether they are safe and where exactly they are, and it lists "pickup readiness, by phone" as an area. A voice call makes "the agent asks first" visible in the demo. Real phone calls are out of scope. "A simulated driver who answers in the demo is fine."

[prometheus](https://github.com/Abdullah12has/prometheus) already has a local voice stack:
- streaming ASR (Nemotron 3.5 through a Rust bridge, `native/asr`),
- local TTS (Kyutai Pocket TTS, `speech/tts_worker.py`, `speech_runtime.py`),
- a browser call protocol (`backend/VOICE_API.md`): a one-time ticket, a WebSocket carrying 16 kHz PCM, barge-in, captions, and per-turn statuses,
- a React client (`VoicePanel.tsx`, `voice-audio.ts`, `voice-capture.worklet.js`).

It already enforces: the introduction must say it is an AI, the agent makes no commitments, and the call outcome is stored as a **proposal** that is never applied to records.

**But it does not fit as-is:**
- `SAFETY_PROMPT`, `DEFAULT_INTRODUCTION` and `_propose_outcome` in `voice.py` are hard-coded for M&A sales calls ("interested in selling your company?").
- Sessions link to its own `companies` table.
- It needs its operator session cookie, a CSRF token and an allowed `Origin`.
- It needs macOS on Apple Silicon (Metal), Rust, `uv`, ffmpeg and a model download.
- Its LLM client is OpenAI-compatible (`LLM_BASE_URL`, `LLM_MODEL`). `LLM_REASONING_EFFORT=none` was tuned for Gemini.

## Decision
- Fork the voice parts into a **Python sidecar in `voice/`**, on its own port, sharing the Postgres container with its own tables (`voice_agents`, `voice_sessions`).
- **Replace** the prompt, the introduction and the outcome keys with a car-delivery call: what we need to know and why, one question at a time, no promises about dates, costs or bookings.
- Replace `company_id` with the **order reference**, and build call context from the case: order, car, open questions, and the facts already known.
- Map call answers to facts with **"driver said on a call" / "site said on a call"** chips (`Claimed`, ADR-007). The transcript appears in the case thread as one expandable call item.
- Point the LLM client at Claude, and unset `LLM_REASONING_EFFORT`.
- Allow `localhost:3000` as an origin, and add a thin **Next.js proxy** so ops don't log in twice.
- Use the **bundled default voice only. No cloning.**
- New tools `call_site` and `call_driver` (no approval). **The guard checks the callee's role and refuses any customer** (ADR-002). This is a new fixed rule, BUILD-PLAN rule 7.
- **Off by default.** With voice off, both tools return a **recorded call** (transcript + short audio in `traces/`) with a "recorded call" badge. Live voice is opt-in with `make voice`.
- Demo uses: CD-420299 (call the ferry desk to confirm whether the timed-out booking exists) and CD-420322 (call the driver: safe? where?). Teammates play the fictional people on the other end.

## Alternatives Considered

### Build our own voice pipeline
- Rejected: Not possible in the time.

### Cloud speech APIs (browser Web Speech, hosted TTS/ASR)
- Pros: Simpler setup, runs on any OS.
- Cons: More keys, and audio leaves the machine. prometheus's local pipeline is already tested.
- Not chosen. **It becomes the fallback if prometheus can't be licensed or won't build in time.**

### Text chat only
- This is the result if the 01:30 gate fails: recorded calls stay, live voice is cut (#2 on the cut list).

## Consequences
- The fresh clone still runs with one command and no key. Live voice needs Apple Silicon. The README says so.
- **Gate at Sat 01:30:** one live browser call on CD-420322 works end to end, or live voice is dropped.
- It runs on a parallel track (a coding agent or teammate) so it does not block the hero slice.
- **Before merging into the public repo:** the prometheus owner adds a licence or gives written permission. Credit it in the README and `docs/AI-LOG.md`. Keep its `THIRD_PARTY_NOTICES.md` (OpenMDW-1.1 for the ASR model, Pocket TTS terms). **Never commit model weights.**
- More stack to maintain: Python + Rust beside TypeScript.
