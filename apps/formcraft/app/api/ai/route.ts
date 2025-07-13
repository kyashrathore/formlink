import {
  ADD_QUESTION_PROMPT,
  CONDITIONS_PROMPT,
  GENERATE_EXPRESSION_PROMPT,
  SANITIZE_RESULT_GENERATION_PROMPT,
  VALIDATIONS_PROMPT,
} from "@/app/lib/prompts"
import { getenv } from "@/lib/env"
import {
  Option,
  Question,
  QuestionSchema,
  QuestionValidations,
  QuestionValidationsSchema,
} from "@formlink/schema"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

const validationRuleSystemPrompt = VALIDATIONS_PROMPT
const addQuestionSystemPrompt = ADD_QUESTION_PROMPT
const generateJSONataExpressionPrompt = GENERATE_EXPRESSION_PROMPT
const sanitizeResultGenerationPrompt = SANITIZE_RESULT_GENERATION_PROMPT
const conditionsPrompt = CONDITIONS_PROMPT

const openRouterProvider = createOpenRouter({
  apiKey: getenv("OPENROUTER_API_KEY") || "",
})

const MODEL = openRouterProvider("openai/gpt-4.1")

export const maxDuration = 20

type AIPromptQuestion = {
  id: string
  title: string
  questionType: Question["questionType"]
  options?: Option[]
  _derived_dataType_:
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "array_string"
    | "array_number"
    | "object"
    | "unknown"
}

function getDerivedDataType(
  question: Question
): AIPromptQuestion["_derived_dataType_"] {
  switch (question.questionType) {
    case "text":
    case "singleChoice":
    case "date":
      return "string"
    case "rating":
    case "linearScale":
      return "number"
    case "multipleChoice":
      return "array_string"
    case "address":
      return "object"
    case "fileUpload":
      return "object"
    case "ranking":
      return "array_string"
    default:
      if ((question as any).display?.inputType === "number") return "number"
      return "unknown"
  }
}

function transformQuestionsForAI(
  questions: Question[] | undefined
): AIPromptQuestion[] | undefined {
  if (!questions) return undefined
  return questions.map((q) => ({
    id: q.id,
    title: q.title,
    questionType: q.questionType,
    options: (q as any).options,
    _derived_dataType_: getDerivedDataType(q),
  }))
}

type AIRequest = {
  operationType:
    | "conditional"
    | "validation"
    | "add-question"
    | "generate-compute-field-expression"
    | "sanitize_result_generation"
  prompt: string
  questions?: Question[]
  currentQuestionId?: string
  form_details?: {
    title: string
    description: string
    questions: Question[]
  }
}

const JSONataExpressionResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string(),
  jsonataExpression: z.string().nullable(),
})

type JSONataExpressionData = { jsonataExpression: string }
type AIResponse = {
  error: boolean
  message?: string | null
  data?:
    | Partial<QuestionValidations>[]
    | Question
    | JSONataExpressionData
    | { isValid: boolean }
}

export async function POST(req: Request) {
  try {
    // Require authentication
    const { requireAuth, authErrorResponse } = await import(
      "../../lib/middleware/auth"
    )
    let authResult
    try {
      authResult = await requireAuth(req)
    } catch (error: any) {
      return authErrorResponse(error)
    }

    const {
      operationType,
      prompt,
      questions,
      currentQuestionId,
      form_details,
    } = (await req.json()) as Omit<AIRequest, "userId" | "isAuthenticated">

    if (!operationType || !prompt) {
      return NextResponse.json(
        {
          error: true,
          message: "Missing required information (operation type or prompt)",
        },
        { status: 400 }
      )
    }

    // Use authenticated user's ID
    const userId = authResult.user.id
    const isAuthenticated = !authResult.isGuest

    let systemPrompt = ""
    let responseSchema: any = {}

    const transformedQuestions = transformQuestionsForAI(questions)

    switch (operationType) {
      case "conditional":
        systemPrompt = conditionsPrompt as string
        responseSchema = JSONataExpressionResponseSchema
        break
      case "generate-compute-field-expression":
        systemPrompt = generateJSONataExpressionPrompt as string
        responseSchema = JSONataExpressionResponseSchema
        break
      case "validation":
        systemPrompt = validationRuleSystemPrompt as string
        responseSchema = z.object({
          valid: z.boolean(),
          message: z.string().optional(),
          schema: z.array(QuestionValidationsSchema.partial()),
        })
        break
      case "add-question":
        systemPrompt = addQuestionSystemPrompt as string
        responseSchema = z.object({
          valid: z.boolean(),
          message: z.string(),
          question: QuestionSchema.optional(),
        })
        break
      case "sanitize_result_generation":
        systemPrompt = sanitizeResultGenerationPrompt as string
        responseSchema = z.object({
          isValid: z.boolean(),
          message: z.string(),
        })
        break

      default:
        return NextResponse.json(
          {
            error: true,
            message: "Invalid operation type",
          },
          { status: 400 }
        )
    }

    const promptContent =
      operationType === "add-question"
        ? `User request: "${prompt}"\n\nExisting Questions:${transformedQuestions ? "\n" + JSON.stringify(transformedQuestions, null, 2) : " None"}`
        : operationType === "conditional"
          ? JSON.stringify({
              user_prompt: prompt,
              target_question_id: currentQuestionId,
              questions: transformedQuestions,
            })
          : operationType === "sanitize_result_generation"
            ? JSON.stringify({
                user_prompt: prompt,
                form_details: form_details,
                questions: transformedQuestions,
              })
            : `
user_prompt: ${prompt}

questions: ${transformedQuestions}
`

    const { object: aiResponseText } = await generateObject({
      model: MODEL,
      schema: responseSchema,
      system: systemPrompt as string,
      prompt: promptContent,
    })

    const aiResponseParseResult = responseSchema.safeParse(aiResponseText)

    if (!aiResponseParseResult.success) {
      return NextResponse.json<AIResponse>(
        {
          error: true,
          message: "Could not process AI response. Invalid format.",
        },
        { status: 200 }
      )
    }

    const aiResponseData = aiResponseParseResult.data

    if (operationType === "add-question") {
      if (aiResponseData.valid && aiResponseData.question) {
        return NextResponse.json<AIResponse>(
          { error: false, message: null, data: aiResponseData.question },
          { status: 200 }
        )
      } else {
        return NextResponse.json<AIResponse>(
          { error: true, message: aiResponseData.message ?? "" },
          { status: 200 }
        )
      }
    } else if (
      operationType === "conditional" ||
      operationType === "generate-compute-field-expression"
    ) {
      const jsonData = aiResponseData as z.infer<
        typeof JSONataExpressionResponseSchema
      >
      if (jsonData.valid && jsonData.jsonataExpression) {
        return NextResponse.json<AIResponse>(
          {
            error: false,
            message: null,
            data: { jsonataExpression: jsonData.jsonataExpression },
          },
          { status: 200 }
        )
      } else {
        return NextResponse.json<AIResponse>(
          {
            error: true,
            message:
              jsonData.message ??
              `AI could not generate a valid JSONata expression for ${operationType}.`,
          },
          { status: 200 }
        )
      }
    } else if (operationType === "sanitize_result_generation") {
      return NextResponse.json<AIResponse>(
        {
          error: !aiResponseData.isValid,
          message: aiResponseData.message,
          data: { isValid: aiResponseData.isValid },
        },
        { status: 200 }
      )
    } else if (operationType === "validation") {
      const finalSchema: Partial<QuestionValidations>[] = [] as any
      let allValidationsSuccessful = true

      const schemaList =
        typeof aiResponseData.schema === "string"
          ? JSON.parse(aiResponseData.schema)
          : aiResponseData.schema
      if (!Array.isArray(schemaList)) {
        // console.error(
        //   "Expected schema to be an array for validation type, but received:",
        // typeof schemaList
        // )
        allValidationsSuccessful = false
      } else {
        for (const singleSchema of schemaList) {
          try {
            const schemaValidationResult =
              QuestionValidationsSchema.partial().safeParse(singleSchema)

            if (schemaValidationResult.success) {
              ;(finalSchema as Partial<QuestionValidations>[]).push(
                schemaValidationResult.data
              )
            } else {
              allValidationsSuccessful = false
              // console.error(
              //   "Validation schema parse failed for item:",
              //   schemaValidationResult.error.format()
              // )
              // console.error(
              //   "Raw AI schema data type for item:",
              //   typeof singleSchema
              // )
              // console.error("Raw AI schema data for item:", singleSchema)
            }
          } catch (e) {
            allValidationsSuccessful = false
            // console.error("Failed to parse schema string for item:", e)
            // console.error("Raw AI schema data for item:", singleSchema)
          }
        }
      }
      if (allValidationsSuccessful) {
        return NextResponse.json<AIResponse>(
          { error: false, message: null, data: finalSchema },
          { status: 200 }
        )
      } else {
        return NextResponse.json<AIResponse>(
          {
            error: true,
            message:
              aiResponseData.message ??
              "AI returned a valid rule but one or more generated schemas were invalid.",
          },
          { status: 200 }
        )
      }
    } else if (operationType === "computeField") {
      if (aiResponseData.valid && aiResponseData.jsonataExpression) {
        return NextResponse.json<AIResponse>(
          {
            error: false,
            message: null,
            data: { jsonataExpression: aiResponseData.jsonataExpression },
          },
          { status: 200 }
        )
      } else {
        return NextResponse.json<AIResponse>(
          {
            error: true,
            message:
              aiResponseData.message ??
              "AI could not generate a valid JSONata expression.",
          },
          { status: 200 }
        )
      }
    }

    return NextResponse.json<AIResponse>(
      { error: true, message: "Operation processing failed" },
      { status: 500 }
    )
  } catch (err: any) {
    // console.error("Error in /api/ai:", err)

    if (err.code === "DAILY_LIMIT_REACHED") {
      return NextResponse.json<AIResponse>(
        { error: true, message: err.message ?? "" },
        { status: 403 }
      )
    }

    return NextResponse.json<AIResponse>(
      { error: true, message: err.message ?? "Internal server error" },
      { status: 500 }
    )
  }
}
