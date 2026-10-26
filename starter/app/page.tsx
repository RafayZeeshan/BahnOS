"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import type { QueueItem, QuietItem } from "@/lib/control/queue"
import type { HeadsUpCard } from "@/lib/watch/sweep"
import { AppFrame } from "./components/app-frame"
import { BackOnTheTable } from "./components/cr/back-on-table"
import { CasePane } from "./components/cr/case-pane"
import { PulseCard } from "./components/cr/pulse-card"
import { QueueRow } from "./components/cr/queue-row"
import { useKeys } from "./components/cr/use-keys"
import { Icon } from "./components/icons"
import { Collapse, Reveal, Segmented } from "./ui/kit"

type Today = { snapshotAt: string | null; needsYou: QueueItem[]; quiet: QuietItem[]; recorded: boolean; agentRuns: number; headsUp: { total: number; alsoNeedsYou: number } }
type Tab = "needs-you" | "heads-up" | "all"

const SEEN_KEY = "cr.seen.v1"
const seenKey = (item: QueueItem) => `${item.reference}|${item.why}`

function readSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]) } catch { return new Set() }
}

function TodayPage() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = (params.get("tab") as Tab) || "needs-you"
  const [data, setData] = useState<Today | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [quietOpen, setQuietOpen] = useState(false)
  const [headsUp, setHeadsUp] = useState<HeadsUpCard[] | null>(null)

  const load = useCallback(() => {
    fetch("/api/today").then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d: Today) => { setData(d); setError("") })
      .catch(() => setError("Today's queue could not be loaded."))
    fetch("/api/agent/watch").then((r) => r.json()).then((d: { cards: HeadsUpCard[] }) => setHeadsUp(d.cards)).catch(() => setHeadsUp([]))
  }, [])
  useEffect(() => { load(); setSeen(readSeen()) }, [load])

  const rows = useMemo(() => (tab === "heads-up" ? [] : data?.needsYou ?? []), [data, tab])
  const order = useMemo(() => (tab === "heads-up" ? (headsUp ?? []).map((c) => c.order) : rows.map((r) => r.reference)), [tab, headsUp, rows])
  useEffect(() => { if (!selected && order.length) setSelected(order[0]) }, [order, selected])

  const select = useCallback((reference: string) => {
    // On a phone there is no side pane, so a tap opens the case page.
    if (window.matchMedia("(max-width: 900px)").matches) return router.push(`/case/${reference}`)
    setSelected(reference)
    const item = rows.find((r) => r.reference === reference)
    if (!item) return
    setSeen((prev) => {
      const next = new Set(prev).add(seenKey(item))
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next])) } catch { /* private mode: dots just stay */ }
      return next
    })
  }, [rows, router])

  const move = (step: number) => {
    if (!order.length) return
    const index = Math.max(0, order.indexOf(selected ?? ""))
    const next = order[Math.min(order.length - 1, Math.max(0, index + step))]
    select(next)
    document.getElementById(`row-${next}`)?.scrollIntoView({ block: "nearest" })
  }
  useKeys({
    j: () => move(1), ArrowDown: () => move(1), k: () => move(-1), ArrowUp: () => move(-1),
    Enter: () => { if (selected) router.push(`/case/${selected}`) },
  })

  const setTab = (next: Tab) => { setSelected(null); router.replace(next === "needs-you" ? "/" : `/?tab=${next}`) }
  const needsYou = data?.needsYou.length ?? 0

  return <AppFrame section={tab === "heads-up" ? "heads-up" : "today"} snapshotAt={data?.snapshotAt} board counts={{ today: data?.needsYou.length, "heads-up": headsUp?.length }}>
    <main className="today">
      <header className="today-top">
        <div className="today-title">
          <h1>Today</h1>
          {data?.recorded && <span className="badge" title="BahnBot runs here were recorded live earlier and replayed, so no API key is needed."><Icon name="sparkle" size={12} />Recorded BahnBot runs</span>}
        </div>
        <div className="today-stats" aria-label="Summary">
          <span className="stat stat-accent"><b>{data ? needsYou : "–"}</b>need you</span>
          <span className="stat"><b>{headsUp ? headsUp.length : "–"}</b>heads-up</span>
          <span className="stat"><b>{data ? data.quiet.length : "–"}</b>on track</span>
        </div>
      </header>

      <div className="split">
        <section className="list-col" aria-label="Orders">
          <div className="list-tools">
            <Segmented label="Queue" value={tab} onChange={setTab} options={[
              { value: "needs-you", label: "Needs you", count: data?.needsYou.length },
              { value: "heads-up", label: "Heads-up", count: headsUp?.length },
              { value: "all", label: "All", count: data ? data.needsYou.length + data.quiet.length : undefined },
            ]} />
          </div>
          <div className="list-scroll">
            {error && <div className="state" role="alert"><p>{error}</p><button type="button" className="btn btn-sm" onClick={load}>Try again</button></div>}
            {!data && !error && <div aria-busy="true" style={{ display: "grid", gap: 1, borderTop: "2px solid var(--rule)" }}>{Array.from({ length: 8 }, (_, i) => <div key={i} className="sk" style={{ height: 62 }} />)}</div>}

            {data && tab !== "heads-up" && (rows.length === 0
              ? <div className="state"><span className="state-icon"><Icon name="check" size={18} /></span><b>Nothing needs you</b>{data.quiet.length} orders are on track.</div>
              : <><div className="tt-head" aria-hidden="true"><span>Order</span><span>Car and reason</span><span>Leg and next move</span><span>Due</span></div>
              <div role="list">{rows.map((item, i) => <Reveal key={item.reference} i={i} role="listitem" id={`row-${item.reference}`}>
                  <QueueRow item={item} selected={item.reference === selected} isNew={tab === "needs-you" && !seen.has(seenKey(item))} onSelect={() => select(item.reference)} />
                </Reveal>)}</div></>)}

            {tab === "heads-up" && headsUp && (headsUp.length === 0
              ? <div className="state"><span className="state-icon"><Icon name="check" size={18} /></span><b>No heads-up</b>Watch warns here before a trip runs into trouble.</div>
              : <div className="hu-grid">{headsUp.map((card, i) => <Reveal key={card.order} i={i} id={`row-${card.order}`}>
                  <PulseCard card={card} selected={card.order === selected} onOpen={() => select(card.order)} alsoNeedsYou={!!data?.needsYou.some((q) => q.reference === card.order)} />
                </Reveal>)}</div>)}

            {tab === "needs-you" && <BackOnTheTable onOpen={select} />}

            {data && tab !== "heads-up" && <div className="fold">
              <button type="button" className="fold-btn" aria-expanded={quietOpen || tab === "all"} onClick={() => setQuietOpen(!quietOpen)}>
                <Icon name="check" size={14} />{data.quiet.length} on track, nothing waiting
                <Icon name="chevron" size={12} className="chev" style={{ marginLeft: "auto", transform: quietOpen || tab === "all" ? "rotate(90deg)" : undefined, transition: "transform .2s" }} />
              </button>
              <Collapse open={quietOpen || tab === "all"}>
                <ul>{data.quiet.map((q) => <li key={q.reference}>
                  <button type="button" className="quiet-row" onClick={() => select(q.reference)}>
                    <span>{q.car} <span className="qi-ref">{q.reference}</span></span><span className="muted">{q.status}</span>
                  </button>
                </li>)}</ul>
              </Collapse>
            </div>}
          </div>
        </section>

        <section className="pane-col" aria-label="Selected case">
          {selected
            ? <Reveal key={selected}><CasePane reference={selected} onChanged={load} /></Reveal>
            : <div className="state"><b>Pick an order</b>Its case opens here.</div>}
        </section>
      </div>
    </main>
  </AppFrame>
}

export default function Page() {
  return <Suspense><TodayPage /></Suspense>
}
