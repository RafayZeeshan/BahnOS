import { describe, expect, it } from "vitest"
import { recordedCall } from "@/lib/agent/calls"
import { runTool } from "@/lib/agent/tools"
import { buildCase } from "@/lib/control/case"

describe("recorded calls (ADR-014)", () => {
  it("returns the recorded call with the ferry desk for CD-420299", () => {
    const call = recordedCall("CD-420299", "site") as Record<string, any>
    expect(call.recorded).toBe(true)
    expect(call.placed).toBe(true)
    expect(call.transcript[0]).toEqual(expect.objectContaining({ speaker: "agent", text: expect.stringMatching(/AI/) }))
    expect(call.answers.map((a: any) => a.evidence.label)).toEqual(["site said on a call", "site said on a call"])
  })

  it("returns the recorded call with the driver for CD-420322, answers as driver said on a call", () => {
    const call = runTool("call_driver", { order: "CD-420322", recipient_role: "driver", questions: ["Are you safe?"] }) as Record<string, any>
    expect(call.transcript.length).toBeGreaterThan(3)
    expect(call.answers[0].evidence).toEqual(expect.objectContaining({ strength: "claimed", label: "driver said on a call" }))
  })

  it("always opens by saying it is an AI and never promises anything", () => {
    for (const [order, role] of [["CD-420299", "site"], ["CD-420322", "driver"]]) {
      const t = (recordedCall(order, role) as Record<string, any>).transcript
      expect(t[0].text).toMatch(/\bAI\b/)
      for (const turn of t.filter((x: any) => x.speaker === "agent")) expect(turn.text).not.toMatch(/\b(I will book|we guarantee|I promise)\b/i)
    }
  })

  it("says plainly when no call is recorded", () => {
    expect(recordedCall("CD-420001", "site")).toEqual(expect.objectContaining({ placed: false, recorded: false }))
  })

  it("shows a call in the case thread with its transcript, and its answers as facts", () => {
    const output = recordedCall("CD-420322", "driver")
    const view = buildCase({
      reference: "CD-420322", decisions: [], chain: [],
      runs: [{ id: "r", trigger: "on_the_road", mode: "recorded", summary: "s", startedAt: "2026-10-21T09:00:00.000Z", steps: [
        { seq: 1, kind: "tool_call", tool: "call_driver", input: {}, at: "2026-10-21T09:00:20.000Z" },
        { seq: 2, kind: "tool_result", tool: "call_driver", output, at: "2026-10-21T09:00:40.000Z" },
      ] }],
    })!
    const call = view.thread.find((t) => t.call)!
    expect(call.call!.with).toBe("driver")
    expect(call.call!.transcript.length).toBeGreaterThan(3)
    expect(view.facts.filter((f) => f.evidence.label === "driver said on a call").length).toBeGreaterThan(0)
  })
})
