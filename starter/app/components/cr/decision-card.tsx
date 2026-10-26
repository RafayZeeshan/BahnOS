"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { CaseView, DecisionCard as Card } from "@/lib/control/case"
import type { Route } from "@/lib/geo/types"
import { fmtMoney } from "@/lib/present/time"
import { AnimatePresence, Collapse, MoreToggle, motion, Ring } from "../../ui/kit"
import { Icon } from "../icons"
import { DriverPreview } from "./driver-preview"
import { EvidenceChip } from "./evidence-chip"
import { useKeys } from "./use-keys"

type Response = "go_ahead" | "change_it" | "take_over" | "not_this" | "snooze"

const BUTTONS: { response: Response; label: string; key: string }[] = [
  { response: "go_ahead", label: "Go ahead", key: "1" },
  { response: "change_it", label: "Change it", key: "2" },
  { response: "take_over", label: "Take over", key: "3" },
  { response: "not_this", label: "Not this", key: "4" },
]
const EFFECT_WORD: Record<string, string> = { go_ahead: "Go ahead", change_it: "Change it", take_over: "Take over", not_this: "Not this" }

const STATUS: Record<string, { text: string; tone: string }> = {
  APPROVED: { text: "Approved, starting", tone: "badge-info" }, EXECUTING: { text: "Running", tone: "badge-info" },
  EXECUTED: { text: "Done", tone: "badge-ok" }, FAILED: { text: "Did not go through", tone: "badge-danger" },
  DECLINED: { text: "Set aside", tone: "" }, TAKEN_OVER: { text: "Taken over", tone: "" }, SNOOZED: { text: "Snoozed", tone: "badge-warn" },
}
const UNDO_SECONDS = 5

async function post(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/decisions/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return (await response.json()) as { ok: boolean; error?: string; status?: string }
}

const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim()

// The one decision on a case (ADR-006): what changes, what it costs, four responses. The reasoning folds away.
export function DecisionCard({ card, active, onChanged, route = null, facts = [] }: { card: Card; active: boolean; onChanged: () => void; route?: Route | null; facts?: CaseView["facts"] }) {
  const [asking, setAsking] = useState<Response | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState(false)
  const [undoLeft, setUndoLeft] = useState<number | null>(null)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const escalation = card.action === "escalate"
  const buttons = BUTTONS.filter((b) => !escalation || b.response === "take_over" || b.response === "not_this")
  const open = card.status === "PROPOSED" || card.status === "SNOOZED"

  useEffect(() => { if (asking) reasonRef.current?.focus() }, [asking])

  // Opened while an approval is pending (after a reload, or when the view refreshed): run it once the undo window has passed.
  useEffect(() => {
    if (card.status !== "APPROVED" || undoLeft !== null) return
    const wait = card.undoUntil ? Math.max(800, Date.parse(card.undoUntil) - Date.now() + 300) : 1500 // clock-ok: the undo window is real time
    const timer = setTimeout(() => void post(card.id, { op: "execute" }).then(onChanged), wait)
    return () => clearTimeout(timer)
  }, [card.status, card.id, card.undoUntil, undoLeft, onChanged])

  // After Go ahead: a short undo, then the executor runs.
  useEffect(() => {
    if (undoLeft === null) return
    if (undoLeft <= 0) {
      setUndoLeft(null)
      void post(card.id, { op: "execute" }).then(onChanged)
      return
    }
    const timer = setTimeout(() => setUndoLeft(undoLeft - 1), 1000)
    return () => clearTimeout(timer)
  }, [undoLeft, card.id, onChanged])

  async function send(response: Response, text?: string) {
    setBusy(true)
    setError("")
    const result = await post(card.id, { response, reason: text })
    setBusy(false)
    if (!result.ok) return setError(result.error ?? "That did not go through. Try again.")
    setAsking(null)
    setReason("")
    if (result.status === "APPROVED") setUndoLeft(UNDO_SECONDS)
    onChanged()
  }

  function choose(response: Response) {
    if (!open || busy) return
    if (response === "go_ahead" || response === "snooze") return void send(response)
    setAsking(response)
  }

  async function undo() {
    // Stop the countdown first, so this tab never sends "execute" after asking to undo.
    setUndoLeft(null)
    const result = await post(card.id, { op: "undo" })
    if (!result.ok) setError(result.error ?? "Too late to undo.")
    onChanged()
  }

  useKeys(active && open && !asking ? {
    ...Object.fromEntries(buttons.map((b) => [b.key, () => choose(b.response)])),
    h: () => choose("snooze"),
  } : {})

  // Short change lines become tiles; long ones (a drafted message, what the agent knows) stay in the details.
  const known = card.change.filter((c) => c.startsWith("Known: ")).map((c) => c.slice(7))
  const unknown = card.change.filter((c) => c.startsWith("Not known: ")).map((c) => c.slice(11))
  const plain = card.change.filter((c) => !c.startsWith("Known: ") && !c.startsWith("Not known: "))
  const tiles = plain.filter((c) => c.length <= 90).slice(0, 2)
  const longLines = plain.filter((c) => !tiles.includes(c))
  const status = STATUS[card.status]

  return <section className={`surf dec${open ? "" : " decided"}`} aria-labelledby={`dcard-${card.id}`}>
    <h2 id={`dcard-${card.id}`} className="dec-title">{card.headline}</h2>
    <div className="dec-kicker">
      <span className="agent-tag"><span className="agent-orb"><Icon name="sparkle" size={11} /></span>{escalation ? "Handed to you" : open ? "BahnBot proposes" : "BahnBot proposed"}</span>
      {!open && status && <span className={`badge ${status.tone}`}><span className="badge-dot" />{status.text}</span>}
    </div>

    {(tiles.length > 0 || card.cost || !escalation) && <dl className="facts-row">
      {tiles.map((t, i) => <div key={t} className="fact-tile"><dt>{i === 0 ? "Change" : "Details"}</dt><dd>{t}</dd></div>)}
      {card.cost && <div className="fact-tile"><dt>Cost</dt><dd className="num">{fmtMoney(card.cost.cents, card.cost.currency)}<small>{card.cost.note}</small></dd></div>}
      <div className="fact-tile"><dt>Who gets told</dt><dd>{firstSentence(card.whoIsTold)}</dd></div>
      {active && card.evidence.length > 0 && <div className="fact-tile"><dt>Based on</dt><dd className="ev-list">{card.evidence.slice(0, 3).map((e, i) => <EvidenceChip key={i} evidence={e} />)}</dd></div>}
    </dl>}
    {/* A handed-over case has no change to show, so its first facts take the rows, each with its source. */}
    {escalation && active && facts.length > 0 && <dl className="facts-row">
      {facts.slice(0, 4).map((f, i) => <div key={i} className="fact-tile"><dt>{f.label}</dt><dd>{f.value}</dd><dd className="fact-src"><EvidenceChip evidence={f.evidence} /></dd></div>)}
    </dl>}
    {escalation && known.length > 0 && <p style={{ margin: "12px 0 14px", fontSize: 13, color: "var(--text-2)" }}>
      BahnBot gathered {known.length} {known.length === 1 ? "fact" : "facts"}{unknown.length ? ` and ${unknown.length} open ${unknown.length === 1 ? "question" : "questions"}` : ""}. A person needs to decide.
    </p>}

    {card.blockers.length > 0 && <p className="blocker" style={{ marginBottom: 14 }}><Icon name="alert" size={14} />{card.blockers.join(" ")}</p>}

    {open && !asking && <div className="dec-actions" role="group" aria-label="Your decision">
      {buttons.map((b, i) => <button key={b.response} type="button" className={`btn${i === 0 ? " btn-primary" : ""}`} disabled={busy} onClick={() => choose(b.response)}>
        {b.label}<kbd>{b.key}</kbd>
      </button>)}
      <span className="spacer" />
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => choose("snooze")}>Snooze<kbd>H</kbd></button>
    </div>}

    <AnimatePresence>
      {asking && <motion.form key="reason" className="reason" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        onSubmit={(e) => { e.preventDefault(); if (reason.trim()) void send(asking, reason) }}>
        <label htmlFor={`why-${card.id}`}>{EFFECT_WORD[asking]}: what should BahnBot know?</label>
        <textarea id={`why-${card.id}`} className="field" ref={reasonRef} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setAsking(null) }} placeholder="One line is enough. BahnBot learns from it." />
        <p className="muted small">{card.effects[asking as keyof typeof card.effects]}</p>
        <div className="dec-actions">
          <button type="submit" className="btn btn-primary" disabled={!reason.trim() || busy}>Confirm</button>
          <button type="button" className="btn btn-ghost" onClick={() => setAsking(null)}>Cancel</button>
        </div>
      </motion.form>}
    </AnimatePresence>

    {card.outcome && <p className="outcome"><Icon name="check" size={14} style={{ marginTop: 3, color: "var(--ok)" }} /><span>
      {card.outcome.effect ?? `${card.outcome.by ?? "Ops"} chose ${card.outcome.response?.replace("_", " ")}.`}
      {card.outcome.reason && <span className="muted"> “{card.outcome.reason}”</span>}
    </span></p>}
    {error && <p className="err" role="alert">{error}</p>}

    <div style={{ marginTop: 14 }}>
      <MoreToggle open={why} onToggle={() => setWhy(!why)}>{why ? "Hide the details" : "Why, and what happens next"}</MoreToggle>
    </div>
    <Collapse open={why}>
      <div className="dec-why">
        {card.detail && <p>{card.detail}</p>}
        {longLines.map((l) => <p key={l} style={{ padding: "10px 12px", background: "var(--surface-2)" }}>{l}</p>)}
        {known.length > 0 && <div><h3 className="h-section">What BahnBot knows</h3><ul style={{ display: "grid", gap: 6 }}>{known.map((k) => <li key={k} style={{ display: "flex", gap: 8 }}><Icon name="check" size={13} style={{ marginTop: 3, color: "var(--ok)" }} />{k}</li>)}</ul></div>}
        {unknown.length > 0 && <div><h3 className="h-section">Still unknown</h3><ul style={{ display: "grid", gap: 6 }}>{unknown.map((k) => <li key={k} style={{ display: "flex", gap: 8 }}><Icon name="note" size={13} style={{ marginTop: 3, color: "var(--warn)" }} />{k}</li>)}</ul></div>}
        {card.evidence.length > 0 && <div><h3 className="h-section">Based on</h3><div className="ev-list">{card.evidence.slice(0, 6).map((e, i) => <EvidenceChip key={i} evidence={e} />)}</div></div>}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <h3 className="h-section">What each response does</h3>
            <dl className="effects">{Object.entries(card.effects).filter(([k]) => !escalation || k === "take_over" || k === "not_this").map(([k, v]) => <div key={k}><dt>{EFFECT_WORD[k] ?? k}</dt><dd>{v}</dd></div>)}</dl>
            <p className="muted small" style={{ marginTop: 10 }}>{card.whoIsTold}</p>
          </div>
          {route && <DriverPreview route={route} />}
        </div>
      </div>
    </Collapse>

    {typeof document !== "undefined" && createPortal(<AnimatePresence>
      {undoLeft !== null && <motion.div key="toast" className="toast" role="status" style={{ x: "-50%" }}
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}>
        <Ring seconds={undoLeft} total={UNDO_SECONDS} />Approved. Starting in {undoLeft} s
        <button type="button" className="btn btn-sm" onClick={undo}>Undo</button>
      </motion.div>}
    </AnimatePresence>, document.body)}
  </section>
}
