# ADR-015: Read the packet through an in-memory index for the agent and the engine

## Status
Accepted

## Date
2026-10-25

## Context
The agent's read tools (ADR-001), Watch (ADR-008), risk (ADR-009) and the `evaluate` engine (ADR-010) all need cross-collection reads over the whole packet: travel options, reservations, alerts, messages, events and windows, joined per order. The starter loads part of the packet into Postgres. Some collections are flattened into tables, and the rest sit in a generic `related_records` table as JSON. The packet is one fixed snapshot of 100 orders and 4,366 records, and it never changes at runtime.

The engine must be pure and deterministic so that replay and its tests can't drift with database state.

## Decision
- `lib/packet.ts` reads `dataset/data/*.jsonl` once into memory and indexes it by collection, by id, and by order. Bundle offers are indexed under every order in `order_ids`.
- The agent tools, Watch, risk, the casebook, replay and simulation read packet facts through this index.
- **Postgres still holds** the starter's views and **all agent state**: runs, steps, decisions, flags and policy versions (ADR-005).
- `DATASET_DIR` overrides the location, the same way the starter's seed does.

## Alternatives Considered

### Query Postgres for every packet read
- Pros: One source of truth.
- Cons: Most collections live as JSON in `related_records`, so joins are awkward. Engine tests would need a seeded database, and replay speed would depend on query count.
- Rejected for packet reads. The database stays the source for agent state.

### Copy the packet into new typed tables
- Rejected: Duplicates the seed, and diverges from the packet if the starter's seed changes.

## Consequences
- Engine and tool tests run without a database.
- Packet facts the agent sees and facts the starter's pages show come from the same JSONL files, so they agree.
- New data in the demo (ADR-011 "new since") is an agent-side event appended to agent tables, not a packet edit. The packet stays untouched.
