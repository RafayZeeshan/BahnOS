import type { Evidence } from "@/lib/present/evidence"
import { fmtDateTime } from "@/lib/present/time"

// Strength is shape plus words (ADR-007): an empty ring for a claim, filling up to a solid check when verified.
function StrengthMark({ strength }: { strength: Evidence["strength"] }) {
  return <svg className="ev-mark" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
    <circle cx="6" cy="6" r="4.6" fill={strength === "verified" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" />
    {strength === "reported" && <path d="M6 1.4a4.6 4.6 0 0 1 0 9.2Z" fill="currentColor" />}
    {strength === "observed" && <circle cx="6" cy="6" r="2.2" fill="currentColor" />}
    {strength === "verified" && <path d="M3.8 6.1 5.3 7.6 8.3 4.6" fill="none" stroke="var(--birch)" strokeWidth="1.4" strokeLinecap="round" />}
  </svg>
}

const STRENGTH_WORD: Record<Evidence["strength"], string> = {
  claimed: "Claimed", reported: "Reported", observed: "Observed", verified: "Verified",
}

export function EvidenceChip({ evidence, showTime = false }: { evidence: Evidence; showTime?: boolean }) {
  const when = evidence.at ? fmtDateTime(evidence.at) : ""
  return <span className={`ev ev-${evidence.strength}`} title={`${STRENGTH_WORD[evidence.strength]}: ${evidence.label}${when ? `, ${when}` : ""}`}>
    <StrengthMark strength={evidence.strength} />
    <span>{evidence.label}</span>
    {showTime && when && <span className="ev-time num">· {when}</span>}
  </span>
}
