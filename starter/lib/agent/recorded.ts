// Loads everything recorded under traces/ into the agent tables: the agent runs and Watch's warning lines.
import { loadWatchLines } from "../watch/line"
import { persistTrace, persistWatchLines } from "./store"
import { loadTraces } from "./trace"

export async function loadRecorded(): Promise<{ runs: number; lines: number }> {
  const traces = loadTraces()
  for (const trace of traces) await persistTrace(trace)
  const lines = loadWatchLines()
  await persistWatchLines(lines)
  return { runs: traces.length, lines: lines.length }
}
