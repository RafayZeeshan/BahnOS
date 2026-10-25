// Everything outside the agent is mocked (BUILD-PLAN rule 4). These are fictional,
// authored replies for the demo orders, recorded so a run is the same without a key.

/** What each demo order's driver answers in the app when the agent asks. */
export const DRIVER_REPLIES: Record<string, { text: string; minutesLater: number }> = {
  "CD-420299": {
    text: "Yes, I can take the Saturday 12:00 sailing if a hotel near the terminal is booked for Friday night. I have not changed my pickup time.",
    minutesLater: 6,
  },
  "CD-420322": {
    text: "I'm safe. I'm parked at the service area car park, engine off, the red warning is still on. I've sent the dashboard photo in the app.",
    minutesLater: 4,
  },
  "CD-420154": {
    text: "I can be in Marseille for the slot if the train tonight is actually booked. Please send the ticket, not a suggestion.",
    minutesLater: 9,
  },
  "CD-420399": {
    text: "Confirmed. After my rest I can't travel before 12:00 tomorrow, so I can't make the Leipzig slot.",
    minutesLater: 5,
  },
  "CD-420603": {
    text: "Still in the queue with the car. My guess is about 40 minutes to the gate, but it isn't moving much.",
    minutesLater: 3,
  },
  "CD-420449": {
    text: "Feeling a bit better, but I can't promise yet. I'll give you a definite answer by 06:00 tomorrow.",
    minutesLater: 12,
  },
}

/** Mock hotel rate near a ferry terminal, per night. */
export const HOTEL_NIGHT_CENTS = 9_500
/** Allowance from the arrival terminal to the delivery address when the packet gives none. */
export const LAST_STRETCH_HOURS = 3
/** Waiting longer than this near the terminal needs a hotel night. */
export const HOTEL_AFTER_HOURS = 8
