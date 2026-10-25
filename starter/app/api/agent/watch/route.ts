import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { watchFlags } from "@/lib/agent-schema"
import { now } from "@/lib/clock"
import { db } from "@/lib/db"
import { activePolicy, ratesFor } from "@/lib/policy/active"
import { sweep } from "@/lib/watch/sweep"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The sweep itself needs no key; only the warning wording comes from the model, via recorded runs.
export async function GET() {
  const written = await db.select().from(watchFlags).where(eq(watchFlags.lineSource, "model")).orderBy(desc(watchFlags.evaluatedAt))
  const lines: Record<string, string> = {}
  const nextSteps: Record<string, string | null> = {}
  for (const flag of written) {
    if (flag.orderRef in lines) continue
    lines[flag.orderRef] = flag.line
    nextSteps[flag.orderRef] = flag.nextStep
  }
  const policy = await activePolicy()
  const cards = sweep(policy, now().toISOString(), lines, ratesFor(policy))
    .map((card) => ({ ...card, nextStep: card.lineSource === "model" ? nextSteps[card.order] ?? null : null }))
  return NextResponse.json({ t: now().toISOString(), policyVersion: policy.version, cards })
}
