import type { QueueItem } from "@/lib/control/queue"
import { motion, spring } from "../../ui/kit"

// One order as one timetable row (the caller wraps it in a list item): the order, the car and why it needs you,
// the leg and the next move, and the time left on the deadline that decides it, right-aligned like a departure.
export function QueueRow({ item, selected, isNew, onSelect }: {
  item: QueueItem; selected: boolean; isNew: boolean; onSelect: () => void
}) {
  const late = /passed|ago/.test(item.deadline?.note ?? "")
  const hot = !late && /\bin (\d+ m|[0-5] h)/.test(item.deadline?.note ?? "")
  const due = item.deadline ? splitDue(item.deadline.label, item.deadline.note) : null
  return <button type="button" className="qi" aria-current={selected ? "true" : undefined} onClick={onSelect}>
      {selected && <motion.span layoutId="qi-bg" className="qi-bg" transition={spring} />}
      {isNew && <span className="qi-dot" title="New since you last looked"><span className="sr-only">New. </span></span>}
      <span className="qi-ref">{item.reference.replace(/^CD-/, "")}</span>
      <span className="qi-main">
        <span className="qi-title"><span>{item.car}</span></span>
        <span className="qi-why">{item.why}</span>
      </span>
      <span className="qi-leg">
        <span className="qi-route">{item.route}</span>
        <span className={`cta${item.decisionId ? " cta-go" : ""}`}>{item.recommended}</span>
      </span>
      <span className="qi-side" title={item.deadline ? `${item.deadline.label} ${item.deadline.note ?? ""}` : undefined}>
        {due ? <>
          <span className={`due${late ? " due-late" : hot ? " due-hot" : ""}`}>{due.when}</span>
          <span className="due-label">{due.what}</span>
        </> : <span className="due-label">No deadline</span>}
      </span>
    </button>
}

// "Ferry check-in" + "closes in 3 h 0 m" → { when: "3 h", what: "Check-in" }; long notes stay in the tooltip.
function splitDue(label: string, note: string | null): { when: string; what: string } {
  const what = capital(label.replace(/^Ferry /i, "").replace(/^Customer /i, ""))
  if (note && /passed|ago/.test(note)) return { when: "Passed", what }
  const when = note?.match(/(\d+\s*d(?:\s*\d+\s*h)?|\d+\s*h|\d+\s*m)/)?.[0]?.replace(/\s+0 m$/, "")
  return { when: when ?? "–", what }
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
