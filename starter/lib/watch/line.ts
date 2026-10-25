// Watch's model step (ADR-008): only flagged orders reach the model, which writes one plain warning line
// and picks the cheap next step. Lines are recorded to traces/watch/lines.json so they replay without a key.
import type Anthropic from "@anthropic-ai/sdk"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ModelCall } from "@/lib/agent/loop"
import { runTool } from "@/lib/agent/tools"
import { traceDir } from "@/lib/agent/trace"
import type { HeadsUpCard } from "./sweep"

export const NEXT_STEPS = ["ask_driver", "refresh_quote", "check_provider", "call_site", "none"] as const
export type NextStep = (typeof NEXT_STEPS)[number]

export type WatchLine = {
  order: string
  level: HeadsUpCard["level"]
  line: string
  next_step: NextStep
  model: string
  written_at: string
}

const MAX_LINE = 220

const SYSTEM = `You write the one-line warnings on Watch, the early-warning screen in Bahn's car delivery control room. A rules sweep has already flagged this order; you say why it matters in plain words for a busy operations person, and pick the cheapest useful next step.

- One sentence, at most about 30 words. No IDs (the card already shows the order reference), no jargon, no JSON.
- Keep facts apart from claims: a quote is not a booking, and a driver's message is what they said, not a verified fact.
- Don't propose bookings, costs or date changes. Watch only warns.
- Time is frozen at the "now" in the case.
Call write_warning exactly once.`

const TOOL: Anthropic.Tool = {
  name: "write_warning",
  description: "Record the one-line warning for this flagged order and the cheapest useful next step.",
  input_schema: {
    type: "object",
    properties: {
      line: { type: "string", description: "One plain sentence for an operations person." },
      next_step: {
        type: "string",
        enum: [...NEXT_STEPS],
        description: "ask_driver, refresh_quote (a stale quote), check_provider (unknown booking outcome), call_site, or none.",
      },
    },
    required: ["line", "next_step"],
  },
}

export function parseWatchLine(message: Anthropic.Message): { line: string; next_step: NextStep } | null {
  const use = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL.name)
  const input = (use?.input ?? {}) as Record<string, unknown>
  const line = typeof input.line === "string" ? input.line.trim() : ""
  const step = input.next_step as NextStep
  if (!line || line.includes("\n") || line.length > MAX_LINE || !NEXT_STEPS.includes(step)) return null
  return { line, next_step: step }
}

export async function writeWatchLine(model: ModelCall, card: HeadsUpCard, meta: { model: string; at: string }): Promise<WatchLine | null> {
  const flagged = {
    order: card.order, level: card.level, car: card.car, route: card.route,
    signals: card.bullets, driver_said: card.claims.map((c) => c.text), slack: card.slack?.label ?? null,
  }
  const response = await model({
    system: SYSTEM,
    tools: [TOOL],
    messages: [{
      role: "user",
      content: `Watch flagged this order:\n${JSON.stringify(flagged, null, 2)}\n\nThe case:\n${JSON.stringify(runTool("get_case", { order: card.order }))}`,
    }],
  })
  const parsed = parseWatchLine(response)
  return parsed && { order: card.order, level: card.level, ...parsed, model: meta.model, written_at: meta.at }
}

/** Flagged orders whose recorded agent run did not already raise a heads-up line. */
export function cardsNeedingLines(cards: HeadsUpCard[], warnedOrders: string[]): HeadsUpCard[] {
  const warned = new Set(warnedOrders)
  return cards.filter((c) => !warned.has(c.order))
}

export function watchLinesFile(dir: string = traceDir()): string {
  return join(dir, "watch", "lines.json")
}

export function loadWatchLines(file: string = watchLinesFile()): WatchLine[] {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as WatchLine[]) : []
}
