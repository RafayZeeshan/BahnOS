import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { askAgent } from "@/lib/agent/ask"
import { agentModelName, claudeModel, liveAvailable } from "@/lib/agent/claude"
import { persistTrace } from "@/lib/agent/store"
import { stamp } from "@/lib/clock"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { order?: string; question?: string }
  const live = liveAvailable()
  try {
    const result = await askAgent(
      { order: String(body.order ?? ""), question: String(body.question ?? "") },
      {
        model: live ? claudeModel() : async () => { throw new Error("not live") },
        persist: persistTrace,
        live,
        runId: `ask-${body.order}-${stamp().getTime()}`,
        modelName: agentModelName(),
      },
    )
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    // A key that exists but cannot be used (no credit, rate limit) reads the same to an ops person.
    const message = error instanceof Anthropic.RateLimitError || error instanceof Anthropic.AuthenticationError
      ? "BahnBot can't answer new questions right now: the API key was refused. Recorded runs still show what it did."
      : "BahnBot stopped with an error. Try again, or take the case yourself."
    return NextResponse.json({ ok: false, error: message }, { status: 503 })
  }
}
