"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { SNAPSHOT_AT } from "@/lib/clock"
import { fmtDateTime } from "@/lib/present/time"
import { motion, spring } from "../ui/kit"
import { GlobalKeys } from "./cr/global-keys"
import { Icon } from "./icons"

export type Section = "today" | "heads-up" | "map" | "risk" | "learned" | "answers" | "board" | "inbox" | "customers" | "drivers" | "sites"

type NavLink = { section: Section; href: string; label: string; icon: string }

const GROUPS: { label: string; links: NavLink[] }[] = [
  { label: "Control room", links: [
    { section: "today", href: "/", label: "Today", icon: "flag" },
    { section: "heads-up", href: "/?tab=heads-up", label: "Heads-up", icon: "waiting" },
    { section: "map", href: "/map", label: "Ops map", icon: "pin" },
    { section: "risk", href: "/risk", label: "Risk outlook", icon: "alert" },
  ] },
  { label: "BahnBot", links: [
    { section: "answers", href: "/answers", label: "Answer book", icon: "file" },
    { section: "learned", href: "/learned", label: "Learning", icon: "sparkle" },
  ] },
  { label: "Records", links: [
    { section: "board", href: "/board", label: "All orders", icon: "car" },
    { section: "inbox", href: "/inbox", label: "Inbox", icon: "inbox" },
    { section: "drivers", href: "/drivers", label: "Drivers", icon: "driver" },
    { section: "sites", href: "/sites", label: "Places", icon: "building" },
    { section: "customers", href: "/customers", label: "Customers", icon: "people" },
  ] },
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

export function AppFrame({ children, section, snapshotAt, board = false, counts = {} }: {
  children: ReactNode; section: Section; snapshotAt?: string | null; board?: boolean; counts?: Partial<Record<Section, number>>
}) {
  return <div className={`app${board ? " app-board" : ""}`}>
    <aside className="side">
      <Link href="/" className="brand" aria-label="BahnOS, Today">
        <span className="brand-mark"><Icon name="flag" size={14} /></span>
        <span><span className="brand-name">BahnOS</span><span className="brand-sub">Bahn car delivery</span></span>
      </Link>
      <nav className="side-nav" aria-label="Main navigation">
        {GROUPS.map((group) => <div className="side-group" key={group.label}>
          <div className="side-label">{group.label}</div>
          {group.links.map((link) => {
            const current = section === link.section
            return <Link key={link.section} href={link.href} className="side-link" aria-current={current ? "page" : undefined}>
              {current && <motion.span layoutId="side-pill" className="side-pill" transition={spring} />}
              <Icon name={link.icon} size={15} /><span>{link.label}</span>
              {counts[link.section] ? <span className="side-count">{counts[link.section]}</span> : null}
            </Link>
          })}
        </div>)}
      </nav>
      <div className="side-foot">
        <div className="now" title="The data is a fixed snapshot. Every deadline is measured from this time.">
          <span className="now-dot" aria-hidden="true" /><span>Now <b className="num">{fmtDateTime(snapshotAt ?? SNAPSHOT_AT)}</b></span>
        </div>
        <div className="side-tools">
          <span><kbd>⌘K</kbd> search · <kbd>?</kbd> keys</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
    <div className="main">{children}</div>
    <GlobalKeys />
  </div>
}
