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
  modelName: string,
  providerType: ProviderType = "vercel"
): string | LanguageModel {
  // For Vercel (default), just return the string
  // AI SDK v5 automatically uses Vercel AI Gateway when a string is passed
  if (providerType === "vercel") {
    return modelName
  }

  // For OpenRouter, create and use the OpenRouter provider
  if (providerType === "openrouter") {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    })
    return openrouter(modelName)
  }

  // For direct OpenAI - using Vercel AI Gateway for now
  // TODO: Implement direct OpenAI SDK integration when needed
  if (providerType === "openai") {
    return modelName
  }

  // Default fallback to Vercel
  return modelName
}

/**
 * Helper to convert model names between providers
 * Useful when switching providers but keeping the same model
 */
export function convertModelName(
  modelName: string,
  fromProvider: ProviderType,
  toProvider: ProviderType
): string {
  // If same provider, return as-is
  if (fromProvider === toProvider) {
    return modelName
  }

  // Convert from Vercel to OpenRouter format
  if (fromProvider === "vercel" && toProvider === "openrouter") {
    const modelMap: Record<string, string> = {
      "gpt-5": "openai/gpt-5",
    }
    return modelMap[modelName] || modelName
  }

  // Convert from OpenRouter to Vercel format
  if (fromProvider === "openrouter" && toProvider === "vercel") {
    const modelMap: Record<string, string> = {
      "openai/gpt-4o": "gpt-4o",
      "openai/gpt-5": "gpt-5",
      "openai/gpt-4o-mini": "gpt-4o-mini",
      "openai/gpt-4": "gpt-4",
      "openai/gpt-3.5-turbo": "gpt-3.5-turbo",
      "anthropic/claude-3.5-sonnet": "claude-3-5-sonnet",
      "anthropic/claude-3-opus": "claude-3-opus",
      "anthropic/claude-3-haiku": "claude-3-haiku",
    }
    return modelMap[modelName] || modelName
  }

  return modelName
}

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
