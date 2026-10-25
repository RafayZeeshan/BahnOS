// The policy in use is the latest version a person adopted (ADR-011); v1 until anyone adopts another.
import { desc, eq } from "drizzle-orm"
import { policyVersions } from "@/lib/agent-schema"
import { db } from "@/lib/db"
import { sourceRates } from "@/lib/risk/rates"
import { POLICY_V1, type Policy } from "./defaults"

export async function activePolicy(): Promise<Policy> {
  const [row] = await db.select().from(policyVersions).where(eq(policyVersions.status, "ADOPTED")).orderBy(desc(policyVersions.adoptedAt)).limit(1)
  return row ? (row.params as unknown as Policy) : POLICY_V1
}

/** Source records for the exposure lesson, only when the policy uses them. */
export function ratesFor(policy: Policy) {
  return policy.risk.watch_on_elevated ? sourceRates(policy) : undefined
}
