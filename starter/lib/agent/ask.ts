// "Ask the agent" (ADR-001): a person asks about a case and the agent works it with the same tools and guard.
import { packet } from "@/lib/packet"
import { runAgent, type ModelCall } from "./loop"
import type { Trace } from "./trace"

type Deps = { model: ModelCall; persist: (trace: Trace) => Promise<void>; live: boolean; runId: string; modelName?: string }
export type AskResult = { ok: true; answer: string; proposals: number } | { ok: false; error: string }

export async function askAgent(input: { order: string; question: string }, deps: Deps): Promise<AskResult> {
  const question = input.question.trim()
  if (!question) return { ok: false, error: "Type a question first." }
  if (!packet().orderByRef(input.order)) return { ok: false, error: `No order ${input.order} in the snapshot.` }
  if (!deps.live) {
    return { ok: false, error: "The agent can't answer new questions right now: no working API key is set. Recorded runs still show what it did." }
  }
  const trace = await runAgent({
    order: input.order, trigger: "ask", prompt: question, model: deps.model, modelName: deps.modelName, runId: deps.runId,
  })
  await deps.persist(trace)
  return { ok: true, answer: trace.summary, proposals: trace.proposals.length }
}
