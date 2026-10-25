import type Anthropic from "@anthropic-ai/sdk"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { POLICY_V1 } from "@/lib/policy/defaults"
import { sweep } from "@/lib/watch/sweep"
import { cardsNeedingLines, loadWatchLines, parseWatchLine, writeWatchLine } from "@/lib/watch/line"

const NOW = "2026-10-21T09:00:00.000Z"
const card = sweep(POLICY_V1, NOW).find((c) => c.order === "CD-420299")!

function reply(input: Record<string, unknown>): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "test", stop_reason: "tool_use", stop_sequence: null,
    content: [{ type: "tool_use", id: "t", name: "write_warning", input }],
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message
}

describe("Watch line (ADR-008)", () => {
  it("accepts one plain line and a cheap next step", () => {
    expect(parseWatchLine(reply({ line: "  Sold out, and the retry may have booked nothing. ", next_step: "check_provider" })))
      .toEqual({ line: "Sold out, and the retry may have booked nothing.", next_step: "check_provider" })
  })

  it("refuses a multi-line answer, an essay or an unknown next step", () => {
    expect(parseWatchLine(reply({ line: "One.\nTwo.", next_step: "none" }))).toBeNull()
    expect(parseWatchLine(reply({ line: "x".repeat(260), next_step: "none" }))).toBeNull()
    expect(parseWatchLine(reply({ line: "Fine line.", next_step: "book_ferry" }))).toBeNull()
    expect(parseWatchLine(reply({}))).toBeNull()
  })

  it("sends the model the signals and the case, with only the warning tool", async () => {
    let seen: { system: string; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[] } | undefined
    const line = await writeWatchLine(async (request) => {
      seen = request
      return reply({ line: "The crossing is sold out and the retry's outcome is unknown.", next_step: "check_provider" })
    }, card, { model: "test-model", at: NOW })
    expect(seen!.tools.map((t) => t.name)).toEqual(["write_warning"])
    expect(JSON.stringify(seen!.messages)).toContain("sold out")
    expect(JSON.stringify(seen!.messages)).toContain("CD-420299")
    expect(line).toEqual({
      order: "CD-420299", level: card.level, line: "The crossing is sold out and the retry's outcome is unknown.",
      next_step: "check_provider", model: "test-model", written_at: NOW,
    })
  })

  it("returns null when the model doesn't give a usable line, so the template stays", async () => {
    expect(await writeWatchLine(async () => reply({ line: "" }), card, { model: "m", at: NOW })).toBeNull()
  })

  it("only asks for lines on flagged orders that no recorded run already warned about", () => {
    const cards = sweep(POLICY_V1, NOW)
    const gaps = cardsNeedingLines(cards, ["CD-420299"])
    expect(gaps.map((c) => c.order)).not.toContain("CD-420299")
    expect(gaps).toHaveLength(cards.length - 1)
  })

  it("loads recorded lines, and treats a missing file as none", () => {
    const dir = mkdtempSync(join(tmpdir(), "lines-"))
    expect(loadWatchLines(join(dir, "watch", "lines.json"))).toEqual([])
    mkdirSync(join(dir, "watch"))
    const rows = [{ order: "CD-1", level: "watch", line: "L", next_step: "none", model: "m", written_at: NOW }]
    writeFileSync(join(dir, "watch", "lines.json"), JSON.stringify(rows))
    expect(loadWatchLines(join(dir, "watch", "lines.json"))).toEqual(rows)
  })
})
