// The casebook (ADR-011): every past order as a case, derived from existing records only.
// Closed, failed, rejected and cancelled cases stay in, because that is where the learning is.
import { actionFor } from "@/lib/actions"
import { packet, type Packet } from "@/lib/packet"
import { attributeMishaps, type Mishap } from "@/lib/risk/attribute"

export type Fix = { action: string; status: string; result: "done" | "failed" | "waiting" | "rejected"; at: string; note: string | null }
export type Case = {
  order: string
  outcome: "delivered" | "cancelled" | "open"
  mishaps: Mishap[]
  fixes: Fix[]
  blockers: string[]
}

const RESULT: Record<string, Fix["result"]> = {
  EXECUTED: "done", FAILED: "failed", REJECTED: "rejected", PENDING_REVIEW: "waiting", APPROVED_AWAITING_EXECUTION: "waiting",
}

export function buildCasebook(p: Packet = packet()): Case[] {
  const mishaps = attributeMishaps(p)
  return p.all("orders").map((order) => {
    const reference = String(order.reference)
    const delivered = p.forOrder(order.id, "operational_events").some((e) => e.command === "vehicle.delivered")
    const fixes: Fix[] = p.forOrder(order.id, "agent_proposals").map((a) => {
      const execution = a.execution as Record<string, unknown> | null
      const error = execution?.error ? String(execution.error) : null
      return {
        action: String(a.command),
        status: String(a.status),
        result: error ? "failed" : RESULT[String(a.status)] ?? "waiting",
        at: String(a.created_at),
        note: error ?? (typeof a.summary === "string" ? a.summary : null),
      }
    })
    // What blocked a fix, in the same words the typed actions use, so the reopen watcher can re-check it.
    const blockers = new Set<string>()
    for (const fix of fixes) {
      if (fix.result === "failed" && /timed out/i.test(fix.note ?? "")) blockers.add("An earlier booking attempt has an unknown outcome.")
    }
    if (p.forOrder(order.id, "travel_options").some((o) => o.status === "SOLD_OUT")) {
      blockers.add(actionFor("propose_booking")!.blockers!({}, { optionStatus: "SOLD_OUT" })[0])
    }
    return {
      order: reference,
      outcome: order.cancelled_at ? "cancelled" : delivered ? "delivered" : "open",
      mishaps: mishaps.filter((m) => m.order === reference),
      fixes,
      blockers: [...blockers],
    }
  })
}
