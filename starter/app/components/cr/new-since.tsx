"use client"

import { useCallback, useEffect, useState } from "react"

type Fact = { id: string; orderRef: string; text: string; source: string }
type NewSince = { facts: Fact[]; queued: number; staleSources: number; remaining: number }

// New data lands here: what arrived, which records went stale, and a learning run waiting to be started.
export function NewSinceBar({ version, onLearned }: { version: number; onLearned: () => void }) {
  const [data, setData] = useState<NewSince | null>(null)
  const [busy, setBusy] = useState<"play" | "run" | null>(null)
  const load = useCallback(() => { fetch("/api/incoming").then((r) => r.json()).then(setData).catch(() => setData(null)) }, [])
  useEffect(load, [load])

  async function play() {
    setBusy("play")
    await fetch("/api/incoming", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
    setBusy(null); load()
  }
  async function run() {
    setBusy("run")
    await fetch("/api/dream", { method: "POST" })
    setBusy(null); load(); onLearned()
  }

  if (!data) return null
  return <section className="surf surf-pad" aria-labelledby="new-since-h" style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <h2 id="new-since-h" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", marginRight: "auto" }}>New since v{version}</h2>
      {data.facts.length > 0 && <span className="badge badge-info">{data.facts.length} new {data.facts.length === 1 ? "fact" : "facts"}</span>}
      {data.staleSources > 0 && <span className="badge badge-warn">{data.staleSources} records out of date</span>}
    </div>
    {data.facts.length === 0 ? <p className="small muted">Nothing new since the last learning round.</p>
      : <ul style={{ display: "grid", gap: 6 }}>{data.facts.map((f) => <li key={f.id} className="small" style={{ color: "var(--text-2)" }}><span className="mono" style={{ color: "var(--text)" }}>{f.orderRef}</span> {f.text} <span className="muted">· {f.source}</span></li>)}</ul>}
    {(data.queued > 0 || data.remaining > 0) && <div className="dec-actions">
      {data.queued > 0 && <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={run}>{busy === "run" ? "Learning…" : "Run the queued learning round"}</button>}
      {data.remaining > 0 && <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={play}>{busy === "play" ? "Arriving…" : "Play the next recorded follow-up"}</button>}
    </div>}
  </section>
}
