"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

type Item = { label: string; hint: string; href: string }
const PAGES: Item[] = [
  { label: "Today", hint: "G then T", href: "/" },
  { label: "Heads-up", hint: "G then H", href: "/?tab=heads-up" },
  { label: "Ops map", hint: "G then M", href: "/map" },
  { label: "Answer book", hint: "G then A", href: "/answers" },
  { label: "Risk outlook", hint: "G then R", href: "/risk" },
  { label: "Learning", hint: "G then L", href: "/learned" },
  { label: "All orders", hint: "G then O", href: "/board" },
]
const GO: Record<string, string> = { t: "/", h: "/?tab=heads-up", m: "/map", a: "/answers", r: "/risk", l: "/learned", o: "/board" }
const KEYS: [string, string][] = [
  ["J / K or ↓ / ↑", "Next or previous order"], ["Enter", "Open the case full width"], ["1 2 3 4", "Go ahead, Change it, Take over, Not this"],
  ["H", "Snooze the decision"], ["G then T, H, M, R, A, L, O", "Today, Heads-up, Ops map, Risk outlook, Answer book, Learning, All orders"], ["⌘K", "Jump to an order or page"],
  ["?", "This help"], ["Esc", "Close, or go back to Today"],
]

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
}

// Command menu, shortcut help and G-then-letter navigation for every page. Every shortcut is also a visible button or link.
export function GlobalKeys() {
  const router = useRouter()
  const [open, setOpen] = useState<"menu" | "help" | null>(null)
  const [query, setQuery] = useState("")
  const [orders, setOrders] = useState<Item[]>([])
  const [active, setActive] = useState(0)
  const pendingG = useRef(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => (o === "menu" ? null : "menu")); return }
      if (e.key === "Escape" && open) { e.stopImmediatePropagation(); setOpen(null); return }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "?") { e.preventDefault(); setOpen("help"); return }
      if (e.key.toLowerCase() === "g") { pendingG.current = performance.now(); return }
      const target = GO[e.key.toLowerCase()]
      if (target && performance.now() - pendingG.current < 1200) { e.preventDefault(); e.stopImmediatePropagation(); pendingG.current = 0; router.push(target) }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, router])

  useEffect(() => {
    if (open !== "menu") return
    setQuery(""); setActive(0); input.current?.focus()
    if (orders.length) return
    fetch("/api/today").then((r) => r.json()).then((d: { needsYou: { reference: string; car: string; route: string }[]; quiet: { reference: string; car: string; route: string }[] }) =>
      setOrders([...d.needsYou, ...d.quiet].map((o) => ({ label: `${o.reference} · ${o.car}`, hint: o.route, href: `/case/${o.reference}` }))))
      .catch(() => setOrders([]))
  }, [open, orders.length])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [...PAGES, ...orders]
    return (q ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q)) : PAGES).slice(0, 8)
  }, [query, orders])

  if (!open) return null
  const go = (item: Item | undefined) => { if (item) { setOpen(null); router.push(item.href) } }

  return <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null) }}>
    {open === "menu" ? <div className="cmd" role="dialog" aria-modal="true" aria-label="Jump to an order or page">
      <input ref={input} className="cmd-input" value={query} placeholder="Order reference, car, city or page…" aria-label="Search"
        onChange={(e) => { setQuery(e.target.value); setActive(0) }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
          if (e.key === "Enter") { e.preventDefault(); go(results[active]) }
        }} />
      <ul className="cmd-list" role="listbox" aria-label="Results">{results.map((r, i) => <li key={r.href} role="option" aria-selected={i === active}>
        <button type="button" className={`cmd-item${i === active ? " active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
          <span>{r.label}</span><span className="muted">{r.hint}</span>
        </button>
      </li>)}
      {results.length === 0 && <li className="muted cmd-empty">No order or page matches.</li>}</ul>
    </div> : <div className="cmd" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h2 style={{ padding: "16px 18px 0", fontSize: 15, fontWeight: 600 }}>Keyboard shortcuts</h2>
      <dl className="keys">{KEYS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
      <div style={{ padding: "0 18px 16px" }}><button type="button" className="btn btn-sm" onClick={() => setOpen(null)}>Close</button></div>
    </div>}
  </div>
}
