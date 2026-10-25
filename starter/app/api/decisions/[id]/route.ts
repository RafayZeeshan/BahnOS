import { NextResponse } from "next/server"
import type { HumanResponse } from "@/lib/decisions/machine"
import { advance, decide, undoDecision } from "@/lib/decisions/service"

export const runtime = "nodejs"

const RESPONSES = new Set<HumanResponse>(["go_ahead", "change_it", "take_over", "not_this", "snooze"])

// One endpoint for the decision card: a response, an undo inside the window, or "run it now that the window has passed".
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (body.op === "undo") {
    const result = await undoDecision(id)
    return NextResponse.json(result, { status: result.ok ? 200 : 409 })
  }
  if (body.op === "execute") {
    try {
      return NextResponse.json({ ok: true, ...(await advance(id)) })
    } catch (error) {
      const missing = error instanceof Error && error.message.startsWith("No decision")
      if (!missing) console.error("Executing decision failed", id, error)
      return NextResponse.json({ ok: false, error: missing ? "No such decision." : "It could not run. Try again in a moment." }, { status: missing ? 404 : 500 })
    }
  }

  const response = body.response as HumanResponse
  if (!RESPONSES.has(response)) return NextResponse.json({ ok: false, error: "Unknown response." }, { status: 400 })
  // The control room is used by people; every response here comes from an operator.
  const result = await decide(id, {
    response,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    actor: typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : "Ops",
    actorType: "operator",
    payload: body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
