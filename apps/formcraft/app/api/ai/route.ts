import { getModel } from "@/app/lib/ai/provider"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import {
  ADD_QUESTION_PROMPT,
  CONDITIONS_PROMPT,
  GENERATE_EXPRESSION_PROMPT,
  SANITIZE_RESULT_GENERATION_PROMPT,
  VALIDATIONS_PROMPT,
} from "@/app/lib/prompts"
import {
  Option,
  Question,
  QuestionSchema,
  QuestionValidations,
  QuestionValidationsSchema,
} from "@formlink/schema"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

const validationRuleSystemPrompt = VALIDATIONS_PROMPT
const addQuestionSystemPrompt = ADD_QUESTION_PROMPT
const generateJSONataExpressionPrompt = GENERATE_EXPRESSION_PROMPT
const sanitizeResultGenerationPrompt = SANITIZE_RESULT_GENERATION_PROMPT
const conditionsPrompt = CONDITIONS_PROMPT

// Removed - using provider utility instead

// Use provider utility - using vercel to avoid Azure issues

const RESPONSE_PLAN_SUGGESTIONS_PROMPT = `You are a helpful analytics assistant in FormLink. A user has a form with collected responses and is viewing the Responses tab. You must return a JSON object with a \\\"suggestions\\\" array containing up to 5 short, natural-language prompt ideas (each <= 120 characters) that they can ask the assistant to generate a response intelligence plan. Tailor the suggestions to the form's title, description, and question types, covering filters, segments, charts, or insights they might explore. The response MUST be valid JSON.`

export const maxDuration = 20

type AIPromptQuestion = {
  id: string
  title: string
  questionType: string
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
  switch (question.type.name) {
    case "text":
    case "singleChoice":
    case "date":
      return "string"
    case "rating":
    case "linearScale":
    case "likertScale":
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
    questionType: q.type.name,
    options: (q.type as { options?: Option[] }).options,
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
    | "response-plan-suggestions"
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
    | { suggestions: string[] }
}

export async function POST(req: Request) {
  try {
    try {
      await requireAuth(req)
    } catch (error) {
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
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

    let systemPrompt = ""
    let responseSchema: z.ZodSchema = z.object({})

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

      case "response-plan-suggestions":
        systemPrompt = RESPONSE_PLAN_SUGGESTIONS_PROMPT
        responseSchema = z.object({
          suggestions: z.array(z.string().min(1)).min(1).max(5),
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
            : operationType === "response-plan-suggestions"
              ? JSON.stringify({
                  user_prompt: prompt,
                  form_details,
                  questions: transformedQuestions,
                })
              : `
user_prompt: ${prompt}

questions: ${transformedQuestions}
`

    const { object: aiResponseText } = await generateObject({
      model: getModel(),
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
    } else if (operationType === "response-plan-suggestions") {
      return NextResponse.json<AIResponse>(
        {
          error: false,
          message: null,
          data: { suggestions: aiResponseData.suggestions },
        },
        { status: 200 }
      )
    } else if (operationType === "validation") {
      const finalSchema: Partial<QuestionValidations>[] = []
      let allValidationsSuccessful = true

      const schemaList =
        typeof aiResponseData.schema === "string"
          ? JSON.parse(aiResponseData.schema)
          : aiResponseData.schema
      if (!Array.isArray(schemaList)) {
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
            }
          } catch {
            allValidationsSuccessful = false
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
  } catch (err) {
    const error = err as Error & { code?: string }

    if (error.code === "DAILY_LIMIT_REACHED") {
      return NextResponse.json<AIResponse>(
        { error: true, message: error.message ?? "" },
        { status: 403 }
      )
    }

    return NextResponse.json<AIResponse>(
      { error: true, message: error.message ?? "Internal server error" },
      { status: 500 }
    )
  }
}
