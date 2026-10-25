import { asc } from "drizzle-orm"
import { learningRuns, policyVersions } from "@/lib/agent-schema"
import { db } from "@/lib/db"
import type { Policy } from "@/lib/policy/defaults"
import type { VersionRow } from "./report"

export async function loadVersions(): Promise<VersionRow[]> {
  const rows = await db.select().from(policyVersions).orderBy(asc(policyVersions.version))
  return rows.map((r) => ({
    version: r.version, status: r.status, params: r.params as unknown as Policy, parentVersion: r.parentVersion,
    adoptedAt: r.adoptedAt?.toISOString() ?? null, adoptedBy: r.adoptedBy, overrideReason: r.overrideReason,
  }))
}

export async function loadRounds() {
  return db.select().from(learningRuns).orderBy(asc(learningRuns.createdAt), asc(learningRuns.round))
}
