import type { Leg, Route } from "@/lib/geo/types"
import { SNAPSHOT_AT } from "@/lib/clock"
import { fmtClock, fmtDateTime, fmtDuration, fmtMoney } from "@/lib/present/time"
import { Icon } from "../icons"

const MODE_ICON: Record<Leg["mode"], string> = { drive: "car", ferry: "ferry", train: "train", flight: "plane" }
const MODE_WORD: Record<Leg["mode"], string> = { drive: "Drive", ferry: "Ferry", train: "Train", flight: "Flight" }
const STATUS: Record<string, { text: string; tone: string }> = {
  booked: { text: "Booked", tone: "badge-ok" }, quoted: { text: "Quote, not booked", tone: "badge-accent" },
  sold_out: { text: "Sold out", tone: "badge-danger" },
}
function legBadge(leg: Leg) {
  return STATUS[leg.status] ?? { text: leg.basis === "quote" ? "From the quote" : "Estimate", tone: "" }
}

// Stop → stop as a vertical stepper (ADR-012). Line style carries status too: solid booked, dashed quoted,
// dotted estimated, and each leg also says it in words.
export function RouteStrip({ route, compact = false }: { route: Route; compact?: boolean }) {
  const tz = route.legs.at(-1)?.to.timezone
  return <div className={`rs${compact ? " rs-compact" : ""}`}>
    {route.legs.map((leg, i) => {
      const badge = legBadge(leg)
      return <div key={i}>
        <div className="rs-stop"><span className="rs-node" /><span>{leg.from.name}{leg.from.approximate ? <span className="muted"> · approx.</span> : null}</span></div>
        <div className={`rs-leg rs-leg-${leg.mode} rs-${leg.status}`}>
          <span className="rs-line" aria-hidden="true" />
          <div className="rs-body">
            <span className="rs-mode"><Icon name={MODE_ICON[leg.mode]} size={14} />{MODE_WORD[leg.mode]}</span>
            <span className="num">{leg.departAt ? fmtDateTime(leg.departAt, leg.from.timezone) : ""}{leg.minutes ? ` · ${fmtDuration(leg.minutes)}` : ""}</span>
            {!compact && leg.priceCents !== null && <span className="num">{fmtMoney(leg.priceCents, "EUR")}</span>}
            <span className={`badge ${badge.tone}`}>{badge.text}</span>
          </div>
        </div>
        {i === route.legs.length - 1 && <div className="rs-stop"><span className="rs-node" style={{ background: "var(--text)" }} /><span>{leg.to.name}</span></div>}
      </div>
    })}
    {!compact && route.alternatives.map((a) => <p key={a.departAt} className="rs-note"><s>{a.label}, {fmtDateTime(a.departAt, route.legs.find((l) => l.mode === "ferry")?.from.timezone)}</s> · sold out</p>)}
    {!compact && route.arrival && (route.arrival.latest < SNAPSHOT_AT
      ? <p className="rs-note">The original plan had the car arriving {fmtDateTime(route.arrival.earliest, tz)}, which has passed. There is no live position for the driver.</p>
      : <p className="rs-note">Arrives {fmtDateTime(route.arrival.earliest, tz)}–{fmtClock(route.arrival.latest, tz)} · {route.arrival.basis}</p>)}
    {!compact && route.driverEta && <p className="rs-note">Driver app ETA {fmtDateTime(route.driverEta.at, tz)} · sent {fmtDateTime(route.driverEta.receivedAt, tz)}, not checked</p>}
  </div>
}
