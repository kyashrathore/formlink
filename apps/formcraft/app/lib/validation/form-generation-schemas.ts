/**
 * Zod schemas for form generation event validation
 */

import { z } from "zod"

// Form metadata schema
export const FormMetadataSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

// Question schema
export const QuestionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: z.enum([
    "text",
    "radio",
    "checkbox",
    "select",
    "email",
    "number",
    "date",
  ]),
  options: z.array(z.string()).optional(),
  required: z.boolean(),
  order: z.number().int().min(0),
  placeholder: z.string().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
})

// Event schemas
export const AgentInitializedEventSchema = z.object({
  type: z.literal("agent_initialized"),
  formId: z.string(),
  timestamp: z.string().datetime().optional(),
})

export const StateSnapshotEventSchema = z.object({
  type: z.literal("state_snapshot"),
  formId: z.string(),
  data: z.object({
    agentState: z
      .object({
        formMetadata: FormMetadataSchema.optional(),
        journeyScript: z.string().optional(),
        settings: z
          .object({
            journeyScript: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
})

export const QuestionGeneratedEventSchema = z.object({
  type: z.literal("question_schema_generated"),
  data: z.object({
    question: QuestionSchema,
    questionIndex: z.number().int().min(0),
    totalQuestions: z.number().int().min(1).optional(),
  }),
})

export const AgentWarningEventSchema = z.object({
  type: z.literal("agent_warning"),
  data: z.object({
    message: z.string(),
    details: z.any().optional(),
  }),
})

export const AgentErrorEventSchema = z.object({
  type: z.literal("agent_error"),
  data: z.object({
    message: z.string(),
    error: z.any().optional(),
    section: z.enum(["metadata", "journey", "questions"]).optional(),
  }),
})

export const AgentFinalizedEventSchema = z.object({
  type: z.literal("agent_finalized"),
  formId: z.string(),
  timestamp: z.string().datetime().optional(),
})

// Union type for all events
export const AgentEventSchema = z.discriminatedUnion("type", [
  AgentInitializedEventSchema,
  StateSnapshotEventSchema,
  QuestionGeneratedEventSchema,
  AgentWarningEventSchema,
  AgentErrorEventSchema,
  AgentFinalizedEventSchema,
])

// Type exports
export type FormMetadata = z.infer<typeof FormMetadataSchema>
export type Question = z.infer<typeof QuestionSchema>
export type AgentEvent = z.infer<typeof AgentEventSchema>

// Validation helpers
export function validateEvent(event: unknown): AgentEvent | null {
  const result = AgentEventSchema.safeParse(event)
  if (result.success) {
    return result.data
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[Validation Error]", result.error.format())
  }

  return null
}

export function validateFormMetadata(data: unknown): FormMetadata | null {
  const result = FormMetadataSchema.safeParse(data)
  return result.success ? result.data : null
}

export function validateQuestion(data: unknown): Question | null {
  const result = QuestionSchema.safeParse(data)
  return result.success ? result.data : null
}
