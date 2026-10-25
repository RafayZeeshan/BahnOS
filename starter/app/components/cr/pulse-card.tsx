import type { HeadsUpCard } from "@/lib/watch/sweep"
import { CarThumb } from "../../ui/kit"

const NEXT_STEP: Record<string, string> = {
  ask_driver: "Ask the driver",
  refresh_quote: "Refresh the quote",
  check_provider: "Check the provider",
  call_site: "Call the site",
}

// A heads-up in two lines: the warning, the slack left, and the cheap next step (ADR-008).
export function PulseCard({ card, onOpen, selected = false, alsoNeedsYou = false }: { card: HeadsUpCard; onOpen: () => void; selected?: boolean; alsoNeedsYou?: boolean }) {
  const used = card.slack ? Math.max(0, Math.min(1, 1 - card.slack.minutes / card.slack.of)) : 0
  const slip = card.level === "likely_to_slip"
  return <button type="button" className="hu" aria-current={selected ? "true" : undefined} onClick={onOpen} aria-labelledby={`hu-${card.order}`}>
    <span className="hu-top">
      <CarThumb car={card.car} />
      <span className="hu-name" id={`hu-${card.order}`}>{card.car} <span className="qi-ref">{card.order}</span></span>
      <span className={`badge ${slip ? "badge-danger" : "badge-warn"}`}><span className="badge-dot" />{slip ? "Likely to slip" : "Watch"}</span>
    </span>
    <span className="hu-line">{card.line}</span>
    {card.slack && <span className="slack" role="img" aria-label={`${card.slack.label}. The bar fills as the cutoff gets closer.`}>
      <span className="slack-track"><span className="slack-fill" style={{ display: "block", width: `${Math.round(used * 100)}%` }} /></span>
    </span>}
    <span className="hu-foot">
      {card.slack && <span className="badge num">{card.slack.label}</span>}
      {card.nextStep && NEXT_STEP[card.nextStep] && <span className="badge badge-accent">Next: {NEXT_STEP[card.nextStep]}</span>}
      {alsoNeedsYou && <span className="badge">Also in Needs you</span>}
    </span>
  </button>
}
