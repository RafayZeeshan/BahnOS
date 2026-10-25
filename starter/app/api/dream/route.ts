import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { markRunDone, newSince } from "@/lib/dream/incoming-service"
import { runDream } from "@/scripts/dream-run"

export const runtime = "nodejs"
export const maxDuration = 120

// Runs the queued learning round now. Candidates still wait for a person.
export async function POST() {
  try {
    const pending = await newSince()
    const result = await runDream(db as never, pending.reopened.length ? "reopen" : "new_data")
    await markRunDone()
    return NextResponse.json({ ok: true, rounds: result.rounds.length, candidates: result.versions.length })
  } catch (error) {
    console.error("Learning round failed", error)
    return NextResponse.json({ ok: false, error: "The learning round could not run. Try again in a moment." }, { status: 500 })
  }
}
