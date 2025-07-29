import {
  Question,
  QuestionSchema,
} from "@/app/lib/validation/form-generation-schemas"
import { QuestionType, repairQuestionInputTypes } from "@formlink/schema"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"
import { createAgentEvent } from "../../types/agent-events"

// Simplified schema for AI generation that avoids discriminated union issues
const AIQuestionSchema = z.object({
  type: z.literal("question"),
  id: z.string(),
  questionNo: z.number(),
  title: z.string(),
  description: z.string().optional(),
  questionType: z.enum([
    "multipleChoice",
    "singleChoice",
    "text",
    "date",
    "rating",
    "address",
    "ranking",
    "fileUpload",
    "linearScale",
    "likertScale",
  ]),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        score: z.number().optional(),
      })
    )
    .optional(),
  display: z.object({
    inputType: z.string(),
    showTitle: z.boolean().optional(),
    showDescription: z.boolean().optional(),
  }),
  submissionBehavior: z.enum(["autoAnswer", "manualAnswer", "manualUnclear"]),
  validations: z
    .object({
      required: z
        .object({
          value: z.boolean(),
          message: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  ratingConfig: z
    .object({
      min: z.number(),
      max: z.number(),
      step: z.number(),
      minLabel: z.string().optional(),
      maxLabel: z.string().optional(),
    })
    .optional(),
  linearScaleConfig: z
    .object({
      start: z.number(),
      end: z.number(),
      step: z.number(),
      startLabel: z.string().optional(),
      endLabel: z.string().optional(),
    })
    .optional(),
  rankingConfig: z
    .object({
      min: z.number(),
      max: z.number(),
      step: z.number(),
    })
    .optional(),
  fileUploadConfig: z
    .object({
      allowedFileTypes: z.array(z.string()).optional(),
      maxFileSizeMB: z.number().optional(),
      maxFiles: z.number().optional(),
    })
    .optional(),
  defaultValue: z.any().optional(),
})

/**
 * Maps the AI-generated question schema to the form's internal Question schema.
 * This handles the discrepancies between the AI's output format and the expected form question format.
 */
function mapAIQuestionToFormQuestion(
  aiQuestion: z.infer<typeof AIQuestionSchema>,
  order: number
): Question {
  let type: z.infer<typeof QuestionSchema>["type"]
  let options: string[] | undefined

  // Map AI's questionType to form's question type
  switch (aiQuestion.questionType) {
    case "multipleChoice":
    case "singleChoice":
      type = "radio" // Assuming radio for both multiple and single choice for now
      options = aiQuestion.options?.map((opt) => opt.label || opt.value)
      break
    case "text":
      type = "text"
      break
    case "date":
      type = "date"
      break
    case "rating":
    case "linearScale":
      type = "number" // Map to number, as QuestionSchema doesn't have specific rating/scale types
      break
    case "address":
      type = "text" // Map address to text, as QuestionSchema doesn't have a specific address type
      break
    case "ranking":
      type = "select" // Map ranking to select, as QuestionSchema doesn't have a specific ranking type
      options = aiQuestion.options?.map((opt) => opt.label || opt.value)
      break
    case "fileUpload":
      type = "text" // Map fileUpload to text, as QuestionSchema doesn't have a specific file upload type
      break
    default:
      type = "text" // Default to text if unknown
  }

  // Map validations
  const validation: z.infer<typeof QuestionSchema>["validation"] = {}
  if (aiQuestion.ratingConfig) {
    validation.min = aiQuestion.ratingConfig.min
    validation.max = aiQuestion.ratingConfig.max
  }
  if (aiQuestion.linearScaleConfig) {
    validation.min = aiQuestion.linearScaleConfig.start
    validation.max = aiQuestion.linearScaleConfig.end
  }
  // Add other validation mappings as needed (e.g., pattern from AIQuestionSchema)

  return {
    id: aiQuestion.id,
    title: aiQuestion.title,
    type: type,
    options: options,
    required: aiQuestion.validations?.required?.value || false, // Map from nested validation
    order: order,
    placeholder: aiQuestion.description || undefined, // Use description as placeholder
    validation: Object.keys(validation).length > 0 ? validation : undefined,
  }
}

/**
 * Interface for question generation result
 */
export interface QuestionGenerationResult {
  success: boolean
  question?: z.infer<typeof AIQuestionSchema> // Keep AIQuestionSchema here for internal use
  error?: string
}

/**
 * Interface for progress streaming
 */
interface DataStream {
  writeData: (data: unknown) => void
}

/**
 * Interface for question generation parameters
 */
export interface GenerateQuestionParams {
  questionTitle: string
  questionType: QuestionType
  order: number
  totalQuestions: number
  formContext?: {
    title: string
    description: string
  }
}

/**
 * Generate a single question schema using AI SDK
 * Removes complex task lifecycle and database operations
 * Keeps parallel generation capability
 *
 * @param params - Question generation parameters
 * @param dataStream - Progress streaming interface
 * @param systemPrompt - The system prompt for question generation
 * @returns Promise<QuestionGenerationResult>
 */
export async function generateQuestion(
  params: GenerateQuestionParams,
  dataStream: DataStream,
  systemPrompt: string,
  formId: string,
  userId: string,
  getSequence: () => number
): Promise<QuestionGenerationResult> {
  try {
    const { questionTitle, questionType, order, totalQuestions, formContext } =
      params

    // Check for API key first
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set")
    }

    // Check for system prompt
    if (!systemPrompt || systemPrompt.trim() === "") {
      throw new Error("System prompt is required for question generation")
    }

    // Stream progress update
    dataStream.writeData({
      type: "progress",
      message: `Generating question ${order + 1} of ${totalQuestions}: "${questionTitle}"`,
      step: "question_generation",
      progress: Math.round(((order + 1) / totalQuestions) * 100),
      questionTitle,
      questionType,
    })

    // Initialize OpenRouter provider
    const openRouterProvider = createOpenRouter({
      apiKey,
    })

    // Build the user prompt with context
    let userPrompt = `Generate a complete JSON schema for the question: "${questionTitle}" (type: ${questionType}). This is question ${order + 1} of ${totalQuestions}. Set questionNo to ${order + 1}.`

    if (formContext) {
      userPrompt += `\n\nForm context:\nTitle: ${formContext.title}\nDescription: ${formContext.description}`
    }

    dataStream.writeData({
      type: "progress",
      message: `Processing AI generation for "${questionTitle}"...`,
      step: "ai_processing",
      progress: Math.round(((order + 0.5) / totalQuestions) * 100),
    })

    // Core AI call - extracted from original lines 157-162
    const generateSchemaResult = await generateObject({
      model: openRouterProvider("openai/o3"),
      schema: AIQuestionSchema,
      system: systemPrompt,
      prompt: userPrompt,
    })

    if (!generateSchemaResult?.object) {
      throw new Error(
        `AI call for schema generation failed. Question: "${questionTitle}". Result: ${JSON.stringify(generateSchemaResult)}`
      )
    }

    // Ensure questionNo is set correctly
    const questionWithOrder = {
      ...generateSchemaResult.object,
      questionNo: order + 1, // Ensure questionNo is set
    }

    // Map the AI-generated question to the form's Question schema
    const formQuestion = mapAIQuestionToFormQuestion(questionWithOrder, order)

    // Apply repair before sending to frontend
    const repairedQuestion = repairQuestionInputTypes([formQuestion])[0]

    // Emit individual question completion event
    dataStream.writeData({
      type: "custom_agent_event",
      payload: createAgentEvent(
        "question_schema_generated",
        "progress",
        {
          questionTitle: questionTitle,
          questionIndex: order,
          totalQuestions: totalQuestions,
          question: repairedQuestion, // Use the repaired question here
          message: `Generated question: "${questionTitle}"`,
        },
        formId,
        userId,
        getSequence()
      ),
    })

    dataStream.writeData({
      type: "progress",
      message: `Completed question: "${questionTitle}"`,
      step: "question_complete",
      progress: Math.round(((order + 1) / totalQuestions) * 100),
      questionGenerated: true,
    })

    return {
      success: true,
      question: questionWithOrder,
    }
  } catch (error) {
    const errorMessage =
      (error as Error)?.message ||
      `Unknown error generating question: "${params.questionTitle}"`

    dataStream.writeData({
      type: "error",
      message: `Failed to generate question: "${params.questionTitle}"`,
      error: errorMessage,
      step: "question_error",
      questionTitle: params.questionTitle,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Generate multiple questions in parallel
 * Maintains the parallel generation capability from the original implementation
 *
 * @param questionParams - Array of question generation parameters
 * @param dataStream - Progress streaming interface
 * @param systemPrompt - The system prompt for question generation
 * @returns Promise<QuestionGenerationResult[]>
 */
export async function generateQuestionsParallel(
  questionParams: GenerateQuestionParams[],
  dataStream: DataStream,
  systemPrompt: string,
  formId: string,
  userId: string,
  getSequence: () => number
): Promise<QuestionGenerationResult[]> {
  // Send QUESTIONS_START event for progressive UI
  dataStream.writeData({
    type: "custom_agent_event",
    payload: createAgentEvent(
      "agent_warning",
      "system",
      {
        message: `Starting generation of ${questionParams.length} questions`,
        details: {
          event_source: "metadata_generator_task_list",
          questionTaskCount: questionParams.length,
        },
      },
      formId,
      userId,
      getSequence()
    ),
  })

  dataStream.writeData({
    type: "progress",
    message: `Starting parallel generation of ${questionParams.length} questions...`,
    step: "parallel_start",
    progress: 0,
    totalQuestions: questionParams.length,
  })

  // Generate all questions in parallel - events will fire as each resolves
  const results = await Promise.all(
    questionParams.map((params) =>
      generateQuestion(
        params,
        dataStream,
        systemPrompt,
        formId,
        userId,
        getSequence
      )
    )
  )

  const successCount = results.filter((r) => r.success).length
  const errorCount = results.filter((r) => !r.success).length

  dataStream.writeData({
    type: "progress",
    message: `Parallel generation complete: ${successCount} successful, ${errorCount} failed`,
    step: "parallel_complete",
    progress: 100,
    successCount,
    errorCount,
  })

  return results
}
