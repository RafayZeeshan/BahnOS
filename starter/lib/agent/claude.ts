// Live model adapter (ADR-004). Only used when a key is set; recorded traces need none.
import Anthropic from "@anthropic-ai/sdk"
import { agentConnection, loadRootEnv, openRouterModel } from "@/lib/env"
import type { ModelCall } from "./loop"

export const DEFAULT_MODEL = "claude-sonnet-5-5"
const OPENROUTER_BASE_URL = "https://openrouter.ai/api"

// The id actually sent, so a trace records which model produced it.
export function agentModelName(): string {
  loadRootEnv()
  const model = process.env.AGENT_MODEL?.trim() || DEFAULT_MODEL
  return agentConnection()?.via === "openrouter" ? openRouterModel(model) : model
}

export function liveAvailable(): boolean {
  loadRootEnv()
  return Boolean(agentConnection())
}

export function claudeModel(): ModelCall {
  loadRootEnv()
  const connection = agentConnection()
  if (!connection) throw new Error("Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY (or CLAUDE_API_KEY) to run the agent live.")
  const model = agentModelName()

  if (connection.via === "openrouter") {
    // OpenRouter speaks the Messages API with a bearer token. It has no server-side fallback beta.
    const client = new Anthropic({ baseURL: OPENROUTER_BASE_URL, authToken: connection.key, apiKey: null })
    return async ({ system, messages, tools }) =>
      client.messages.create({
        model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      })
  }

  const client = new Anthropic({ apiKey: connection.key })
  return async ({ system, messages, tools }) => {
    // Server-side fallback re-runs a safety decline on another model inside the same call.
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    })
    return response as unknown as Anthropic.Message
  }
}
