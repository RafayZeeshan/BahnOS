import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "dotenv"

type Env = Record<string, string | undefined>

// Fills only variables that are not already set, so starter/.env and the shell always win.
export function loadEnvFile(file: string, env: Env = process.env): void {
  if (!existsSync(file)) return
  for (const [key, value] of Object.entries(parse(readFileSync(file)))) {
    if (env[key] === undefined) env[key] = value
  }
}

// The team keeps the key in the repo-root .env, which Next.js does not read from starter/.
export function loadRootEnv(env: Env = process.env): void {
  loadEnvFile(join(process.cwd(), "..", ".env"), env)
}

// ANTHROPIC_API_KEY is the SDK's name; CLAUDE_API_KEY is accepted because that is what the team's .env uses.
export function anthropicKey(env: Env = process.env): string | undefined {
  for (const name of ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"]) {
    const value = env[name]?.trim()
    if (value) return value
  }
  return undefined
}

export type AgentConnection = { via: "openrouter" | "anthropic"; key: string }

// OpenRouter wins when its key is set: the team's direct Anthropic key returned 429 throughout the build.
export function agentConnection(env: Env = process.env): AgentConnection | undefined {
  const openRouter = env.OPENROUTER_API_KEY?.trim()
  if (openRouter) return { via: "openrouter", key: openRouter }
  const key = anthropicKey(env)
  return key ? { via: "anthropic", key } : undefined
}

// claude-sonnet-5-5 → anthropic/claude-sonnet-5.5; an id that already names a provider is kept.
export function openRouterModel(model: string): string {
  if (model.includes("/")) return model
  return `anthropic/${model.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`
}
