// A run's full record (ADR-004). Live runs write it; recorded mode replays it without a model.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

export type Trigger = "watch" | "on_the_road" | "ask"

export type Step = {
  seq: number
  kind: "tool_call" | "tool_result" | "guard_refusal" | "blocked" | "message"
  tool?: string
  input?: Record<string, unknown>
  output?: unknown
  text?: string
  at: string
}

export type Proposal = {
  id: string
  action: string
  payload: Record<string, unknown>
  headline: string
  blockers: string[]
  evidence: Record<string, unknown>[]
}

export type Escalation = { reason: string; what_i_know: string[]; what_i_dont_know: string[] }
export type HeadsUp = { risk: string; line: string }

export type Trace = {
  id: string
  order: string
  trigger: Trigger
  mode: "live" | "recorded"
  model: string | null
  prompt: string
  startedAt: string
  finishedAt: string
  status: "done" | "stopped" | "failed"
  steps: Step[]
  proposals: Proposal[]
  escalation: Escalation | null
  headsUp: HeadsUp | null
  summary: string
}

export function traceDir(): string {
  return process.env.TRACES_DIR ?? join(process.cwd(), "..", "traces")
}

export function replayTrace(trace: Trace): Trace {
  return { ...trace, mode: "recorded" }
}

export function saveTrace(trace: Trace, dir: string = traceDir()): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${trace.order}.${trace.trigger}.json`)
  writeFileSync(file, JSON.stringify({ ...trace, mode: "recorded" }, null, 2) + "\n")
  return file
}

export function loadTraces(dir: string = traceDir()): Trace[] {
  let files: string[]
  try {
    files = readdirSync(dir).filter((name) => name.endsWith(".json"))
  } catch {
    return []
  }
  return files.sort().map((name) => replayTrace(JSON.parse(readFileSync(join(dir, name), "utf8")) as Trace))
}
