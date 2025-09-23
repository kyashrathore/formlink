import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"

// Export types for use in other files
export type ProviderType = "vercel" | "openrouter" | "openai"

/**
 * Get a model from the specified provider
 *
 * @param modelName - The model name
 * @param providerType - The provider to use (defaults to vercel)
 * @returns The configured model instance
 *
 * @example
 * // Use Vercel AI Gateway (default)
 * const model = getModel("gpt-5")
 *
 * @example
 * // Use OpenRouter
 * const model = getModel("openai/gpt-5", "vercel")
 */
export function getModel(
  modelName?: string,
  providerType?: ProviderType
): string | LanguageModel {
  // Decide gateway: env override or default to vercel
  const defaultGateway = (process.env.API_GATEWAY as ProviderType) || "vercel"
  const gateway: ProviderType = providerType || defaultGateway

  // Default model if none provided
  const resolvedModel =
    modelName && modelName.trim() ? modelName : "cerebras/gpt-oss-120b"

  // Canonical mapping: Vercel → OpenRouter
  const modelMap: Record<string, string> = {
    // OpenAI
    "gpt-5": "openai/gpt-5",
    // Anthropic
    "claude-opus-4.1": "anthropic/claude-opus-4.1",
    "claude-sonnet-4": "anthropic/claude-sonnet-4",
    // Google
    "gemini-2.5-pro": "google/gemini-2.5-pro",
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    // Cerebras (OpenRouter provider name differs)
    "cerebras/gpt-oss-120b": "chutes/gpt-oss-120b",
  }
  const reverseModelMap: Record<string, string> = Object.fromEntries(
    Object.entries(modelMap).map(([key, value]) => [value, key])
  )

  // Normalize model id for the selected gateway
  const normalized =
    gateway === "openrouter"
      ? modelMap[resolvedModel] || resolvedModel
      : gateway === "vercel"
        ? reverseModelMap[resolvedModel] || resolvedModel
        : resolvedModel

  if (gateway === "vercel") {
    // AI SDK v5 uses Vercel AI Gateway when receiving a string model id
    return normalized
  }

  if (gateway === "openrouter") {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    })
    return openrouter(normalized)
  }

  if (gateway === "openai") {
    return normalized
  }

  // Fallback
  return normalized
}

/**
 * Helper to convert model names between providers
 * Useful when switching providers but keeping the same model
 */
// Deprecated utility; intentionally removed to avoid unused code.

// Environment check helper
export function checkProviderConfig() {
  const issues: string[] = []

  if (!process.env.OPENROUTER_API_KEY) {
    issues.push(
      "Missing OPENROUTER_API_KEY environment variable (needed for openrouter provider)"
    )
  }

  // Note: Vercel AI Gateway works with existing OPENAI_API_KEY or can use its own auth
  // No specific check needed for Vercel as it's the default

  return {
    isValid: issues.length === 0,
    issues,
  }
}
