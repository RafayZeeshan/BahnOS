// The facts a booking's blockers read, shared by the agent loop (at proposal time) and the executor (at execution).
import { packet } from "@/lib/packet"
import type { BlockerFacts } from "./types"

export function bookingFacts(order: string, input: Record<string, unknown>, providerVerified: boolean): BlockerFacts {
  const p = packet()
  const record = p.orderByRef(order)
  if (!record) return { optionOnOrder: false }
  const option = p.byId("travel_options", String(input.option_id ?? ""))
  const timedOut = p.forOrder(record.id, "agent_proposals").some((a) =>
    /timed out/i.test(String((a.execution as Record<string, unknown> | null)?.error ?? "")))
  return {
    optionOnOrder: !!option && option.order_id === record.id,
    optionStatus: option ? String(option.status) : undefined,
    unresolvedAttempt: timedOut && !providerVerified,
  }
}
