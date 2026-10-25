import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { policyVersions } from "@/lib/agent-schema"
import { stamp } from "@/lib/clock"
import { db } from "@/lib/db"
import { loadVersions } from "@/lib/dream/load"
import { learnedReport } from "@/lib/dream/report"
import { decideVersion } from "@/lib/dream/versions"

export const runtime = "nodejs"

// A person adopts, rejects or rolls back a policy version. Nothing here runs on its own.
export async function POST(request: Request, context: { params: Promise<{ version: string }> }) {
  const version = Number((await context.params).version)
  const body = (await request.json().catch(() => ({}))) as { op?: string; reason?: string; override?: string; actor?: string }
  const { versions } = learnedReport(await loadVersions())
  const target = versions.find((v) => v.version === version)
  const adopted = [...versions].filter((v) => v.status === "ADOPTED").sort((a, b) => String(b.adoptedAt).localeCompare(String(a.adoptedAt)))[0]
  if (!target || !adopted) return NextResponse.json({ ok: false, error: "No such version." }, { status: 404 })
  if (body.op !== "adopt" && body.op !== "reject" && body.op !== "rollback") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 })

  const outcome = body.op === "rollback"
    ? decideVersion({ op: "rollback", candidate: target.metrics, adopted: adopted.metrics, status: target.status })
    : body.op === "reject"
      ? decideVersion({ op: "reject", candidate: target.metrics, adopted: adopted.metrics, reason: body.reason, status: target.status })
      : decideVersion({ op: "adopt", candidate: target.metrics, adopted: adopted.metrics, override: body.override, status: target.status })
  if (!outcome.ok) return NextResponse.json(outcome, { status: 409 })

  const at = stamp()
  const actor = body.actor?.trim() || "Ops"
  await db.transaction(async (tx) => {
    if (body.op === "reject") {
      await tx.update(policyVersions).set({ status: "REJECTED", overrideReason: body.reason ?? null }).where(eq(policyVersions.version, version))
      return
    }
    // Adopting or rolling back: the target becomes the one in use; the current one steps aside.
    if (adopted.version !== version) {
      await tx.update(policyVersions).set({ status: body.op === "rollback" ? "ROLLED_BACK" : "RETIRED" }).where(eq(policyVersions.version, adopted.version))
    }
    await tx.update(policyVersions).set({
      status: "ADOPTED", adoptedAt: at, adoptedBy: actor, overrideReason: "override" in outcome ? body.override ?? null : null,
    }).where(eq(policyVersions.version, version))
  })
  return NextResponse.json({ ok: true, status: outcome.status })
}
