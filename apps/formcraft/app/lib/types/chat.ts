import {
  ChoiceQuestionSchema,
  FormSchema as FullFormSchema,
  LinearScaleQuestionSchema,
  QuestionSchema,
  RankingQuestionSchema,
  RatingQuestionSchema,
  SettingsSchema,
  SimpleQuestionSchema,
} from "@formlink/schema"
import { z } from "zod"

export interface StreamEventPayload {
  ai_text: {
    text: string
    delta?: string
  }
  tool_call: {
    toolName: string
    arguments: Record<string, unknown>
    toolCallId?: string
  }
  tool_result: {
    toolName: string
    result: unknown
    toolCallId?: string
  }
  agent_progress: {
    step: string
    status: "started" | "in_progress" | "completed" | "failed"
    progress?: { current: number; total: number }
    message?: string
  }
  agent_error: {
    code: string
    message: string
    details?: unknown
  }
  ui_action: {
    action: string
    data?: unknown
  }
}

export interface StreamEvent<
  T extends keyof StreamEventPayload = keyof StreamEventPayload,
> {
  type: T
  source:
    | "main_llm"
    | "form_creation_agent"
    | "form_update_agent"
    | "query_docs_agent"
    | string
  timestamp: number
  payload: StreamEventPayload[T]
  metadata?: {
    correlationId?: string
    userId?: string
    formId?: string
  }
}

export const CreateFormAgentSchema = z.object({
  prompt: z.string().describe("The user's request for form creation"),
})

const AddQuestionActionSchema = z.object({
  action: z.literal("add"),
  questionData: QuestionSchema.describe(
    "Complete data for the new question, conforming to QuestionSchema. The AI should generate all necessary fields."
  ),
})

const UpdateQuestionActionSchema = z.object({
  action: z.literal("update"),
  questionId: z.string().describe("ID of the question to update."),
  questionData: z
    .preprocess(
      (val) => val,
      z.union([
        ChoiceQuestionSchema.partial(),
        RankingQuestionSchema.partial(),
        RatingQuestionSchema.partial(),
        LinearScaleQuestionSchema.partial(),
        SimpleQuestionSchema.partial(),
      ])
    )
    .describe(
      "Partial data with fields to update for the existing question. Only include fields that are being changed. " +
        "The structure should match a partial version of the specific question type being updated."
    ),
})

const RemoveQuestionActionSchema = z.object({
  action: z.literal("remove"),
  questionId: z.string().describe("ID of the question to remove."),
  questionData: z
    .undefined()
    .optional()
    .describe("Should not be provided for remove action."),
})

export const UpdateFormSchema = z.object({
  updates: z
    .object({
      title: FullFormSchema.shape.title
        .optional()
        .describe("New form title. Only include if changing."),
      description: FullFormSchema.shape.description
        .optional()
        .describe("New form description. Only include if changing."),
      questions: z
        .array(
          z.discriminatedUnion("action", [
            AddQuestionActionSchema,
            UpdateQuestionActionSchema,
            RemoveQuestionActionSchema,
          ])
        )
        .optional()
        .describe(
          "Array of question modifications. Each object specifies an action ('add', 'update', 'remove')."
        ),
      settings: SettingsSchema.partial()
        .optional()
        .describe(
          "Updates to form settings. Only include fields to be changed."
        ),
    })
    .strict()
    .describe(
      "An object containing only the specific form fields to be updated. All properties are optional. " +
        "For 'questions', provide an array of actions. For 'add', 'questionData' should be a complete new question. " +
        "For 'update', 'questionId' is required and 'questionData' should contain only the fields to change. " +
        "For 'remove', only 'questionId' is required."
    ),
})

export const QueryDocsSchema = z.object({
  query: z
    .string()
    .describe("User's question about FormCraft features or documentation"),
  context: z.string().optional().describe("Additional context for the query"),
})

export const ShowConfigButtonSchema = z.object({
  buttonType: z
    .enum(["slack", "webhook", "email", "integration"])
    .describe("Type of configuration button to show"),
  formId: z.string().describe("Form ID for the configuration"),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe("Additional metadata for the button"),
})

export const GetFormContextSchema = z
  .object({
    formId: z
      .string()
      .optional()
      .describe(
        "The ID of the form. If omitted, the system will use the form ID associated with the current chat session."
      ),
  })
  .describe("Parameters for retrieving the current context of a form.")

export interface ToolCall {
  toolName: string
  arguments: Record<string, unknown>
  toolCallId?: string
}

export interface ToolResult {
  toolName: string
  result: unknown
  toolCallId?: string
  error?: string
}

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  metadata?: {
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
  }
}

export interface AgentProgressEvent {
  step: string
  status: "started" | "in_progress" | "completed" | "failed"
  progress?: {
    current: number
    total: number
  }
  data?: unknown
  message?: string
}

export interface ToolExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    executionTime?: number
    agentUsed?: string
  }
}

export interface ChatRequest {
  messages: ChatMessage[]
  formId?: string
  userId: string
  options?: {
    model?: string
    temperature?: number
    maxOutputTokens?: number
  }
}

export interface ChatResponse {
  message: ChatMessage
  toolCalls?: ToolCall[]
  metadata?: {
    model: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}

export interface AgentError {
  code: string
  message: string
  details?: unknown
  recoverable: boolean
  suggestedAction?: string
}

export type ToolName =
  | "createFormAgent"
  | "updateForm"
  | "queryDocs"
  | "showConfigButton"
  | "resumeFormCreation"
  | "getFormContext"
