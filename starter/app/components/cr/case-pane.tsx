"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import type { CaseView } from "@/lib/control/case"
import type { Route } from "@/lib/geo/types"
import { CarThumb, Collapse, MoreToggle, Reveal, Tabs } from "../../ui/kit"
import { Icon } from "../icons"
import { AskAgent } from "./ask-agent"
import { DecisionCard } from "./decision-card"
import { EvidenceChip } from "./evidence-chip"
import { RouteStrip } from "./route-strip"
import { Thread } from "./thread"
import { TravelMap } from "./travel-map"

type View = CaseView & { geo: Route | null; watch: { level: string; signals: string[] } }
type Tab = "activity" | "route" | "facts" | "order"

// One case, readable in seconds (ADR-013, ADR-016): who and what, the one decision, then details on demand.
export function CasePane({ reference, full = false, onChanged }: { reference: string; full?: boolean; onChanged?: () => void }) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("activity")
  const [workOpen, setWorkOpen] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/case/${encodeURIComponent(reference)}`)
      .then((r) => { if (!r.ok) throw new Error(r.status === 404 ? "This order is not in the snapshot." : "The case could not be loaded."); return r.json() })
      .then((data: View) => { setView(data); setError("") })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The case could not be loaded."))
  }, [reference])

  useEffect(() => { setView(null); load() }, [load])
  const changed = useCallback(() => { load(); onChanged?.() }, [load, onChanged])

  if (error) return <div className="state" role="alert"><p>{error}</p><button type="button" className="btn btn-sm" onClick={load}>Try again</button></div>
  if (!view) return <div className="case" aria-busy="true" aria-label="Loading the case">
    <div className="sk" style={{ height: 96 }} /><div className="sk" style={{ height: 220, borderRadius: 16 }} /><div className="sk" style={{ height: 160 }} />
  </div>

  const slip = view.watch.level === "likely_to_slip"
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "activity", label: "Activity", count: view.thread.length },
    ...(view.geo ? [{ value: "route" as const, label: "Route" }] : []),
    { value: "facts", label: "Facts", count: view.facts.length },
    { value: "order", label: "Order" },
  ]

  return <article className={`case${full ? " case-full" : ""}`} aria-label={`Case ${view.reference}`}>
    <Reveal>
      <header className="hero">
        <div>
          <div className="hero-meta">
            <span className="mono">{view.reference}</span><span className="sep" />
            <span>{view.route}</span><span className="sep" />
            <span>{view.driver}</span>
          </div>
          <h1>{view.headline}</h1>
          <div className="hero-chips">
            {view.watch.level !== "fine" && <span className={`badge ${slip ? "badge-danger" : "badge-warn"}`} title={view.watch.signals.join(" ")}>
              <span className="badge-dot" />{slip ? "Likely to slip" : "On watch"}
            </span>}
            <span className="badge">{view.car}</span>
            {!full && <Link href={`/case/${view.reference}`} className="badge" style={{ textDecoration: "none" }}>Open full <kbd>↵</kbd></Link>}
          </div>
        </div>
        <CarThumb car={view.car} />
      </header>
    </Reveal>

    {view.decision && <Reveal i={1}><DecisionCard key={view.decision.id} card={view.decision} route={view.decision.action === "propose_booking" ? view.geo : null} active onChanged={changed} /></Reveal>}

    {view.agentWork.length > 0 && <Reveal i={2}>
      <section aria-label="Open work from Bahn's own agents">
        <MoreToggle open={workOpen} onToggle={() => setWorkOpen(!workOpen)}>
          {view.agentWork.length} open {view.agentWork.length === 1 ? "item" : "items"} from Bahn&apos;s other agents
        </MoreToggle>
        <Collapse open={workOpen}>
          <ul className="open-work" style={{ marginTop: 10 }}>{view.agentWork.map((w, i) => <li key={i} className="ow" title={`${w.text}${w.detail ? ` ${w.detail}` : ""}`}>
            <span className={`badge ${w.status === "Failed" ? "badge-danger" : "badge-info"}`}>{w.status}</span>
            <span>{w.text}</span>
          </li>)}</ul>
        </Collapse>
      </section>
    </Reveal>}

    <Reveal i={3}>
      <Tabs label="Case details" value={tab} onChange={setTab} options={tabs} />
      <div style={{ paddingTop: 16 }}>
        {tab === "activity" && <div style={{ display: "grid", gap: 16 }}>
          <AskAgent reference={view.reference} onAnswered={changed} />
          <Thread items={view.thread} />
          {view.chain.length > 0 && <section>
            <h2 className="h-section">Next steps</h2>
            <ol className="open-work">{view.chain.map((c) => <li key={c.seq} className="ow">
              <Icon name={c.status === "done" ? "check" : "clock"} size={14} style={{ color: c.status === "done" ? "var(--ok)" : "var(--text-3)" }} />
              <span>{c.label}</span>
            </li>)}</ol>
          </section>}
          {view.history.length > 0 && <section style={{ display: "grid", gap: 10 }}>
            <h2 className="h-section">Other decisions on this order</h2>
            {view.history.map((d) => <DecisionCard key={d.id} card={d} active={false} onChanged={changed} />)}
          </section>}
        </div>}

        {tab === "route" && view.geo && <div>
          <RouteStrip route={view.geo} />
          <TravelMap route={view.geo} />
        </div>}

        {tab === "facts" && <dl className="facts-list">{view.facts.map((f, i) => <div key={i}>
          <dt>{f.label}</dt><dd>{f.value}</dd><dd><EvidenceChip evidence={f.evidence} /></dd>
        </div>)}</dl>}

        {tab === "order" && <div style={{ display: "grid", gap: 12 }}>
          <dl className="facts-list">{view.properties.map((p) => <div key={p.label}><dt>{p.label}</dt><dd style={{ gridColumn: "span 2" }}>{p.value}</dd></div>)}</dl>
          <Link href={`/orders/${encodeURIComponent(view.orderId)}`} className="link">Everything on this order<Icon name="arrow" size={12} /></Link>
        </div>}
      </div>
    </Reveal>
  </article>
}
