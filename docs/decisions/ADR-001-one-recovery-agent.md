# ADR-001: One Recovery agent with three triggers

## Status
Accepted

## Date
2026-10-24

## Context
The brief asks for two things: a control room, and "one real agent for one area" that uses tools, that a person can talk to, that does the cheap work first, and that then either finishes the job or brings a person a clear decision. It lists four candidate areas: pickup readiness by phone, driver travel, on the road, and driver support.

We have about 18 working hours (Sat 20:30 to Sun 15:00, with sleep). One story has to carry a 2–3 minute video. The packet's hardest cases (missed or sold-out ferries, timed-out bookings, warning lights) sit where **On the road** and **Driver travel** overlap: a disruption on the road usually means replanning travel.

## Decision
Build **one agent, the Recovery agent**, covering On the road and Driver travel. It has three triggers:

| Trigger | What starts it |
|---|---|
| Watch | A scheduled sweep over every order with travel (ADR-008). |
| On the road | An alert, a missed or sold-out ferry, a breakdown, a driver message. |
| Ask | An ops person talks to it about a case. |

It reads, asks the driver or site, and prices alternatives without approval. It stops before any booking, date change, cost or customer message (ADR-002).

**Hero case: CD-420299.** The ferry booking call timed out with no confirmation. The agent does not rebook. It checks what the provider actually knows, and brings one decision to a person.

Deep demo orders: CD-420299 (hero), CD-420322 (warning light, driver safe), CD-420154 (approved is not done). CD-420399, CD-420603 and CD-420449 also appear in Watch and on the map. All six get a recorded trace.

## Alternatives Considered

### Separate agents per area
- Pros: Each agent is simpler.
- Cons: Doubles the tool, trace and UI work, and the brief asks to go deep on one area.
- Rejected: Not achievable to a good standard in the time.

### Driver support
- Pros: A large volume of routine messages.
- Cons: Weaker demo story, and it is mostly chat triage rather than a chain of dependent decisions.
- Rejected: Out of scope.

### CD-420299 framed as "booking failed, go to Plan B"
- Pros: A dramatic rebooking demo.
- Cons: The data says the outcome is *unknown*, not failed. Rebooking risks a double booking. This is the "a quote is not a booking" trap the brief warns about.
- Rejected: Reframed as "unknown outcome, so verify first". Logged in `docs/AI-LOG.md` as a time we did not take the first answer.

## Consequences
- One tool set, one trace format and one decision card serve every demo case.
- The agent is grounded in two areas, so other areas (driver support, pickup readiness by phone) are visibly out of scope. ADR-014 adds a voice call to drivers and sites, but does not widen the area.
- **Ask (chat) is required by the brief** ("a person can talk to"), even though the build plan's cut list puts case chat first. If it is cut, a minimal working version must remain.
