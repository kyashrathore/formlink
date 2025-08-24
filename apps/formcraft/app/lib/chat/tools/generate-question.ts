import { Question, QuestionSchema } from "@formlink/schema"
import { generateObject } from "ai"
import { getModel } from "../../ai/provider"
import { CREATE_FORM_REPAIR_SYSTEM_PROMPT } from "../../prompts"
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
  systemPrompt: string,
  formId: string,
  userId: string,
  getSequence: () => number
): Promise<QuestionGenerationResult> {
  try {
    const { questionTitle, questionType, order, totalQuestions, formContext } =
      params

    if (!systemPrompt || systemPrompt.trim() === "") {
      throw new Error("System prompt is required for question generation")
    }

    // Progress handled by workflow - removed raw stream write

    let userPrompt = `Generate a complete JSON schema for the question: \"${questionTitle}\" (type: ${questionType}). This is question ${
      order + 1
    } of ${totalQuestions}.`

    if (formContext) {
      userPrompt += `\n\nForm context:\nTitle: ${formContext.title}\nDescription: ${formContext.description}`
    }

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
      const { object: repaired } = await generateObject({
        model: getModel("gpt-4o-mini", "vercel"), // Using Vercel AI Gateway to avoid Azure JSON Schema issues
        schema: QuestionSchema,
        mode: "json",
        system: CREATE_FORM_REPAIR_SYSTEM_PROMPT as string,
        experimental_repairText:
          remainingRepairs > 0 ? repairFunction : undefined,
        prompt: `
          Repair the following JSON schema based on the error: ${JSON.stringify(
            error
          )}
          Original question context:
          - Form Title: ${formContext?.title ?? ""}
          - Form Description: ${formContext?.description ?? ""}
          - Question Text: ${questionTitle}
          - Question Type: ${questionType}
          
          Faulty JSON:
          ${text}
        `,
      })
      return JSON.stringify(repaired)
    }

    // Enrich the system prompt to match the current QuestionSchema shape (discriminated union under "type")
    const enrichedSystemPrompt = `
${systemPrompt}

CRITICAL SCHEMA SHAPE (align with @formlink/schema):
- The question uses "type" as a discriminated union object:
  {
    "type": {
      "name": "text" | "singleChoice" | "multipleChoice" | "rating" | "date" | "ranking" | "fileUpload" | "address" | "linearScale" | "likertScale",
      // Per-type properties:
      // text:          { "name":"text", "format":"text"|"email"|"url"|"tel"|"number"|"password"|"country" }
      // singleChoice:  { "name":"singleChoice",  "display": "radio"|"dropdown",              "options":[{ "value":string, "label":string, "score":number }] }
      // multipleChoice:{ "name":"multipleChoice","display": "checkbox"|"multiSelectDropdown", "options":[{ "value":string, "label":string, "score":number }] }
      // rating:        { "name":"rating",       "config":      { "min":number, "max":number (>min), "step":number, "minLabel"?:string, "maxLabel"?:string } }
      // linearScale:   { "name":"linearScale",  "config": { "start":number, "end":number (>start), "step":number, "startLabel"?:string, "endLabel"?:string } }
      // ranking:       { "name":"ranking",      "options":[{ "value":string, "label":string, "score":number }] }
      // fileUpload:    { "name":"fileUpload" }
      // address:       { "name":"address" }
      // likertScale:   { "name":"likertScale",  "options": string[] } // 2-7 labels
    }
  }

Top-level fields:
- "id": string (e.g., "q${order + 1}_keyword1_keyword2")
- "questionNo": number (use ${order + 1})
- "title": string (exactly the question text)
- "description"?: string
- "validations"?: Partial rules; each rule object contains { value, message?, originalText? }
- "defaultValue"?: appropriate type
- "submissionBehavior": "autoAnswer" | "manualAnswer" | "manualUnclear"
  Guidance:
    manualAnswer: multipleChoice, address, ranking
    manualUnclear: text (and number-like text when unsure)
    autoAnswer: singleChoice, rating, date, fileUpload, linearScale, likertScale
- "styling" defaults to { "colSpan": 12 } if omitted.

Notes:
- For choice questions, include options with a numeric "score" (use 0 if not scoring).
- Ensure configs (rating/linearScale/ranking) are present when required by the type.
`

    const generateSchemaResult = await generateObject({
      model: getModel("gpt-4o-mini", "vercel"), // Using Vercel AI Gateway to avoid Azure JSON Schema issues
      schema: QuestionSchema,
      mode: "json",
      system: enrichedSystemPrompt,
      prompt: userPrompt,
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
  systemPrompt: string,
  formId: string,
  userId: string,
  getSequence: () => number
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

  const successCount = results.filter((r) => r.success).length
  const errorCount = results.filter((r) => !r.success).length

  // Progress handled by workflow - removed raw stream write

  return results
}
