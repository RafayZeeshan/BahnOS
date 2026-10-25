import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { DEFAULT_MODEL } from "@/lib/agent/claude"
import { agentConnection, anthropicKey, loadEnvFile, openRouterModel } from "@/lib/env"

describe("anthropicKey", () => {
  it("prefers ANTHROPIC_API_KEY", () => {
    expect(anthropicKey({ ANTHROPIC_API_KEY: "a", CLAUDE_API_KEY: "c" })).toBe("a")
  })
  it("falls back to CLAUDE_API_KEY", () => {
    expect(anthropicKey({ CLAUDE_API_KEY: "c" })).toBe("c")
  })
  it("treats blank values as missing", () => {
    expect(anthropicKey({ ANTHROPIC_API_KEY: "  ", CLAUDE_API_KEY: "" })).toBeUndefined()
  })
})

describe("agentConnection", () => {
  it("uses OpenRouter when its key is set, even beside an Anthropic key", () => {
    expect(agentConnection({ OPENROUTER_API_KEY: "o", CLAUDE_API_KEY: "c" })).toEqual({ via: "openrouter", key: "o" })
  })
  it("falls back to the Anthropic key", () => {
    expect(agentConnection({ CLAUDE_API_KEY: "c" })).toEqual({ via: "anthropic", key: "c" })
  })
  it("is undefined with no key", () => {
    expect(agentConnection({ OPENROUTER_API_KEY: " " })).toBeUndefined()
  })
})

describe("openRouterModel", () => {
  it("maps an Anthropic model id to OpenRouter's", () => {
    expect(openRouterModel("claude-opus-5-5")).toBe("anthropic/claude-opus-5.5")
    expect(openRouterModel("claude-fable-5-1")).toBe("anthropic/claude-fable-5.1")
    expect(openRouterModel("claude-opus-5")).toBe("anthropic/claude-opus-5")
  })
  it("sends the default agent model to OpenRouter as Sonnet 5.5", () => {
    expect(openRouterModel(DEFAULT_MODEL)).toBe("anthropic/claude-sonnet-5.5")
  })
  it("leaves an OpenRouter id alone", () => {
    expect(openRouterModel("anthropic/claude-sonnet-5.5")).toBe("anthropic/claude-sonnet-5.5")
  })
})

describe("loadEnvFile", () => {
  it("fills missing values without overriding existing ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"))
    const file = join(dir, ".env")
    writeFileSync(file, "CLAUDE_API_KEY=from-file\nDATABASE_URL=from-file\n")
    const env: Record<string, string | undefined> = { DATABASE_URL: "already-set" }
    loadEnvFile(file, env)
    expect(env.CLAUDE_API_KEY).toBe("from-file")
    expect(env.DATABASE_URL).toBe("already-set")
  })
  it("ignores a missing file", () => {
    const env: Record<string, string | undefined> = {}
    expect(() => loadEnvFile("/nonexistent/.env", env)).not.toThrow()
  })
})
