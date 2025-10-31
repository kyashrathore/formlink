import { SupabaseClient } from "@formlink/db"
import { ChatRequest } from "../types/chat"

interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
}

export interface FormCreationResult {
  success: boolean
  formId: string
  formTitle?: string
  questionCount?: number
  formDescription?: string
  message: string
  error?: string
}

export interface FormUpdateResult {
  success: boolean
  formId: string
  message: string
  error?: string
}

export interface QueryDocsResult {
  success: boolean
  answer: string
  query: string
  context?: string
}

export interface ShowConfigResult {
  success: boolean
  action: string
  buttonType: string
  formId: string
  message: string
}

export interface GetFormContextResult {
  success: boolean
  formId?: string
  context?: {
    formId: string
    shortId: string
    title: string
    description: string
    questions: Array<{
      questionNumber: number
      id: string
      type: string
      title: string
      options?: string[]
      ratingConfig?: { min: number; max: number }
    }>
    settings: Record<string, unknown>
  }
  error?: string
}

export interface ChatToolContext {
  dataStream: DataStream
  formId: string
  supabase: SupabaseClient
  userId: string
  options?: ChatRequest["options"]
  isFirstMessage: boolean
  cookieHeader?: string
}
