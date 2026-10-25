// What starts each demo run. The wording mirrors the packet's own alert or message for that order.
import type { Trigger } from "./trace"

export type Scenario = { order: string; trigger: Trigger; prompt: string }

export const SCENARIOS: Scenario[] = [
  {
    order: "CD-420299",
    trigger: "on_the_road",
    prompt:
      "New alert: the current ferry crossing is unavailable, and an earlier attempt to book a replacement timed out without a confirmation. Work the case and bring a person one decision.",
  },
  {
    order: "CD-420322",
    trigger: "on_the_road",
    prompt: "New alert: the driver reports a red warning light and has stopped. Work the case and bring a person one decision.",
  },
  {
    order: "CD-420154",
    trigger: "on_the_road",
    prompt:
      "An earlier approved action on this order (refresh the ferry quote) is still awaiting execution, and the earliest crossing is sold out. Work the case and bring a person one decision.",
  },
  {
    order: "CD-420399",
    trigger: "on_the_road",
    prompt: "New alert: the assigned driver reports they cannot reach the selected pickup after their current duty. Work the case.",
  },
  {
    order: "CD-420603",
    trigger: "watch",
    prompt: "Watch flagged this order: the booked ferry's check-in cutoff is close and the driver reports a slow queue. Check it and decide the cheap next step.",
  },
  {
    order: "CD-420449",
    trigger: "watch",
    prompt: "Watch flagged this order: the driver's fitness for tomorrow's pickup is still unconfirmed. Check it and decide the cheap next step.",
  },
]

export function scenarioFor(order: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.order === order)
}
