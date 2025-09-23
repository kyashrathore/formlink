import { getenv } from "@/lib/env"

// Model list used in the chat UI. Keep minimal, focused options.

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 100
export const REMAINING_QUERY_ALERT_THRESHOLD = 2
export const DAILY_FILE_UPLOAD_LIMIT = 10

export type Model = {
  id: string
  name: string
  provider: string
  available?: boolean
}

export const MODELS = [
  // Default (fast, open-source)
  {
    id: "cerebras/gpt-oss-120b",
    name: "Cerebras GPT-OSS 120B",
    provider: "cerebras",
  },
  // Common proprietary options (optional to keep visible)
  { id: "openai/gpt-5", name: "OpenAI GPT-5", provider: "openai" },
  {
    id: "anthropic/claude-opus-4.1",
    name: "Claude Opus 4.1",
    provider: "anthropic",
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
  },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
  },
] as Model[]

export const MODELS_OPTIONS = [
  ...MODELS.map((model) => ({
    ...model,
    available: true,
  })),
] as Model[]

export const MODEL_DEFAULT = "cerebras/gpt-oss-120b"

export const APP_NAME = "FormLink.ai"
export const APP_DOMAIN = "https://formlink.ai"

export function getFormFillerFBasePath() {
  const customBaseUrl = getenv("NEXT_PUBLIC_FORMFILLER_BASE_URL")
  if (customBaseUrl) {
    return `${customBaseUrl}/f`
  }

  const isDev =
    getenv("NODE_ENV") === "development" ||
    (typeof window !== "undefined" && window.location.hostname === "localhost")
  if (isDev) {
    return "http://localhost:3001"
  }
  return "https://formlink.ai/f"
}

export function getFormFillerPreviewBasePath() {
  return `${getFormFillerFBasePath()}/preview`
}

export function getEmbedScriptsBasePath() {
  const isDev =
    getenv("NODE_ENV") === "development" ||
    (typeof window !== "undefined" && window.location.hostname === "localhost")
  if (isDev) {
    return "http://localhost:3000" // formcraft app port
  }
  return "https://formlink.ai" // no /f prefix, serve directly from formcraft
}

export const APP_DESCRIPTION = "FormLink is ..."

export const SYSTEM_PROMPT_DEFAULT = `You are Formlink, a thoughtful and clear assistant. Your tone is calm, minimal, and human. You write with intention—never too much, never too little. You avoid clichés, speak simply, and offer helpful, grounded answers. When needed, you ask good questions. You don’t try to impress—you aim to clarify. You may use metaphors if they bring clarity, but you stay sharp and sincere. You're here to help the user think clearly and move forward, not to overwhelm or overperform.`

export const MESSAGE_MAX_LENGTH = 10000

export const ENABLE_BILLING = false
