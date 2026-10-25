// Mock executor (ADR-006). It re-checks the option's blockers against current facts before writing, the way the
// packet's own proposals use RECHECK_CURRENT_STATE_BEFORE_WRITE. The unknown-outcome blocker was settled when
// the agent proposed (a booking proposal cannot exist without a provider check), so it is not re-asked here.
import { actionFor } from "@/lib/actions"
import { bookingFacts } from "@/lib/actions/facts"
import { packet } from "@/lib/packet"
import { fmtDateTime } from "@/lib/present/time"

type Input = { action: string; order: string; payload: Record<string, unknown> }
export type Execution = { ok: boolean; effect: { summary: string; reference?: string }; next: string[] }

function terminalZone(name: string): string | null {
  const lead = name.split(" ").slice(0, 2).join(" ").toLowerCase()
  const terminal = packet().all("ferry_terminals").find((t) => String(t.name).toLowerCase().startsWith(lead))
  return terminal ? String(terminal.timezone) : null
}

function reference(order: string, action: string): string {
  return `MOCK-${order.replace("CD-", "")}-${action.replace("propose_", "").toUpperCase()}`
}

export function execute(input: Input): Execution {
  const action = actionFor(input.action)
  if (!action) return { ok: false, effect: { summary: `Unknown action ${input.action}.` }, next: [] }

  if (input.action === "propose_booking") {
    const option = packet().byId("travel_options", String(input.payload.option_id ?? ""))
    const blockers = action.blockers?.(input.payload, bookingFacts(input.order, input.payload, true)) ?? []
    if (!option) return { ok: false, effect: { summary: "Not booked: the option is no longer listed." }, next: [] }
    if (blockers.length) return { ok: false, effect: { summary: `Not booked: ${blockers.join(" ")}` }, next: [] }
    return {
      ok: true,
      effect: {
        summary: `Booked ${option.provider} ${option.from_city} to ${option.to_city}, departing ${fmtDateTime(String(option.departure_at), terminalZone(String(option.from_city)))}.`,
        reference: reference(input.order, input.action),
      },
      next: ["Tell the driver the new sailing and check-in time", "Confirm the delivery window still holds"],
    }
  }

  switch (input.action) {
    case "propose_hotel":
      return {
        ok: true,
        effect: { summary: `Hotel night booked in ${input.payload.city} for ${input.payload.night_of}.`, reference: reference(input.order, input.action) },
        next: ["Send the driver the hotel address"],
      }
    case "propose_date_change":
      return {
        ok: true,
        effect: { summary: `New delivery date ${input.payload.new_date} recorded as proposed, not yet agreed with the customer.` },
        next: ["Send the customer the drafted date change for approval"],
      }
    case "propose_cost":
      return { ok: true, effect: { summary: `Cost approved for this order: ${input.payload.amount_cents} ${input.payload.currency} cents.` }, next: [] }
    case "draft_customer_update":
      return { ok: true, effect: { summary: "Draft approved. A person sends it from the customer thread." }, next: ["Send the approved update to the customer"] }
    default:
      return { ok: false, effect: { summary: `${input.action} cannot be executed.` }, next: [] }
  }
}
