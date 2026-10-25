import { NextResponse } from "next/server"
import { loadToday } from "@/lib/control/load"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await loadToday())
}
