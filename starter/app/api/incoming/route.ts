import { NextResponse } from "next/server"
import { closeReopen, newSince, playNextFact } from "@/lib/dream/incoming-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await newSince())
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { op?: string; id?: string }
  if (body.op === "close" && body.id) {
    await closeReopen(body.id)
    return NextResponse.json({ ok: true })
  }
  const result = await playNextFact()
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
