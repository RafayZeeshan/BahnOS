"use client"

// The control room's component kit (ADR-016): Motion for movement, our tokens for the look.
// Every animation respects reduced motion through the MotionConfig in Providers.
import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { useId, useState, type HTMLAttributes, type ReactNode } from "react"
import { Icon } from "../components/icons"

export const spring = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const
export const ease = [0.22, 1, 0.36, 1] as const

export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease }}>{children}</MotionConfig>
}

/** A block that may enter with a short CSS fade; `i` is kept for callers. Content is visible by default, so a throttled tab never shows it half-faded. */
export function Reveal({ i = 0, children, className, style, ...rest }: { i?: number; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`reveal${className ? ` ${className}` : ""}`} style={{ ...style, ["--i" as string]: Math.min(i, 12) }} {...rest}>{children}</div>
}

/** Height-animated disclosure for details on demand. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return <AnimatePresence initial={false}>
    {open && <motion.div key="c" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.26, ease }} style={{ overflow: "hidden" }}>
      {children}
    </motion.div>}
  </AnimatePresence>
}

/** A link-style toggle with a turning chevron. */
export function MoreToggle({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return <button type="button" className="link" aria-expanded={open} onClick={onToggle}>
    {children}<Icon name="chevron" size={12} className="chev" />
  </button>
}

type Option<T extends string> = { value: T; label: ReactNode; count?: number }

/** Segmented control with a sliding thumb. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }) {
  const id = useId()
  return <div className="seg" role="tablist" aria-label={label}>
    {options.map((o) => <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className="seg-btn" onClick={() => onChange(o.value)}>
      {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={spring} />}
      <span>{o.label}</span>
      {o.count !== undefined && <span className="seg-count">{o.count}</span>}
    </button>)}
  </div>
}

/** Underlined tabs with a sliding indicator. */
export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }) {
  const id = useId()
  return <div className="tabs" role="tablist" aria-label={label}>
    {options.map((o) => <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className="tab" onClick={() => onChange(o.value)}>
      {o.label}{o.count !== undefined && <span className="tab-count">{o.count}</span>}
      {value === o.value && <motion.span layoutId={`tab-${id}`} className="tab-line" transition={spring} />}
    </button>)}
  </div>
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** The model's illustration (not the specific car), or a quiet car icon when there is none. */
export function CarThumb({ car }: { car: string }) {
  const [failed, setFailed] = useState(false)
  return <span className="car" aria-hidden="true" title="Illustration of the model, not this car">
    {failed || car === "Car not recorded"
      ? <Icon name="car" size={18} />
      // eslint-disable-next-line @next/next/no-img-element -- tiny local illustrations; next/image adds nothing here
      : <img src={`/car-images/${slug(car)}.webp`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </span>
}

/** Small round countdown used by the undo toast. */
export function Ring({ seconds, total }: { seconds: number; total: number }) {
  const r = 7
  const c = 2 * Math.PI * r
  return <svg className="toast-ring" viewBox="0 0 18 18" aria-hidden="true">
    <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
    <motion.circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform="rotate(-90 9 9)"
      strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - seconds / total) }} transition={{ duration: 1, ease: "linear" }} />
  </svg>
}

export { AnimatePresence, motion }
