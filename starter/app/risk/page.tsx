"use client"

import { useEffect, useState } from "react"
import type { RiskMap as RiskMapData } from "@/lib/opsmap/risk"
import type { FailureSource } from "@/lib/risk/sources"
import { AppFrame } from "../components/app-frame"
import { RiskCard } from "../components/cr/risk-card"
import RiskMap from "../map/risk-map"
import { Reveal, Segmented, Tabs } from "../ui/kit"
import "../map/map.css"

type Risk = { t: string; sources: FailureSource[]; levels: Record<string, string>; cars: Record<string, string>; map: RiskMapData }
type View = "sources" | "map"
const GROUPS: { kind: FailureSource["kind"]; title: string }[] = [
  { kind: "route", title: "Routes" }, { kind: "mode", title: "Ferry, train and flight legs" },
  { kind: "make", title: "Car makes" }, { kind: "dealership", title: "Pickup sites" },
]

export default function RiskPage() {
  const [data, setData] = useState<Risk | null>(null)
  const [scope, setScope] = useState<"worth" | "all">("worth")
  // The cards are the page; the map is a second way to look at the same sources.
  const [view, setView] = useState<View>("sources")
  const [focus, setFocus] = useState<string | null>(null)
  const showOnMap = (s: FailureSource) => { setFocus(`${s.kind}:${s.key}`); setView("map"); window.scrollTo({ top: 0, behavior: "smooth" }) }
  const [error, setError] = useState("")
  useEffect(() => {
    fetch("/api/risk").then((r) => r.json()).then(setData).catch(() => setError("The risk outlook could not be loaded."))
  }, [])
  const worth = data?.sources.filter((s) => s.dashboard) ?? []
  const exposed = new Set(worth.flatMap((s) => s.upcoming.refs)).size

  return <AppFrame section="risk" snapshotAt={data?.t}>
    <main className="pg">
      <Reveal>
        <header className="pg-head">
          <div>
            <h1 className="pg-title">Risk outlook</h1>
            <p className="pg-sub">Where trouble came from before, and which upcoming orders lean on it. Small samples count for less. Drivers are never scored.</p>
          </div>
          <Segmented label="Which sources" value={scope} onChange={setScope} options={[{ value: "worth", label: "Worth a look" }, { value: "all", label: "Everything" }]} />
        </header>
      </Reveal>
      {data && <Reveal i={1}><div className="kpis">
        <dl className="surf kpi"><dt>Sources worth a look</dt><dd>{worth.length}</dd></dl>
        <dl className="surf kpi"><dt>Upcoming orders that lean on them</dt><dd>{exposed}</dd></dl>
        <dl className="surf kpi"><dt>Sources tracked</dt><dd>{data.sources.length}</dd></dl>
      </div></Reveal>}
      {error && <div className="state" role="alert"><p>{error}</p></div>}
      {!data && !error && <div className="risk-grid">{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 180, borderRadius: 16 }} />)}</div>}
      {data && <Reveal i={2}><div style={{ marginTop: 24 }}>
        <Tabs label="How to look at the sources" value={view} onChange={setView} options={[
          { value: "sources", label: "Sources" },
          { value: "map", label: "On the map" },
        ]} />
      </div></Reveal>}
      {data && view === "map" && <div style={{ marginTop: 16 }}>
        <RiskMap map={data.map} scope={scope} focus={focus} setFocus={setFocus} levels={data.levels} cars={data.cars} />
      </div>}
      {data && view === "sources" && GROUPS.map((group, gi) => {
        const items = data.sources.filter((s) => s.kind === group.kind && (scope === "all" || s.dashboard))
        if (!items.length) return null
        return <Reveal key={group.kind} i={gi + 3}><section aria-labelledby={`risk-${group.kind}`} className="group">
          <h2 id={`risk-${group.kind}`} className="h-section">{group.title}</h2>
          <div className="risk-grid">{items.map((s) => <RiskCard key={`${s.kind}-${s.key}`} source={s} levels={data.levels} cars={data.cars} onShowOnMap={() => showOnMap(s)} />)}</div>
        </section></Reveal>
      })}
    </main>
  </AppFrame>
}
