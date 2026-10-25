import { NextResponse } from "next/server"
import { now } from "@/lib/clock"
import { evaluate } from "@/lib/engine/evaluate"
import { activePolicy } from "@/lib/policy/active"
import { attributeMishaps } from "@/lib/risk/attribute"
import { failureSources } from "@/lib/risk/sources"
import { packet } from "@/lib/packet"
import { CITY } from "@/lib/opsmap/ops"
import { orderPlaces } from "@/lib/opsmap/places"
import { buildRiskMap } from "@/lib/opsmap/risk"

function caseCar(ref: string): string {
  const p = packet()
  const order = p.orderByRef(ref)
  const item = order && p.forOrder(order.id, "order_items").find((i) => i.role === "PRIMARY")
  const v = item && p.byId("vehicles", String(item.vehicle_id))
  return v ? `${v.make} ${v.model}` : ""
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const t = now().toISOString()
  const policy = await activePolicy()
  const sources = failureSources(policy, t)
  // Each exposed order carries its own Watch level, so the drill-down shows where it stands today.
  const levels: Record<string, string> = {}
  const cars: Record<string, string> = {}
  for (const s of sources) for (const ref of s.upcoming.refs) {
    levels[ref] ??= evaluate(policy, ref, t).level
    cars[ref] ??= caseCar(ref)
  }
  return NextResponse.json({ t, sources, levels, cars, mishaps: attributeMishaps(), map: buildRiskMap(sources, orderPlaces(), CITY) })
}
