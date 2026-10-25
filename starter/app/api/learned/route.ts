import { NextResponse } from "next/server"
import { loadRounds, loadVersions } from "@/lib/dream/load"
import { describeChange, learnedReport } from "@/lib/dream/report"
import { stressTest } from "@/lib/dream/simulate"
import { now } from "@/lib/clock"
import { activePolicy, ratesFor } from "@/lib/policy/active"
import { sweep } from "@/lib/watch/sweep"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const [rows, rounds] = await Promise.all([loadVersions(), loadRounds()])
  const report = learnedReport(rows)
  const proposer = rounds.map((r) => (r.metrics as Record<string, unknown>).proposer).find(Boolean) ?? "rules"
  const stress = stressTest(await activePolicy(), now().toISOString())
  // What each version would mean for today's shift: how many Heads-up cards it would show.
  const headsUpToday = Object.fromEntries(report.versions.map((v) => [v.version, sweep(v.params, now().toISOString(), {}, ratesFor(v.params)).length]))
  // What the last round tried, in plain words, so "nothing kept" still shows the work and why.
  const last = [...rounds].reverse().find((r) => Array.isArray((r.metrics as Record<string, unknown>).candidates))
  const tried = last ? ((last.metrics as { candidates: { diff: { path: string; from: unknown; to: unknown }[]; metrics: { hits: { k: number; n: number }; falseAlarms: { k: number; n: number } } }[] }).candidates)
    .map((c) => ({ change: c.diff.map(describeChange).join(" "), hits: c.metrics.hits, falseAlarms: c.metrics.falseAlarms })) : []
  return NextResponse.json({ proposer, rounds, ...report, stress, headsUpToday, tried })
}
