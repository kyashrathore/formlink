import { ChatRequest } from "../types/chat"

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
    settings: any
  }
  error?: string
}

export interface ChatToolContext {
  dataStream: any
  formId: string
  supabase: any
  userId: string
  options?: ChatRequest["options"]
  isFirstMessage: boolean
}
