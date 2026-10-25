import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { SNAPSHOT_AT, minutesUntil, now } from "@/lib/clock"

const root = join(__dirname, "..")
// Agent and UI paths. Scripts and tests may use the real clock for timing work.
const SCANNED = ["app", "lib"]
const WALL_CLOCK = /Date\.now\(\)|new Date\(\s*\)/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

export function wallClockCalls(files: string[]): string[] {
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (WALL_CLOCK.test(line) && !line.includes("clock-ok") ? [`${file}:${i + 1}`] : [])),
  )
}

describe("frozen clock", () => {
  it("is the packet snapshot", () => {
    expect(SNAPSHOT_AT).toBe("2026-10-21T09:00:00.000Z")
    expect(now().toISOString()).toBe(SNAPSHOT_AT)
  })

  it("returns a fresh Date each call so callers cannot mutate the snapshot", () => {
    const a = now()
    a.setFullYear(2000)
    expect(now().toISOString()).toBe(SNAPSHOT_AT)
  })

  it("measures minutes from the snapshot", () => {
    expect(minutesUntil("2026-10-21T15:40:00Z")).toBe(400)
    expect(minutesUntil("2026-10-21T08:00:00Z")).toBe(-60)
  })

  it("flags wall-clock calls", () => {
    const planted = join(__dirname, "support", "wall-clock-sample.txt")
    expect(WALL_CLOCK.test(readFileSync(planted, "utf8"))).toBe(true)
  })

  it("is not bypassed in agent or UI paths", () => {
    const files = SCANNED.flatMap((dir) => sourceFiles(join(root, dir)))
    expect(wallClockCalls(files)).toEqual([])
  })
})
