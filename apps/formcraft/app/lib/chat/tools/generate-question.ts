import { generateObject } from "@/app/lib/ai/tracing"
import { loadPrompt } from "@formlink/prompts"
import { Question, QuestionSchema } from "@formlink/schema"
import { getModel } from "../../ai/provider"
import { createAgentEvent } from "../../types/agent-events"

// Define QuestionType locally since it's not exported from schema
type QuestionType =
  | "text"
  | "singleChoice"
  | "multipleChoice"
  | "rating"
  | "date"
  | "ranking"
  | "fileUpload"
  | "address"
  | "linearScale"
  | "likertScale"

/**
 * Interface for question generation result
 */
export interface QuestionGenerationResult {
  success: boolean
  question?: Question
  error?: string
}

/**
 * Interface for progress streaming
 */
interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
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
  // Optional hint for prompt to avoid id collisions; minimally [{ id }]
  existingQuestions?: Array<{ id: string }>
}

/**
 * Generate a single question schema using AI SDK
 *
 * @param params - Question generation parameters
 * @param dataStream - Progress streaming interface
 * @param systemPrompt - The system prompt for question generation
 * @returns Promise<QuestionGenerationResult>
 */
export async function generateQuestion(
  params: GenerateQuestionParams,
  dataStream: DataStream,
  formId: string,
  userId: string,
  getSequence: () => number,
  modelId?: string
): Promise<QuestionGenerationResult> {
  try {
    const { questionTitle, questionType, order, totalQuestions, formContext } =
      params

    // System prompt is rendered from the shared template with injected variables.

    // Progress handled by workflow - removed raw stream write

    const system = await loadPrompt("form/question-schema.md", {
      user_prompt: questionTitle,
      question_type: questionType,
      question_index: order + 1,
      total_questions: totalQuestions,
      form_title: formContext?.title ?? "",
      form_description: formContext?.description ?? "",
      existing_questions: params.existingQuestions ?? [],
    })

    // Add a repair function to increase robustness against schema drift
    let remainingRepairs = 2
    const repairFunction = async ({
      text,
      error,
    }: {
      text: string
      error: unknown
    }): Promise<string | null> => {
      if (remainingRepairs-- <= 0) return null
      let parsed: any = null
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text
      }
      const repairSystem = await loadPrompt("form/create-form-repair.md", {
        errors_json: [
          {
            path: Array.isArray((error as any)?.path)
              ? (error as any).path.join(".")
              : "",
            message:
              (error as any)?.message ||
              (error instanceof Error ? error.message : String(error)),
            code: (error as any)?.code || "unknown",
          },
        ],
        json_payload: parsed,
        generation_context: {
          model: String(getModel(modelId)),
          schema_name: "QuestionSchema",
          timestamp: new Date().toISOString(),
          form_title: formContext?.title ?? "",
          form_description: formContext?.description ?? "",
          question_text: questionTitle,
          question_type: questionType,
        },
      })
      const { object: repaired } = await generateObject({
        model: getModel(modelId) as any,
        schema: QuestionSchema,
        system: repairSystem,
        experimental_repairText:
          remainingRepairs > 0 ? repairFunction : undefined,
        prompt: "",
      })
      return JSON.stringify(repaired)
    }

    const generateSchemaResult = await generateObject({
      model: getModel(modelId) as any,
      schema: QuestionSchema,
      system: system,
      prompt: "",
      experimental_repairText: repairFunction,
    })

    if (!generateSchemaResult?.object) {
      throw new Error(
        `AI call for schema generation failed. Question: \"${questionTitle}\". Result: ${JSON.stringify(
          generateSchemaResult
        )}`
      )
    }

    // Post-fix common schema gaps to reduce downstream failures
    const generatedQuestion = generateSchemaResult.object as any

    // Ensure options include score when present (required by OptionSchema)
    if (
      generatedQuestion?.type &&
      typeof generatedQuestion.type === "object" &&
      Array.isArray(generatedQuestion.type.options)
    ) {
      generatedQuestion.type.options = generatedQuestion.type.options.map(
        (opt: any) => {
          const score = typeof opt?.score === "number" ? opt.score : 0
          return { ...opt, score }
        }
      )
    }

    // Ensure date questions have format field (required by DateQuestionSchema)
    if (
      generatedQuestion?.type &&
      typeof generatedQuestion.type === "object" &&
      generatedQuestion.type.name === "date" &&
      !generatedQuestion.type.format
    ) {
      generatedQuestion.type.format = "date" // Default to single date format
    }

    // Ensure submissionBehavior exists and is coherent with type
    if (typeof generatedQuestion?.submissionBehavior !== "string") {
      const name = generatedQuestion?.type?.name as
        | "text"
        | "singleChoice"
        | "multipleChoice"
        | "rating"
        | "date"
        | "ranking"
        | "fileUpload"
        | "address"
        | "linearScale"
        | "likertScale"
      const behavior =
        name === "multipleChoice" || name === "address" || name === "ranking"
          ? "manualAnswer"
          : name === "text"
            ? "manualUnclear"
            : "autoAnswer"
      generatedQuestion.submissionBehavior = behavior
    }

    // Ensure label exists (use title if missing)
    if (
      !generatedQuestion.label &&
      typeof generatedQuestion.title === "string"
    ) {
      generatedQuestion.label = generatedQuestion.title
    }

    // Ensure styling.colSpan exists (12 default)
    if (
      !generatedQuestion.styling ||
      typeof generatedQuestion.styling !== "object"
    ) {
      generatedQuestion.styling = { colSpan: 12 }
    } else if (typeof generatedQuestion.styling.colSpan !== "number") {
      generatedQuestion.styling.colSpan = 12
    }

    // Assign page based on question order if not provided (approx. 3 per page)
    if (typeof generatedQuestion.page !== "number") {
      const page = Math.floor(order / 3) + 1
      generatedQuestion.page = page
    }

    dataStream.write({
      type: "data-agent_event",
      data: createAgentEvent(
        "question_schema_generated",
        "progress",
        {
          questionTitle: questionTitle,
          questionIndex: order,
          totalQuestions: totalQuestions,
          question: generatedQuestion,
          message: `Generated question: \"${questionTitle}\"`,
        },
        formId,
        userId,
        getSequence()
      ),
    })

    // Progress handled by workflow - removed raw stream write

    return {
      success: true,
      question: generatedQuestion,
    }
  } catch (error) {
    const errorMessage =
      (error as Error)?.message ||
      `Unknown error generating question: \"${params.questionTitle}\"`

    console.error(`Failed to generate question "${params.questionTitle}":`, {
      error: errorMessage,
      questionType: params.questionType,
      order: params.order,
      fullError: error,
    })

    // Error handled by workflow - removed raw stream write

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Generate multiple questions in parallel
 */
export async function generateQuestionsParallel(
  questionParams: GenerateQuestionParams[],
  dataStream: DataStream,
  formId: string,
  userId: string,
  getSequence: () => number,
  modelId?: string
): Promise<QuestionGenerationResult[]> {
  dataStream.write({
    type: "data-agent_event",
    data: createAgentEvent(
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

  // Progress handled by workflow - removed raw stream write

  const results: QuestionGenerationResult[] = await Promise.all(
    questionParams.map((params) =>
      generateQuestion(params, dataStream, formId, userId, getSequence, modelId)
    )
  )

  // Emit per-question errors to help UI and debugging
  results.forEach((r: QuestionGenerationResult, idx: number) => {
    if (!r.success) {
      dataStream.write({
        type: "data-agent_event",
        data: createAgentEvent(
          "agent_error",
          "error",
          {
            message: `Question ${idx + 1} generation failed`,
            details: r.error,
            recoverable: false,
          },
          formId,
          userId,
          getSequence()
        ),
      })
    }
  })

  // Progress handled by workflow - removed raw stream write

  return results
}
