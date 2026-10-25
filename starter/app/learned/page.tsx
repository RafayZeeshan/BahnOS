"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AppFrame } from "../components/app-frame"
import { Icon } from "../components/icons"
import { NewSinceBar } from "../components/cr/new-since"
import { VersionCard, type VersionView } from "../components/cr/version-card"
import { Reveal, Tabs, Ticker } from "../ui/kit"

type TypeRow = { cause: string; label: string; cases: number; hitsByVersion: number[]; maturity: "learning" | "emerging" | "reliable"; minCases: number }
type StressRow = { perturbation: string; label: string; k: number; n: number; sentence: string }
type Tried = { change: string; hits: { k: number; n: number }; falseAlarms: { k: number; n: number } }
type Learned = { proposer: string; versions: VersionView[]; types: TypeRow[]; stress: StressRow[]; headsUpToday: Record<string, number>; tried: Tried[] }
type Tab = "tried" | "versions" | "stress" | "kinds" | "lessons"

const STATUS: Record<string, string> = { ADOPTED: "In use", CANDIDATE: "Waiting for you", REJECTED: "Set aside", RETIRED: "Replaced", ROLLED_BACK: "Rolled back" }
const MATURITY: Record<TypeRow["maturity"], { text: string; tone: string }> = {
  learning: { text: "Learning", tone: "" }, emerging: { text: "Emerging", tone: "badge-warn" }, reliable: { text: "Reliable", tone: "badge-ok" },
}

// How Heads-up learns (ADR-011): the numbers first, each try and version behind a tab.
export default function LearnedPage() {
  const [data, setData] = useState<Learned | null>(null)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("tried")
  const load = useCallback(() => {
    fetch("/api/learned").then((r) => r.json()).then(setData).catch(() => setError("What BahnBot learned could not be loaded."))
  }, [])
  useEffect(load, [load])
  const adopted = data?.versions.filter((v) => v.status === "ADOPTED").at(-1)
  const candidates = data?.versions.filter((v) => v.status === "CANDIDATE") ?? []
  const lessons = data?.versions.flatMap((v) => v.lessons.map((l) => ({ ...l, version: v.version, status: v.status }))) ?? []

  async function rollback(version: number) {
    await fetch(`/api/policy/${version}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "rollback" }) })
    load()
  }

  return <AppFrame section="learned">
    <main className="pg">
      <Reveal>
        <header className="pg-head">
          <div>
            <h1 className="pg-title">Learning</h1>
            <p className="pg-sub">Each change to what Heads-up looks for is replayed on past orders, using only what was known at the time. A person adopts any change.</p>
          </div>
        </header>
      </Reveal>
      {error && <div className="state" role="alert"><p>{error}</p></div>}
      {!data && !error && <div className="sk" style={{ height: 120, borderRadius: 16 }} />}
      {data && adopted && <div style={{ display: "grid", gap: 18 }}>
        <Reveal i={1}><div className="kpis">
          <dl className="surf kpi"><dt>In use</dt><dd>v{adopted.version}<small>{data.proposer === "model" ? "BahnBot-suggested" : "rules"}</small></dd></dl>
          <dl className="surf kpi"><dt>Past problems caught ahead</dt><dd><Ticker value={adopted.metrics.hits.k} /><small>of {adopted.metrics.hits.n}</small></dd></dl>
          <dl className="surf kpi"><dt>False alarms</dt><dd><Ticker value={adopted.metrics.falseAlarms.k} /><small>of {adopted.metrics.falseAlarms.n} quiet</small></dd></dl>
          <dl className="surf kpi"><dt>Median warning</dt><dd>{adopted.metrics.medianLeadHours === null ? "–" : <><Ticker value={adopted.metrics.medianLeadHours} /><small>h ahead</small></>}</dd></dl>
        </div></Reveal>

        <Reveal i={2}><NewSinceBar version={adopted.version} onLearned={load} /></Reveal>

        {candidates.map((v) => <Reveal key={v.version} i={3}><VersionCard v={v} adopted={adopted} onChanged={load}
          headsUp={{ proposed: data.headsUpToday[v.version], today: data.headsUpToday[adopted.version] }} /></Reveal>)}
        {candidates.length === 0 && <Reveal i={3}><div className="surf surf-pad" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="state-icon" style={{ width: 36, height: 36 }}><Icon name="check" size={16} /></span>
          <div><b style={{ fontWeight: 600 }}>Nothing to decide</b><p className="small muted">The last round tried {data.tried.length} changes. None caught more than v{adopted.version} on orders it had not learned from.</p></div>
        </div></Reveal>}

        <Reveal i={4}>
          <Tabs label="Learning details" value={tab} onChange={setTab} options={[
            { value: "tried", label: "Changes tried", count: data.tried.length },
            { value: "versions", label: "Versions", count: data.versions.length },
            { value: "stress", label: "Stress test", count: data.stress.length },
            { value: "kinds", label: "By kind of problem", count: data.types.length },
            { value: "lessons", label: "Lessons", count: lessons.length },
          ]} />
          <div style={{ paddingTop: 16 }}>
            {tab === "tried" && <ul className="surf list-card">{data.tried.map((t) => <li key={t.change}>
              <span className={`badge ${t.hits.k > adopted.metrics.hits.k ? "badge-ok" : ""}`}>{t.hits.k} of {t.hits.n}</span>
              <span>{t.change}</span>
              <span className="muted small">{t.falseAlarms.k} false {t.falseAlarms.k === 1 ? "alarm" : "alarms"}{t.hits.k <= adopted.metrics.hits.k ? " · no better" : ""}</span>
            </li>)}</ul>}

            {tab === "versions" && <div className="surf" style={{ overflowX: "auto" }}><table className="table">
              <thead><tr><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Caught ahead</th><th scope="col">Median lead</th><th scope="col">False alarms</th><th scope="col">Heads-up today</th><th scope="col"><span className="sr-only">Go back</span></th></tr></thead>
              <tbody>{data.versions.map((v) => <tr key={v.version} className={v.status === "ADOPTED" ? "in-use" : ""}>
                <th scope="row">v{v.version}</th>
                <td>{STATUS[v.status] ?? v.status}</td>
                <td className="num">{v.metrics.hits.k} of {v.metrics.hits.n}</td>
                <td className="num">{v.metrics.medianLeadHours === null ? "–" : `${v.metrics.medianLeadHours} h`}</td>
                <td className="num">{v.metrics.falseAlarms.k} of {v.metrics.falseAlarms.n}</td>
                <td className="num">{data.headsUpToday[v.version]}</td>
                <td>{(v.status === "RETIRED" || v.status === "ROLLED_BACK") && <button type="button" className="btn btn-sm" onClick={() => rollback(v.version)}>Go back to v{v.version}</button>}</td>
              </tr>)}</tbody>
            </table></div>}

            {tab === "stress" && <>
              <p className="small muted" style={{ marginBottom: 10 }}>Quiet orders copied in memory with one failure added. Simulated and never saved as orders.</p>
              <ul className="surf list-card">{data.stress.map((r) => <li key={r.perturbation}>
                <span className={`badge ${r.k === r.n ? "badge-ok" : r.k === 0 ? "badge-danger" : "badge-warn"}`}>{r.k} of {r.n}</span>
                <span>{r.sentence}</span>
                <span className="muted small">{r.k === 0 ? "Not watched yet" : ""}</span>
              </li>)}</ul>
            </>}

            {tab === "kinds" && <ul className="surf list-card">{data.types.map((t) => <li key={t.cause}>
              <span className={`badge ${MATURITY[t.maturity].tone}`}>{MATURITY[t.maturity].text}</span>
              <span>{t.label}</span>
              <span className="muted small">{t.cases} past {t.cases === 1 ? "case" : "cases"}{t.cases < t.minCases ? ` · needs ${t.minCases}` : ""}</span>
            </li>)}</ul>}

            {tab === "lessons" && (lessons.length === 0 ? <p className="muted small">No lessons yet.</p>
              : <ul className="surf list-card">{lessons.map((l) => <li key={`${l.version}-${l.text}`}>
                  <span className="badge">v{l.version}</span>
                  <span>{l.text}</span>
                  <span className="small">{l.caseRefs.map((ref, i) => <span key={ref}>{i ? ", " : ""}<Link className="mono" href={`/case/${ref}`}>{ref}</Link></span>)}</span>
                </li>)}</ul>)}
          </div>
        </Reveal>
      </div>}
    </main>
  </AppFrame>
}
