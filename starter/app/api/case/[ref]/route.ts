import { NextResponse } from "next/server"
import { buildCase } from "@/lib/control/case"
import { loadCaseInput } from "@/lib/control/load"
import { buildRoute } from "@/lib/geo/route"
import { now } from "@/lib/clock"
import { evaluate } from "@/lib/engine/evaluate"
import { activePolicy, ratesFor } from "@/lib/policy/active"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params
  const view = buildCase(await loadCaseInput(ref))
  if (!view) return NextResponse.json({ error: "No such order." }, { status: 404 })
  const policy = await activePolicy()
  const watch = evaluate(policy, ref, now().toISOString(), undefined, { rates: ratesFor(policy) })
  return NextResponse.json({ ...view, geo: buildRoute(ref), watch: { level: watch.level, signals: watch.signals.map((s) => s.text) } })
}
