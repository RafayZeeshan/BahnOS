// A read-only, in-memory index over the packet's JSONL files (ADR-015).
// The agent's read tools, Watch and the replay engine need every record for pure,
// deterministic logic; the packet is small, so it is read once and cached.
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type Rec = Record<string, unknown> & { id: string }

export type Packet = {
  all(collection: string): Rec[]
  byId(collection: string, id: string): Rec | undefined
  forOrder(orderId: string, collection: string): Rec[]
  orderByRef(reference: string): Rec | undefined
}

let cached: Packet | undefined

export function packetDir(): string {
  return process.env.DATASET_DIR ?? join(process.cwd(), "..", "dataset", "data")
}

export function loadPacket(dir: string = packetDir()): Packet {
  const collections = new Map<string, Rec[]>()
  for (const file of readdirSync(/*turbopackIgnore: true*/ dir).filter((name) => name.endsWith(".jsonl"))) {
    const rows = readFileSync(/*turbopackIgnore: true*/ join(dir, file), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Rec)
    collections.set(file.replace(/\.jsonl$/, ""), rows)
  }

  const ids = new Map<string, Map<string, Rec>>()
  const byOrder = new Map<string, Map<string, Rec[]>>()
  for (const [collection, rows] of collections) {
    ids.set(collection, new Map(rows.map((row) => [row.id, row])))
    for (const row of rows) {
      // A bundle offer's order_id is only its filing location; order_ids holds every order it covers.
      const owners = new Set<string>()
      if (typeof row.order_id === "string") owners.add(row.order_id)
      if (Array.isArray(row.order_ids)) for (const id of row.order_ids) if (typeof id === "string") owners.add(id)
      for (const owner of owners) {
        const perOrder = byOrder.get(owner) ?? new Map<string, Rec[]>()
        perOrder.set(collection, [...(perOrder.get(collection) ?? []), row])
        byOrder.set(owner, perOrder)
      }
    }
  }
  const refs = new Map((collections.get("orders") ?? []).map((order) => [String(order.reference), order]))

  return {
    all: (collection) => collections.get(collection) ?? [],
    byId: (collection, id) => ids.get(collection)?.get(id),
    forOrder: (orderId, collection) => byOrder.get(orderId)?.get(collection) ?? [],
    orderByRef: (reference) => refs.get(reference),
  }
}

export function packet(): Packet {
  cached ??= loadPacket()
  return cached
}
