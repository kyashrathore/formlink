import { getenv } from "@/lib/env"
import { openai } from "@ai-sdk/openai"
import {
  ClaudeIcon,
  GeminiIcon,
  MistralIcon,
  OpenAIIcon,
} from "@formlink/ui"

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 100
export const REMAINING_QUERY_ALERT_THRESHOLD = 2
export const DAILY_FILE_UPLOAD_LIMIT = 10

export type Model = {
  id: string
  name: string
  provider: string
  available?: boolean
  api_sdk?: any
  features?: {
    id: string
    enabled: boolean
  }[]
  openRouterId?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export const MODELS = [
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
    api_sdk: openai("openai/gpt-4.1"),
    icon: OpenAIIcon,
  },
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Google Gemini 2.5 Pro",
    provider: "google",
    features: [],
    api_sdk: openai("gpt-4"),
    openRouterId: "google/gemini-2.5-pro-preview",
    icon: GeminiIcon,
  },
  {
    id: "google/gemini-2.5-flash-preview-05-20",
    name: "Google Gemini 2.5 Flash",
    provider: "google",
    features: [
      {
        id: "file-upload",
        enabled: true,
      },
    ],
    api_sdk: openai("gpt-4"),
    openRouterId: "google/gemini-2.5-flash-preview-05-20",
    icon: GeminiIcon,
  },
  {
    id: "anthropic/claude-opus-4",
    name: "Claude Opus 4",
    provider: "anthropic",
    features: [],
    api_sdk: openai("gpt-4"),
    openRouterId: "anthropic/claude-opus-4",
    icon: ClaudeIcon,
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    features: [],
    api_sdk: openai("gpt-4"),
    openRouterId: "anthropic/claude-sonnet-4",
    icon: ClaudeIcon,
  },
] as Model[]

export const MODELS_OPTIONS = [
  ...MODELS.map((model) => ({
    ...model,
    available: true,
  })),
] as Model[]

export type Provider = {
  id: string
  name: string
  available: boolean
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    icon: OpenAIIcon,
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: MistralIcon,
  },
  {
    id: "google",
    name: "Google",
    icon: GeminiIcon,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: ClaudeIcon,
  },
] as Provider[]

export const PROVIDERS_OPTIONS = [
  ...PROVIDERS.map((provider) => ({
    ...provider,
    available: true,
  })),
] as Provider[]

export const MODEL_DEFAULT = "google/gemini-2.5-flash-preview-05-20"

export const APP_NAME = "FormFiller"
export const APP_DOMAIN = "https://app.formlink.ai"

export function getFormFillerFBasePath() {
  const isDev = getenv("NODE_ENV") === "development"
  if (isDev) {
    return "http://localhost:3001/f"
  }
  return "https://formlink.ai/f"
}

export const APP_DESCRIPTION = "FormLink is ..."

export const SYSTEM_PROMPT_DEFAULT = `You are formcraft, a thoughtful and clear assistant. Your tone is calm, minimal, and human. You write with intention—never too much, never too little. You avoid clichés, speak simply, and offer helpful, grounded answers. When needed, you ask good questions. You don’t try to impress—you aim to clarify. You may use metaphors if they bring clarity, but you stay sharp and sincere. You're here to help the user think clearly and move forward, not to overwhelm or overperform.`

export const MESSAGE_MAX_LENGTH = 10000
