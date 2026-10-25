import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it } from "vitest"
import { askAgent } from "@/lib/agent/ask"
import type { ModelCall } from "@/lib/agent/loop"
import type { Trace } from "@/lib/agent/trace"

const answer = (text: string): ModelCall => async () =>
  ({ content: [{ type: "text", text }], stop_reason: "end_turn" }) as unknown as Anthropic.Message

describe("asking the agent about a case", () => {
  it("runs the agent with the person's question and saves the run under its own id", async () => {
    const saved: Trace[] = []
    const result = await askAgent(
      { order: "CD-420299", question: "Is the later sailing actually available?" },
      { model: answer("It was quoted at 07:00 and is not booked."), persist: async (t) => { saved.push(t) }, live: true, runId: "ask-1" },
    )
    expect(result).toEqual({ ok: true, answer: "It was quoted at 07:00 and is not booked.", proposals: 0 })
    expect(saved[0].id).toBe("ask-1")
    expect(saved[0].trigger).toBe("ask")
    expect(saved[0].prompt).toBe("Is the later sailing actually available?")
  })

  it("refuses an empty question", async () => {
    const result = await askAgent({ order: "CD-420299", question: "  " }, { model: answer("x"), persist: async () => {}, live: true, runId: "a" })
    expect(result).toEqual({ ok: false, error: "Type a question first." })
  })

  it("refuses an unknown order", async () => {
    const result = await askAgent({ order: "CD-1", question: "hi" }, { model: answer("x"), persist: async () => {}, live: true, runId: "a" })
    expect(result).toEqual({ ok: false, error: "No order CD-1 in the snapshot." })
  })

  it("says plainly when the agent cannot run live", async () => {
    const result = await askAgent({ order: "CD-420299", question: "hi" }, { model: answer("x"), persist: async () => {}, live: false, runId: "a" })
    expect(result).toEqual({
      ok: false,
      error: "The agent can't answer new questions right now: no working API key is set. Recorded runs still show what it did.",
    })
  })
})
