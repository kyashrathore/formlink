import { openai as openaiProvider } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { gateway as vercelGateway } from "ai"
import logger from "../logger"

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
  providerType: ProviderType = "vercel"
): any {
  // Decide gateway: env override or default to vercel

  // Default model if none provided (gateway-specific safe defaults)
  const defaultByGateway: Record<ProviderType, string> = {
    vercel: "openai/gpt-5.1-instant",
    openrouter: "openai/gpt-oss-120b",
    openai: "gpt-oss-120b",
  }

  const defaultModel = defaultByGateway[providerType]
  const model = modelName || defaultModel
  // Canonical mapping between short ids and fully-qualified provider ids
  const modelMap: Record<string, string> = {
    // OpenAI
    "gpt-5": "openai/gpt-5.2",
    // Anthropic
    "claude-opus-4.1": "anthropic/claude-opus-4.5",
    "claude-sonnet-4": "anthropic/claude-sonnet-4.5",
    // Google
    "gemini-2.5-pro": "google/gemini-3-pro-preview",
    "gemini-2.5-flash": "google/gemini-2.5-flash",
  }

  const normalizedForRouter = modelMap[model] || model

  logger.info({
    providerType,
    defaultModel,
    model: normalizedForRouter,
  })
  if (providerType === "vercel") {
    return vercelGateway(normalizedForRouter)
  }

  if (providerType === "openrouter") {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    })
    return openrouter(normalizedForRouter)
  }

  if (providerType === "openai") {
    // Direct OpenAI provider path
    return openaiProvider(normalizedForRouter)
  }

  // Fallback: return as-is (string)
  return normalizedForRouter
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

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    issues.push(
      "Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN for AI Gateway (vercel provider)"
    )
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}
