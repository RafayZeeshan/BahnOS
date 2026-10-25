"use client"

import Link from "next/link"
import { useState } from "react"

export type VersionView = {
  version: number; status: string; changes: string[]; adoptedBy: string | null; overrideReason: string | null
  metrics: { hits: { k: number; n: number }; falseAlarms: { k: number; n: number }; medianLeadHours: number | null; label: string }
  lessons: { text: string; caseRefs: string[]; shared?: string | null }[]
}

const score = (m: VersionView["metrics"]) => m.hits.k / Math.max(1, m.hits.n) - m.falseAlarms.k / Math.max(1, m.falseAlarms.n)

// A candidate policy, decided like any other decision: adopt it, or say why not.
export function VersionCard({ v, adopted, onChanged, headsUp }: { v: VersionView; adopted: VersionView; onChanged: () => void; headsUp?: { proposed: number; today: number } }) {
  const [asking, setAsking] = useState<"reject" | "override" | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const worse = score(v.metrics) < score(adopted.metrics)

  async function send(op: "adopt" | "reject" | "rollback", extra: Record<string, string> = {}) {
    const response = await fetch(`/api/policy/${v.version}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, ...extra }) })
    const result = (await response.json()) as { ok: boolean; error?: string }
    if (!result.ok) return setError(result.error ?? "That did not go through.")
    setAsking(null); setText(""); setError(""); onChanged()
  }

  return <section className="surf dec" aria-labelledby={`v-${v.version}`}>
    <div className="dec-kicker">
      <span className="agent-tag"><span className="agent-orb">✦</span>Proposed change to Heads-up</span>
      {worse && <span className="badge badge-danger">Scores worse</span>}
    </div>
    <h2 id={`v-${v.version}`} className="dec-title">{v.lessons[0]?.text ?? "A change to how Watch decides what to flag."}</h2>
    <ul style={{ display: "grid", gap: 4, margin: "10px 0", fontSize: 13, color: "var(--text-2)" }}>{v.changes.map((c) => <li key={c}>{c}</li>)}</ul>
    {headsUp && <p className="small" style={{ color: "var(--text-2)" }}><b>For your shift:</b> Heads-up would show {headsUp.proposed} orders today instead of {headsUp.today}{v.metrics.medianLeadHours !== null && adopted.metrics.medianLeadHours !== null ? `, and warn about ${v.metrics.medianLeadHours} hours ahead instead of ${adopted.metrics.medianLeadHours}` : ""}.</p>}
    <dl className="facts-row">
      <div className="fact-tile"><dt>Caught ahead</dt><dd className="num">{v.metrics.hits.k} of {v.metrics.hits.n} past problems <span className="muted">(in use today: {adopted.metrics.hits.k} of {adopted.metrics.hits.n})</span></dd></div>
      <div className="fact-tile"><dt>Lead time</dt><dd className="num">{v.metrics.medianLeadHours === null ? "none" : `${v.metrics.medianLeadHours} h median`} <span className="muted">(in use today: {adopted.metrics.medianLeadHours === null ? "none" : `${adopted.metrics.medianLeadHours} h`})</span></dd></div>
      <div className="fact-tile"><dt>False alarms</dt><dd className="num">{v.metrics.falseAlarms.k} of {v.metrics.falseAlarms.n} quiet orders <span className="muted">(in use today: {adopted.metrics.falseAlarms.k} of {adopted.metrics.falseAlarms.n})</span></dd></div>
      <div className="fact-tile"><dt>How we know</dt><dd>Tried on past orders it had not learned from. Few orders, so treat it as a hint.</dd></div>
      {v.lessons[0]?.caseRefs.length ? <div className="fact-tile"><dt>Cases</dt><dd>{v.lessons[0].caseRefs.map((ref, i) => <span key={ref}>{i ? ", and " : ""}<Link className="mono" href={`/case/${ref}`}>{ref}</Link>{i === 0 ? " would have been flagged ahead" : `, also ${v.lessons[0].shared ?? "similar"}, had no problem and stayed quiet`}</span>)}</dd></div> : null}
    </dl>
    {!asking && <div className="dec-actions">
      <button type="button" className="btn btn-primary" onClick={() => (worse ? setAsking("override") : void send("adopt"))}>Go ahead: use this from now on</button>
      <button type="button" className="btn" onClick={() => setAsking("reject")}>Not this</button>
    </div>}
    {asking && <form className="reason" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(asking === "reject" ? "reject" : "adopt", asking === "reject" ? { reason: text } : { override: text }) }}>
      <label htmlFor={`why-v${v.version}`}>{asking === "reject" ? "Why not? The next round learns from it." : "This version scores worse than the one in use. Why adopt it anyway?"}</label>
      <textarea id={`why-v${v.version}`} className="field" rows={2} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <div className="dec-actions"><button type="submit" className="btn btn-primary" disabled={!text.trim()}>Confirm</button><button type="button" className="btn btn-ghost" onClick={() => setAsking(null)}>Cancel</button></div>
    </form>}
    {error && <p className="err" role="alert">{error}</p>}
  </section>
}
