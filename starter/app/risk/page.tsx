"use client"

import { useEffect, useState } from "react"
import type { FailureSource } from "@/lib/risk/sources"
import { AppFrame } from "../components/app-frame"
import { RiskCard } from "../components/cr/risk-card"
import { Reveal, Segmented, Ticker } from "../ui/kit"

type Risk = { t: string; sources: FailureSource[]; levels: Record<string, string>; cars: Record<string, string> }
const GROUPS: { kind: FailureSource["kind"]; title: string }[] = [
  { kind: "route", title: "Routes" }, { kind: "mode", title: "Ferry, train and flight legs" },
  { kind: "make", title: "Car makes" }, { kind: "dealership", title: "Pickup sites" },
]

export default function RiskPage() {
  const [data, setData] = useState<Risk | null>(null)
  const [scope, setScope] = useState<"worth" | "all">("worth")
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
        <dl className="surf kpi"><dt>Sources worth a look</dt><dd><Ticker value={worth.length} /></dd></dl>
        <dl className="surf kpi"><dt>Upcoming orders that lean on them</dt><dd><Ticker value={exposed} /></dd></dl>
        <dl className="surf kpi"><dt>Sources tracked</dt><dd><Ticker value={data.sources.length} /></dd></dl>
      </div></Reveal>}
      {error && <div className="state" role="alert"><p>{error}</p></div>}
      {!data && !error && <div className="risk-grid">{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 180, borderRadius: 16 }} />)}</div>}
      {data && GROUPS.map((group, gi) => {
        const items = data.sources.filter((s) => s.kind === group.kind && (scope === "all" || s.dashboard))
        if (!items.length) return null
        return <Reveal key={group.kind} i={gi + 2}><section aria-labelledby={`risk-${group.kind}`} className="group">
          <h2 id={`risk-${group.kind}`} className="h-section">{group.title}</h2>
          <div className="risk-grid">{items.map((s) => <RiskCard key={`${s.kind}-${s.key}`} source={s} levels={data.levels} cars={data.cars} />)}</div>
        </section></Reveal>
      })}
    </main>
  </AppFrame>
}
