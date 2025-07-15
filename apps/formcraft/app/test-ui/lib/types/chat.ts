// Import necessary schemas from your schema package
import {
  ChoiceQuestionSchema,
  FormSchema as FullFormSchema,
  LinearScaleQuestionSchema,
  QuestionSchema,
  RankingQuestionSchema,
  RatingQuestionSchema,
  repairQuestionInputTypes,
  SettingsSchema,
  SimpleQuestionSchema,
} from "@formlink/schema"
import { z } from "zod"
import { AgentState } from "../agent/state"

// Standardized stream event structure
export interface StreamEvent {
  type:
    | "ai_text"
    | "tool_call"
    | "tool_result"
    | "agent_progress"
    | "agent_error"
    | "ui_action"
  source:
    | "main_llm"
    | "form_creation_agent"
    | "form_update_agent"
    | "query_docs_agent"
    | string
  timestamp: number
  payload: any
  metadata?: {
    correlationId?: string
    userId?: string
    formId?: string
  }
}

// Tool parameter schemas
export const CreateFormAgentSchema = z.object({
  prompt: z.string().describe("The user's request for form creation"),
})

// Schema for the 'add' action for a question
const AddQuestionActionSchema = z.object({
  action: z.literal("add"),
  questionData: z
    .preprocess(
      // Repair the question data before validation
      (val) => {
        if (!val || typeof val !== "object") return val

        // Pre-repair question data

        // Repair single question wrapped in array, then extract
        const repaired = repairQuestionInputTypes([val])
        const repairedQuestion = repaired[0]

        // Post-repair question data

        return repairedQuestion
      },
      QuestionSchema
    )
    .describe(
      "Complete data for the new question, conforming to QuestionSchema. The AI should generate all necessary fields."
    ),
})

// Schema for the 'update' action for a question
const UpdateQuestionActionSchema = z.object({
  action: z.literal("update"),
  questionId: z.string().describe("ID of the question to update."),
  questionData: z
    .preprocess(
      // For updates, we don't repair since we're working with partial data
      // The repair will happen in the simple-agent when merging with existing question
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

// Schema for the 'remove' action for a question
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
    .strict() // Ensures no extra properties are passed in the 'updates' object
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
    .record(z.any())
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

// Chat message types
export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  metadata?: {
    toolCalls?: any[]
    toolResults?: any[]
  }
}

// Agent progress event types
export interface AgentProgressEvent {
  step: string
  status: "started" | "in_progress" | "completed" | "failed"
  progress?: {
    current: number
    total: number
  }
  data?: any
  message?: string
}

// Tool execution result types
export interface ToolExecutionResult {
  success: boolean
  data?: any
  error?: string
  metadata?: {
    executionTime?: number
    agentUsed?: string
  }
}

// Chat API request/response types
export interface ChatRequest {
  messages: ChatMessage[]
  formId?: string
  userId: string
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
}

export interface ChatResponse {
  message: ChatMessage
  toolCalls?: any[]
  metadata?: {
    model: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}

// Error types
export interface AgentError {
  code: string
  message: string
  details?: any
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
