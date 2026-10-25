// Recorded calls (ADR-014). With voice off, call_site and call_driver return a recorded call for the demo
// orders. The people on the other end are fictional; every call opens by saying it is an AI and makes no promises.
import { now } from "@/lib/clock"
import { evidenceFor, type Evidence } from "@/lib/present/evidence"

type Speaker = "agent" | "driver" | "site"
type Turn = { speaker: Speaker; text: string; seconds: number }
type Recording = { with: "driver" | "site"; who: string; turns: Turn[]; answers: { fact: string; turn: number }[] }

const RECORDINGS: Record<string, Recording> = {
  "CD-420299|site": {
    with: "site",
    who: "Vela Coast Lines booking desk",
    turns: [
      { speaker: "agent", seconds: 0, text: "Hello, this is an AI assistant calling for Bahn about order CD-420299. Do you hold a vehicle reservation for it from this morning's request?" },
      { speaker: "site", seconds: 9, text: "Let me check. No, there's no reservation under that order. The request at ten past seven never completed, and nothing was charged." },
      { speaker: "agent", seconds: 21, text: "Thank you. Is there still vehicle space on Saturday's sailing from the West Baltic terminal?" },
      { speaker: "site", seconds: 28, text: "Yes, there's space as of now. That's a quote, not a hold. I can't keep it for you without a booking." },
      { speaker: "agent", seconds: 37, text: "Understood. A colleague will decide and come back to you. Thank you for checking." },
    ],
    answers: [
      { fact: "The desk holds no reservation for the timed-out request, and nothing was charged.", turn: 1 },
      { fact: "Saturday's sailing still has vehicle space, as a quote, not a hold.", turn: 3 },
    ],
  },
  "CD-420322|driver": {
    with: "driver",
    who: "Driver",
    turns: [
      { speaker: "agent", seconds: 0, text: "Hi, this is Bahn's AI assistant calling about the Bentley on CD-420322. Are you and the car in a safe place?" },
      { speaker: "driver", seconds: 6, text: "Yes. I'm in the car park at the service area, engine off." },
      { speaker: "agent", seconds: 12, text: "Good. Which service area, and which direction were you driving?" },
      { speaker: "driver", seconds: 17, text: "The one just past the last junction, heading north towards Hamburg." },
      { speaker: "agent", seconds: 24, text: "Is the red warning still on?" },
      { speaker: "driver", seconds: 27, text: "Yes, it's still on. I've sent the dashboard photo in the app." },
      { speaker: "agent", seconds: 33, text: "Thank you. Please don't drive on. A colleague is asking the owner what they want to do, and we'll tell you who is coming." },
    ],
    answers: [
      { fact: "The driver is safe in a service-area car park with the engine off.", turn: 1 },
      { fact: "The driver was heading north towards Hamburg.", turn: 3 },
      { fact: "The red warning is still on; a dashboard photo was sent in the app.", turn: 5 },
    ],
  },
}

export type CallTurn = { speaker: Speaker; text: string; at: string }
export type CallResult = {
  order: string; recipient_role: string; placed: boolean; recorded: boolean; with?: "driver" | "site"; who?: string
  transcript: CallTurn[]; answers: { fact: string; evidence: Evidence }[]; note?: string
}

export function recordedCall(order: string, role: string): CallResult {
  const recording = RECORDINGS[`${order}|${role}`]
  if (!recording) {
    return {
      order, recipient_role: role, placed: false, recorded: false, transcript: [], answers: [],
      note: "Voice calls are off and no call is recorded for this order. Use message_driver instead.",
    }
  }
  const start = now().getTime()
  const at = (seconds: number) => new Date(start + seconds * 1000).toISOString()
  return {
    order, recipient_role: role, placed: true, recorded: true, with: recording.with, who: recording.who,
    transcript: recording.turns.map((t) => ({ speaker: t.speaker, text: t.text, at: at(t.seconds) })),
    answers: recording.answers.map((a) => ({
      fact: a.fact,
      evidence: evidenceFor({ kind: "call", speaker: recording.with, at: at(recording.turns[a.turn].seconds) }),
    })),
  }
}
