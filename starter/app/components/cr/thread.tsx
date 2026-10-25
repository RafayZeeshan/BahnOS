"use client"

import { useState } from "react"
import type { ThreadItem } from "@/lib/control/case"
import { dayKey, fmtClock, fmtDayHeading } from "@/lib/present/time"
import { Collapse, MoreToggle } from "../../ui/kit"
import { Icon } from "../icons"
import { CallItem } from "./call-item"
import { EvidenceChip } from "./evidence-chip"

const ACTOR_ICON: Record<ThreadItem["actor"], string> = {
  driver: "driver", customer: "people", site: "building", ops: "message", agent: "sparkle", system: "alert",
}
const ACTOR_WORD: Record<ThreadItem["actor"], string> = {
  driver: "Driver", customer: "Customer", site: "Site", ops: "Ops", agent: "BahnBot", system: "System",
}
const RECENT = 4

function Item({ item }: { item: ThreadItem }) {
  const [full, setFull] = useState(false)
  const [steps, setSteps] = useState(false)
  const long = item.text.length > 220
  const unique = [...new Set(item.steps ?? [])]
  return <li className={`tl-item tl-${item.actor}`}>
    <span className="tl-av"><Icon name={ACTOR_ICON[item.actor]} size={13} /></span>
    <div style={{ minWidth: 0 }}>
      <div className="tl-head">
        <b>{item.actor === "system" && item.who === "Alert" ? ACTOR_WORD[item.actor] : item.who}</b>
        {item.who !== ACTOR_WORD[item.actor] && item.actor !== "agent" && item.actor !== "system" && <span className="muted">{ACTOR_WORD[item.actor]}</span>}
        <time className="num" dateTime={item.at}>{fmtClock(item.at)}</time>
        {(item.actor !== "agent" || item.who !== "BahnBot") && !item.call && <EvidenceChip evidence={item.evidence} />}
      </div>
      <p className={`tl-text${long && !full ? " tl-clamp" : ""}`}>{item.text}</p>
      {long && <button type="button" className="link" style={{ marginTop: 4 }} onClick={() => setFull(!full)}>{full ? "Less" : "More"}</button>}
      {unique.length > 0 && <div style={{ marginTop: 6 }}>
        <MoreToggle open={steps} onToggle={() => setSteps(!steps)}>{unique.length} {unique.length === 1 ? "step" : "steps"} BahnBot took</MoreToggle>
        <Collapse open={steps}><ol style={{ display: "grid", gap: 4, padding: "8px 0 0 16px", listStyle: "decimal", fontSize: 12.5, color: "var(--text-2)" }}>
          {(item.steps ?? []).map((s, i) => <li key={i}>{s}</li>)}
        </ol></Collapse>
      </div>}
      {item.call && <CallItem call={item.call} />}
    </div>
  </li>
}

// Who said what and when, newest few first in view; the rest folds away.
export function Thread({ items }: { items: ThreadItem[] }) {
  const [all, setAll] = useState(false)
  if (!items.length) return <p className="muted small">No messages on this order yet.</p>
  const shown = all ? items : items.slice(-RECENT)
  let lastDay = ""
  return <div>
    {items.length > RECENT && <div className="tl-more" style={{ paddingTop: 0, paddingBottom: 4 }}>
      <button type="button" className="link" onClick={() => setAll(!all)}>{all ? "Show only the latest" : `Show ${items.length - RECENT} earlier`}</button>
    </div>}
    <ol className="tl">{shown.map((item, i) => {
      const day = dayKey(item.at)
      const divider = day !== lastDay ? <li className="tl-day" key={`d-${i}`}>{fmtDayHeading(item.at)}</li> : null
      lastDay = day
      return [divider, <Item key={i} item={item} />]
    })}</ol>
  </div>
}
