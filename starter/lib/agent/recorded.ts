// Loads everything recorded under traces/ into the agent tables: the agent runs and Watch's warning lines.
import { loadWatchLines } from "../watch/line"
import { persistTrace, persistWatchLines, supersedeOlder } from "./store"
import { loadTraces } from "./trace"

export async function loadRecorded(): Promise<{ runs: number; lines: number }> {
  const traces = loadTraces()
  for (const trace of traces) await persistTrace(trace)
  // Recorded runs reload with their old timestamps, so tidy every order once they are all in.
  await supersedeOlder()
  const lines = loadWatchLines()
  await persistWatchLines(lines)
  return { runs: traces.length, lines: lines.length }
}
