import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it } from "vitest"
import { runAgent, type ModelCall } from "@/lib/agent/loop"
import { replayTrace } from "@/lib/agent/trace"

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }

function scripted(turns: Block[][]): { model: ModelCall; seen: Anthropic.MessageParam[][] } {
  const seen: Anthropic.MessageParam[][] = []
  let i = 0
  const model: ModelCall = async ({ messages }) => {
    seen.push(structuredClone(messages))
    const content = turns[Math.min(i++, turns.length - 1)]
    const stop_reason = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn"
    return { content, stop_reason } as unknown as Anthropic.Message
  }
  return { model, seen }
}

const use = (id: string, name: string, input: Record<string, unknown>): Block => ({ type: "tool_use", id, name, input })

describe("agent loop", () => {
  it("refuses a rebooking while the earlier attempt's outcome is unknown, then allows it after verifying", async () => {
    const { model, seen } = scripted([
      [use("t1", "get_case", { order: "CD-420299" })],
      [use("t2", "propose_booking", { order: "CD-420299", option_id: "travel-xf29ed1732d895f37", why: "Later sailing" })],
      [use("t3", "check_provider_status", { order: "CD-420299", provider: "Vela Coast Lines" })],
      [use("t4", "propose_booking", { order: "CD-420299", option_id: "travel-xf29ed1732d895f37", why: "Book the Saturday 12:00 sailing." })],
      [{ type: "text", text: "The provider holds no booking. I propose the Saturday sailing." }],
    ])
    const trace = await runAgent({ order: "CD-420299", trigger: "on_the_road", prompt: "Work the case.", model })

    const blocked = trace.steps.find((s) => s.kind === "blocked")
    expect(blocked?.output).toEqual({ blockers: ["An earlier booking attempt has an unknown outcome."] })
    expect(trace.proposals).toHaveLength(1)
    expect(trace.proposals[0]).toEqual(expect.objectContaining({ action: "propose_booking", blockers: [] }))
    expect(trace.summary).toBe("The provider holds no booking. I propose the Saturday sailing.")
    expect(trace.status).toBe("done")

    // The refusal goes back to the model as an error result so it can change course.
    const afterRefusal = seen[2].at(-1)!.content as Anthropic.ToolResultBlockParam[]
    expect(afterRefusal[0]).toEqual(expect.objectContaining({ tool_use_id: "t2", is_error: true }))
  })

  it("records a guard refusal when the model tries to contact a customer", async () => {
    const { model } = scripted([
      [use("t1", "call_site", { order: "CD-420299", recipient_role: "customer", questions: ["Can we deliver later?"] })],
      [{ type: "text", text: "Drafting for a person instead." }],
    ])
    const trace = await runAgent({ order: "CD-420299", trigger: "ask", prompt: "Tell the customer.", model })
    expect(trace.steps.find((s) => s.kind === "guard_refusal")?.text).toMatch(/never contacts a customer/)
    expect(trace.proposals).toEqual([])
  })

  it("turns an escalation into a hand-over with what it knows and doesn't", async () => {
    const { model } = scripted([
      [use("t1", "escalate", { order: "CD-420322", reason: "Owner must choose recovery.", what_i_know: ["Driver safe (driver said)"], what_i_dont_know: ["Diagnosis"] })],
      [{ type: "text", text: "Handed to a person." }],
    ])
    const trace = await runAgent({ order: "CD-420322", trigger: "on_the_road", prompt: "Warning light.", model })
    expect(trace.escalation).toEqual(expect.objectContaining({ reason: "Owner must choose recovery.", what_i_dont_know: ["Diagnosis"] }))
  })

  it("stops after the step limit and says so", async () => {
    const { model } = scripted([[use("t", "get_case", { order: "CD-420299" })]])
    const trace = await runAgent({ order: "CD-420299", trigger: "ask", prompt: "Loop.", model, maxTurns: 3 })
    expect(trace.status).toBe("stopped")
    expect(trace.summary).toMatch(/stopped after 3 steps/i)
  })

  it("dates every step from the frozen clock, in order", async () => {
    const { model } = scripted([[use("t1", "get_case", { order: "CD-420299" })], [{ type: "text", text: "Done." }]])
    const trace = await runAgent({ order: "CD-420299", trigger: "ask", prompt: "x", model })
    expect(trace.startedAt).toBe("2026-10-21T09:00:00.000Z")
    const times = trace.steps.map((s) => s.at)
    expect([...times].sort()).toEqual(times)
  })

  it("replays a recorded trace without calling a model", async () => {
    const { model } = scripted([[use("t1", "get_case", { order: "CD-420299" })], [{ type: "text", text: "Done." }]])
    const trace = await runAgent({ order: "CD-420299", trigger: "ask", prompt: "x", model })
    const replayed = replayTrace(JSON.parse(JSON.stringify(trace)))
    expect(replayed.mode).toBe("recorded")
    expect(replayed.steps).toEqual(trace.steps)
    expect(replayed.proposals).toEqual(trace.proposals)
  })
})

describe("agent loop: code review fixes", () => {
  const book = (id: string, option = "travel-xf29ed1732d895f37") => use(id, "propose_booking", { order: "CD-420299", option_id: option, why: "Book." })

  it("does not clear the unknown-outcome blocker with a provider check for another order or one that failed", async () => {
    const { model } = scripted([
      [use("t1", "check_provider_status", { order: "CD-420603", provider: "x" })],
      [use("t2", "check_provider_status", { order: "CD-999999", provider: "x" })],
      [book("t3")],
      [{ type: "text", text: "Held back." }],
    ])
    const trace = await runAgent({ order: "CD-420299", trigger: "ask", prompt: "x", model })
    expect(trace.proposals).toEqual([])
    expect(trace.steps.find((s) => s.kind === "blocked")?.output).toEqual({ blockers: ["An earlier booking attempt has an unknown outcome."] })
  })

  it("refuses a booking for an option that belongs to another order or does not exist", async () => {
    const { model } = scripted([
      [use("t1", "check_provider_status", { order: "CD-420299", provider: "Vela Coast Lines" })],
      [book("t2", "travel-x29f1d50383956888")],
      [book("t3", "travel-made-up")],
      [{ type: "text", text: "Done." }],
    ])
    const trace = await runAgent({ order: "CD-420299", trigger: "ask", prompt: "x", model })
    expect(trace.proposals).toEqual([])
    const blocked = trace.steps.filter((s) => s.kind === "blocked").map((s) => (s.output as { blockers: string[] }).blockers[0])
    expect(blocked).toEqual(["That travel option is not on this order.", "That travel option is not on this order."])
  })

  it("gives proposals ids that are unique to the run", async () => {
    const run = (runId: string) => runAgent({
      order: "CD-420299", trigger: "ask", prompt: "x", runId,
      model: scripted([[use("t1", "check_provider_status", { order: "CD-420299", provider: "Vela Coast Lines" })], [book("t2")], [{ type: "text", text: "ok" }]]).model,
    })
    const [a, b] = await Promise.all([run("ask-1"), run("ask-2")])
    expect(a.proposals[0].id).not.toBe(b.proposals[0].id)
    expect(a.proposals[0].id).toBe("dec-ask-1-1")
  })
})
