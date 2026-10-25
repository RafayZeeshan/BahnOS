// How far to trust a fact (ADR-007). The packet is built around these differences:
// a quote is not a booking, an alert is not a diagnosis, a driver message is not a location.

export const STRENGTHS = ["claimed", "reported", "observed", "verified"] as const
export type Strength = (typeof STRENGTHS)[number]

export type Evidence = { strength: Strength; label: string; at: string }

export type EvidenceSource =
  | { kind: "message"; authorType: string; at: string }
  | { kind: "call"; speaker: "driver" | "site"; at: string }
  | { kind: "travel_option"; status: string; at: string }
  | { kind: "travel_reservation"; status: string; at: string }
  | { kind: "booking_attempt"; outcome: "TIMED_OUT" | "FAILED" | "CONFIRMED"; at: string }
  | { kind: "ferry_gate_scan"; at: string }
  | { kind: "endpoint_detail"; source: string | null; at: string }
  | { kind: "tracking"; at: string }
  | { kind: "site_reply"; at: string }
  | { kind: "proof"; status: string; at: string }
  | { kind: "alert"; at: string }
  | { kind: "event"; at: string }

const MESSAGE_LABEL: Record<string, [Strength, string]> = {
  driver: ["claimed", "driver said"],
  customer: ["claimed", "customer said"],
  handoff_contact: ["claimed", "handover contact said"],
  site: ["observed", "site replied"],
  site_contact: ["observed", "site replied"],
  operator: ["reported", "ops note"],
  agent: ["reported", "agent wrote"],
}

function rate(source: EvidenceSource): [Strength, string] {
  switch (source.kind) {
    case "message":
      return MESSAGE_LABEL[source.authorType] ?? ["claimed", "message"]
    case "call":
      return ["claimed", `${source.speaker} said on a call`]
    case "travel_option":
      if (source.status === "SOLD_OUT") return ["observed", "provider said sold out"]
      return ["observed", "quoted by provider, not booked"]
    case "travel_reservation":
      return source.status === "CONFIRMED" || source.status === "BOOKED"
        ? ["verified", "confirmed by provider"]
        : ["reported", "booking recorded, not confirmed"]
    case "booking_attempt":
      if (source.outcome === "CONFIRMED") return ["verified", "confirmed by provider"]
      if (source.outcome === "TIMED_OUT") return ["reported", "booking outcome unknown"]
      return ["reported", "booking attempt failed"]
    case "ferry_gate_scan":
      return ["verified", "gate scan"]
    case "endpoint_detail":
      return source.source === "MANAGED_SITE_PROFILE"
        ? ["reported", "standard site profile"]
        : ["observed", "confirmed for this order"]
    case "tracking":
      return ["observed", "tracking signal"]
    case "site_reply":
      return ["observed", "site replied"]
    case "proof":
      return source.status === "APPROVED" ? ["observed", "seen in photo"] : ["reported", "photo sent, not reviewed"]
    case "alert":
      return ["reported", "system alert"]
    case "event":
      return ["reported", "system record"]
  }
}

export function evidenceFor(source: EvidenceSource): Evidence {
  const [strength, label] = rate(source)
  return { strength, label, at: source.at }
}

/** An agent conclusion is only as strong as its weakest input. */
export function weakest(strengths: Strength[]): Strength {
  if (strengths.length === 0) return "claimed"
  return STRENGTHS[Math.min(...strengths.map((s) => STRENGTHS.indexOf(s)))]
}
