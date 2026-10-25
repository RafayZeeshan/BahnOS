// The packet is one frozen snapshot (ADR-003). Every "now" in agent and UI code comes from here,
// so deadlines and slack read the same on any day the app is opened.
export const SNAPSHOT_AT = "2026-10-21T09:00:00.000Z"

const SNAPSHOT_MS = Date.parse(SNAPSHOT_AT)

export function now(): Date {
  return new Date(SNAPSHOT_MS)
}

const BOOT_MS = performance.now()

/**
 * When a person or the executor acts: the snapshot plus real time since the app started.
 * Analysis (Watch, slack, deadlines) always uses now(); stamp() only orders human actions
 * and times the undo window.
 */
export function stamp(): Date {
  return new Date(SNAPSHOT_MS + Math.round(performance.now() - BOOT_MS))
}

/** Whole minutes from the snapshot to `iso`; negative when `iso` is already past. */
export function minutesUntil(iso: string, from: Date = now()): number {
  return Math.round((Date.parse(iso) - from.getTime()) / 60_000)
}

/** Real wall-clock time, only for short real-world windows such as the 5-second undo. It survives restarts. */
export function wallClock(): Date {
  return new Date(Date.now()) // clock-ok: the undo window is real time, not snapshot time
}
