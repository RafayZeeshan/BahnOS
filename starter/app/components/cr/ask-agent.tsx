"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "../../ui/kit"
import { Icon } from "../icons"

const SUGGESTIONS = ["What is still unconfirmed?", "What does the driver know?", "What happens if we wait?"]

// "Ask BahnBot": the answer lands in the activity below like any other message.
export function AskAgent({ reference, onAnswered }: { reference: string; onAnswered: () => void }) {
  const [question, setQuestion] = useState("")
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

  async function ask(text = question) {
    if (!text.trim() || working) return
    setQuestion(text)
    setWorking(true)
    setError("")
    const response = await fetch("/api/agent/chat", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order: reference, question: text }),
    }).catch(() => null)
    const result = (await response?.json().catch(() => null)) as { ok: boolean; error?: string } | null
    setWorking(false)
    if (!result?.ok) return setError(result?.error ?? "BahnBot could not be reached.")
    setQuestion("")
    onAnswered()
  }

  return <form className="ask" onSubmit={(e) => { e.preventDefault(); void ask() }}>
    <label htmlFor={`ask-${reference}`} className="sr-only">Ask BahnBot about this order</label>
    <div className="ask-row">
      <span className="agent-orb" style={{ margin: "9px 0 9px 6px" }}><Icon name="sparkle" size={12} /></span>
      <textarea id={`ask-${reference}`} rows={1} value={question} disabled={working} onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask() } }}
        placeholder="Ask BahnBot about this order…" />
      <button type="submit" className="btn btn-primary btn-sm" style={{ margin: 5 }} disabled={!question.trim() || working} aria-label="Ask">
        <Icon name="send" size={13} />
      </button>
    </div>
    <AnimatePresence initial={false}>
      {working
        ? <motion.p key="w" className="ask-status" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="shimmer">Reading the case and checking what it needs…</span>
          </motion.p>
        : !question && <motion.div key="s" className="ask-suggest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void ask(s)}>{s}</button>)}
          </motion.div>}
    </AnimatePresence>
    {error && <p className="err" role="alert" style={{ padding: "0 10px 6px", margin: 0 }}>{error}</p>}
  </form>
}
