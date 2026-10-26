"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { SNAPSHOT_AT } from "@/lib/clock"
import { fmtDateTime } from "@/lib/present/time"
import { motion, spring } from "../ui/kit"
import { GlobalKeys } from "./cr/global-keys"
import { Icon } from "./icons"

export type Section = "today" | "heads-up" | "map" | "risk" | "learned" | "answers" | "board" | "inbox" | "customers" | "drivers" | "sites"

type NavLink = { section: Section; href: string; label: string; icon: string }

// The work comes first in the bar; the records sit behind one menu, since they are looked up, not watched.
const WORK: NavLink[][] = [
  [
    { section: "today", href: "/", label: "Today", icon: "flag" },
    { section: "heads-up", href: "/?tab=heads-up", label: "Heads-up", icon: "waiting" },
    { section: "map", href: "/map", label: "Ops map", icon: "pin" },
    { section: "risk", href: "/risk", label: "Risk outlook", icon: "alert" },
  ],
  [
    { section: "answers", href: "/answers", label: "Answer book", icon: "file" },
    { section: "learned", href: "/learned", label: "Learning", icon: "sparkle" },
  ],
]
const RECORDS: NavLink[] = [
  { section: "board", href: "/board", label: "All orders", icon: "car" },
  { section: "inbox", href: "/inbox", label: "Inbox", icon: "inbox" },
  { section: "drivers", href: "/drivers", label: "Drivers", icon: "driver" },
  { section: "sites", href: "/sites", label: "Places", icon: "building" },
  { section: "customers", href: "/customers", label: "Customers", icon: "people" },
]

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null)
  useEffect(() => {
    const set = document.documentElement.dataset.theme
    setDark(set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches)
  }, [])
  function flip() {
    const next = dark ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try { localStorage.setItem("cr.theme", next) } catch { /* private mode: the choice lasts this visit */ }
    setDark(!dark)
  }
  return <button type="button" className="theme-btn" onClick={flip} aria-label={dark ? "Use the light theme" : "Use the dark theme"} title={dark ? "Light theme" : "Dark theme"}>
    <Icon name={dark ? "sun" : "moon"} size={15} />
  </button>
}

function RecordsMenu({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const current = RECORDS.find((r) => r.section === section)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close) }
  }, [open])
  return <div className="bar-menu" ref={ref}>
    <button type="button" className="bar-link" aria-expanded={open} aria-haspopup="true" aria-current={current ? "page" : undefined} onClick={(e) => { setLeft(e.currentTarget.getBoundingClientRect().left); setOpen(!open) }}>
      {current && <motion.span layoutId="bar-line" className="bar-line" transition={spring} />}
      <span>{current ? `Records · ${current.label}` : "Records"}</span><Icon name="chevron" size={11} style={{ transform: "rotate(90deg)" }} />
    </button>
    {/* Fixed, so the bar's scrolling nav never clips it. */}
    {open && <nav className="bar-pop" aria-label="Records" style={{ left }}>
      {RECORDS.map((link) => <Link key={link.section} href={link.href} aria-current={section === link.section ? "page" : undefined} onClick={() => setOpen(false)}>
        <Icon name={link.icon} size={15} />{link.label}
      </Link>)}
    </nav>}
  </div>
}

export function AppFrame({ children, section, snapshotAt, board = false, counts = {} }: {
  children: ReactNode; section: Section; snapshotAt?: string | null; board?: boolean; counts?: Partial<Record<Section, number>>
}) {
  return <div className={`app${board ? " app-board" : ""}`}>
    <header className="bar">
      <Link href="/" className="brand" aria-label="BahnOS, Today">
        <span className="brand-mark" aria-hidden="true" /><span className="brand-name">BahnOS</span>
      </Link>
      <nav className="bar-nav" aria-label="Main navigation">
        {WORK.map((group, g) => [
          g > 0 && <span key={`sep-${g}`} className="bar-sep" aria-hidden="true" />,
          ...group.map((link) => {
            const current = section === link.section
            const count = counts[link.section]
            return <Link key={link.section} href={link.href} className="bar-link" aria-current={current ? "page" : undefined}>
              {current && <motion.span layoutId="bar-line" className="bar-line" transition={spring} />}
              <span>{link.label}</span>
              {count ? <span className={`bar-count${link.section === "today" ? " bar-count-hot" : ""}`}>{count}</span> : null}
            </Link>
          }),
        ])}
        <span className="bar-sep" aria-hidden="true" />
        <RecordsMenu section={section} />
      </nav>
      <div className="bar-right">
        <span className="now" title="The data is a fixed snapshot. Every deadline is measured from this time.">
          <span>Snapshot</span><b className="num">{fmtDateTime(snapshotAt ?? SNAPSHOT_AT)}</b>
        </span>
        <span className="bar-keys"><kbd>⌘K</kbd> search · <kbd>?</kbd> keys</span>
        <ThemeToggle />
      </div>
    </header>
    <div className="main">{children}</div>
    <GlobalKeys />
  </div>
}
