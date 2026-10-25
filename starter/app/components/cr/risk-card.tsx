"use client"

import Link from "next/link"
import { useState } from "react"
import type { FailureSource } from "@/lib/risk/sources"
import { Collapse, MoreToggle } from "../../ui/kit"
import { Icon } from "../icons"

const KIND_ICON: Record<FailureSource["kind"], string> = { route: "pin", mode: "ferry", make: "car", dealership: "building" }
const LEVEL: Record<string, { text: string; tone: string }> = {
  fine: { text: "On track", tone: "" }, watch: { text: "Watch", tone: "badge-warn" }, likely_to_slip: { text: "Likely to slip", tone: "badge-danger" },
}
const ACTION: Record<FailureSource["kind"], string> = {
  route: "Check travel and ferry options a day early for these orders.",
  mode: "Recheck vehicle space before the driver sets off.",
  make: "Ask the driver to check warning lights and photos at pickup.",
  dealership: "Confirm the car, keys and release papers with the site the day before.",
}
const SEGMENTS = 12

// A failure source at a glance (ADR-009): its honest k of n as a number and a meter, and who depends on it next.
export function RiskCard({ source, levels, cars = {} }: { source: FailureSource; levels: Record<string, string>; cars?: Record<string, string>; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const scale = Math.min(SEGMENTS, source.n)
  const on = Math.round((source.k / Math.max(1, source.n)) * scale)
  return <article className="surf risk-card">
    <header className="risk-top">
      <span className="risk-name"><Icon name={KIND_ICON[source.kind]} size={15} style={{ color: "var(--text-3)" }} />{source.label}</span>
      {source.elevated && <span className="badge badge-accent"><span className="badge-dot" />Look early</span>}
      {source.maturity === "too_few" && <span className="badge">Too few to say</span>}
    </header>
    <div className="ratio" title={source.sentence}><b>{source.k}</b><span>of {source.n} past orders had trouble</span></div>
    <div className="meter" aria-hidden="true">{Array.from({ length: scale }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}</div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span className="small" style={{ color: "var(--text-2)" }}><b className="num" style={{ color: "var(--text)" }}>{source.upcoming.orders}</b> upcoming {source.upcoming.orders === 1 ? "order" : "orders"}</span>
      {source.upcoming.orders > 0 && <MoreToggle open={open} onToggle={() => setOpen(!open)}>Details</MoreToggle>}
    </div>
    <Collapse open={open}>
      <div style={{ display: "grid", gap: 10, paddingTop: 4 }}>
        <p className="small" style={{ color: "var(--text-2)" }}>{source.sentence}</p>
        {source.k > 0 && <p className="small" style={{ color: "var(--accent-text)", fontWeight: 500 }}>{ACTION[source.kind]}</p>}
        <ul className="risk-orders">{source.upcoming.refs.map((ref) => {
          const level = LEVEL[levels[ref] ?? "fine"]
          return <li key={ref}>
            <span><Link href={`/case/${ref}`} className="mono" style={{ color: "var(--text)" }}>{ref}</Link> <span className="muted">{cars[ref] ?? ""}</span></span>
            <span className={`badge ${level.tone}`}>{level.text}</span>
          </li>
        })}</ul>
      </div>
    </Collapse>
  </article>
}
