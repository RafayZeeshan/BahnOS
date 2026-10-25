"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Icon } from "../icons"

type Reopen = { id: string; orderRef: string; blocker: string; clearedBy: { fact: string; source: string } }

// A fix that was blocked earlier can go ahead now; a person decides whether to pick it up again.
export function BackOnTheTable({ onOpen }: { onOpen: (reference: string) => void }) {
  const [items, setItems] = useState<Reopen[]>([])
  const load = useCallback(() => {
    fetch("/api/incoming").then((r) => r.json()).then((d: { reopened: Reopen[] }) => setItems(d.reopened)).catch(() => setItems([]))
  }, [])
  useEffect(load, [load])
  if (!items.length) return null

  async function done(id: string) {
    await fetch("/api/incoming", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "close", id }) })
    load()
  }

  return <section aria-labelledby="back-h" style={{ display: "grid", gap: 8, margin: "16px 2px 0" }}>
    <h2 id="back-h" className="h-section" style={{ margin: "0 8px" }}>Back on the table</h2>
    {items.map((r) => <article key={r.id} className="hu" title={`Held back earlier because: ${r.blocker}`}>
      <span className="hu-top"><span className="hu-name">{r.orderRef}</span><span className="badge badge-ok"><Icon name="check" size={12} />Blocker cleared</span></span>
      <span className="hu-line">{r.clearedBy.fact}</span>
      <span className="hu-foot">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpen(r.orderRef)}>Open the case</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => done(r.id)}>Dealt with</button>
      </span>
    </article>)}
  </section>
}
