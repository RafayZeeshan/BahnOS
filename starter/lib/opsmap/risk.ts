// The Risk outlook on a map: each upcoming order that leans on a failure source becomes a lane, carrying
// every source it depends on and the worst of their (shrunk) trouble rates. Pure, so it is tested
// without the database; the risk API assembles it.
import type { FailureSource } from '../risk/sources'
import type { Places } from './places'

export type RiskSourceView = {
  id: string
  kind: FailureSource['kind']
  label: string
  k: number
  n: number
  shrunk: number
  elevated: boolean
  dashboard: boolean
  refs: string[]
}

export type RiskLane = { ref: string; from: string; to: string; sources: string[]; heat: number }

export type RiskMap = {
  sources: RiskSourceView[]
  lanes: RiskLane[]
  cities: Record<string, [number, number]>
  /** Exposed orders whose cities have no coordinates, so they are not drawn. */
  unplaced: number
}

export function buildRiskMap(sources: FailureSource[], places: Places, coords: Record<string, [number, number]>): RiskMap {
  const views = sources.map((s): RiskSourceView => ({
    id: `${s.kind}:${s.key}`, kind: s.kind, label: s.label, k: s.k, n: s.n, shrunk: s.shrunk,
    elevated: s.elevated, dashboard: s.dashboard, refs: s.upcoming.refs,
  }))
  const lanes = new Map<string, RiskLane>()
  for (const v of views) {
    for (const ref of v.refs) {
      const place = places[ref]
      if (!place || !coords[place.from] || !coords[place.to]) continue
      const lane = lanes.get(ref) ?? { ref, from: place.from, to: place.to, sources: [], heat: 0 }
      lane.sources.push(v.id)
      lane.heat = Math.max(lane.heat, v.shrunk)
      lanes.set(ref, lane)
    }
  }
  const cities: RiskMap['cities'] = {}
  for (const l of lanes.values()) for (const c of [l.from, l.to]) cities[c] = coords[c]
  return { sources: views, lanes: [...lanes.values()], cities, unplaced: new Set(views.flatMap((v) => v.refs).filter((r) => !lanes.has(r))).size }
}
