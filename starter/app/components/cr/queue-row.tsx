import type { QueueItem } from "@/lib/control/queue"
import { CarThumb, motion, spring } from "../../ui/kit"

// One order, one line (the caller wraps it in a list item): the car, why it needs you, the deadline that decides it, and the next move.
export function QueueRow({ item, selected, isNew, onSelect }: {
  item: QueueItem; selected: boolean; isNew: boolean; onSelect: () => void
}) {
  const late = /passed|ago/.test(item.deadline?.note ?? "")
  const hot = !late && /\bin (\d+ m|[0-5] h)/.test(item.deadline?.note ?? "")
  return <button type="button" className="qi" aria-current={selected ? "true" : undefined} onClick={onSelect}>
      {selected && <motion.span layoutId="qi-bg" className="qi-bg" transition={spring} />}
      {isNew && <span className="qi-dot" title="New since you last looked"><span className="sr-only">New. </span></span>}
      <CarThumb car={item.car} />
      <span className="qi-main">
        <span className="qi-title"><span>{item.car}</span><span className="qi-ref">{item.reference}</span></span>
        <span className="qi-why">{item.why}</span>
      </span>
      <span className="qi-side">
        {item.deadline && <span className={`due${late ? " due-late" : hot ? " due-hot" : ""}`} title={`${item.deadline.label} ${item.deadline.note ?? ""}`}>
          {shortDue(item.deadline.label, item.deadline.note)}
        </span>}
        <span className={`cta${item.decisionId ? " cta-go" : ""}`}>{item.recommended}</span>
      </span>
    </button>
}

// "Ferry check-in" + "closes in 3 h 0 m" → "Check-in 3 h"; long notes stay in the tooltip.
function shortDue(label: string, note: string | null): string {
  const what = label.replace(/^Ferry /i, "").replace(/^Customer /i, "")
  const when = note?.match(/(\d+\s*d(?:\s*\d+\s*h)?|\d+\s*h|\d+\s*m)/)?.[0]?.replace(/\s+0 m$/, "")
  if (note && /passed|ago/.test(note)) return `${what} passed`
  return when ? `${capital(what)} · ${when}` : capital(what)
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
