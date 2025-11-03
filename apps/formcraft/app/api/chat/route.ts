import { getModel } from "@/app/lib/ai/provider"
import { streamText } from "@/app/lib/ai/tracing"
import { ChatService } from "@/app/lib/chat/services/chat-service"
import { FormService } from "@/app/lib/chat/services/form-service"
import { createChatTools } from "@/app/lib/chat/tools"
import { validateChatRequest } from "@/app/lib/chat/utils/validation"
import logger from "@/app/lib/logger"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import {
  verifyGuestUserLimits,
  verifyUserOwnsForm,
} from "@/app/lib/middleware/authorization"
import { createServerClient, SupabaseClient } from "@formlink/db"
import { loadPrompt } from "@formlink/prompts"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai"
import { customAlphabet } from "nanoid"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

async function ensureFormExists(
  supabase: SupabaseClient,
  formId: string,
  userId: string
) {
  const formService = new FormService(supabase)
  try {
    await formService.ensureFormExists(formId, userId)
    logger.info(`[POST /api/chat] Form ${formId} ensured for user ${userId}`)
  } catch (error) {
    logger.error(`[POST /api/chat] Failed to ensure form exists`, {
      formId,
      userId,
      error,
    })
    throw error
  }
}

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

export async function POST(req: NextRequest) {
  const reqId = `chat-${nanoid(8)}`
  const startedAt = Date.now()
  logger.info("[POST /api/chat] Incoming request", {
    reqId,
    method: req.method,
    url: req.url,
  })
  try {
    let authResult
    try {
      logger.info("[POST /api/chat] Authenticating", { reqId })
      authResult = await requireAuth(req)
      logger.info("[POST /api/chat] Authenticated", {
        reqId,
        userId: authResult.user.id,
        isGuest: authResult.isGuest,
      })
    } catch (error) {
      logger.warn("[POST /api/chat] Authentication failed", {
        reqId,
        error: error instanceof Error ? error.message : String(error),
      })
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
    }

    const body = await req.json()
    const {
      messages,
      formId: initialFormId,
      options,
    } = validateChatRequest(body)
    // Normalize selected model: accept either top-level `selectedModel` or `options.model`
    const selectedModel = body?.selectedModel || (options as any)?.model
    // Allow toggling single-pass via query param; default depends on model:
    // - cerebras/gpt-oss-120b (or unspecified → defaults to cerebras): singlePass=true
    // - all other models: singlePass=false
    const url = new URL(req.url)
    const qpSingle = url.searchParams.get("singlePass")
    let resolvedSinglePass: boolean
    if (qpSingle != null) {
      resolvedSinglePass = qpSingle === "true" || qpSingle === "1"
    } else if (typeof (options as any)?.singlePass === "boolean") {
      resolvedSinglePass = Boolean((options as any)?.singlePass)
    } else {
      const modelStr =
        typeof selectedModel === "string" ? selectedModel : undefined
      // Default to single-pass if model is cerebras/gpt-oss-120b or not specified (app default is cerebras)
      const isCerebras120b = !modelStr || modelStr.includes("gpt-oss-120b")
      resolvedSinglePass = isCerebras120b
    }
    const normalizedOptions = {
      ...(options as any),
      model: selectedModel,
      singlePass: resolvedSinglePass,
    }
    logger.info("[POST /api/chat] Request validated", {
      reqId,
      formId: initialFormId,
      messagesCount: Array.isArray(messages) ? messages.length : 0,
      intent: (normalizedOptions as any)?.intent,
      responseIntelligence: Boolean(
        (normalizedOptions as any)?.responseIntelligence
      ),
      maxOutputTokens: (normalizedOptions as any)?.maxOutputTokens,
      model: (normalizedOptions as any)?.model,
      singlePass: Boolean((normalizedOptions as any)?.singlePass),
    })

    const userId = authResult.user.id
    const isGuest = authResult.isGuest

    if (isGuest && !initialFormId) {
      logger.info("[POST /api/chat] Verifying guest limits", { reqId, userId })
      const { withinLimits, reason } = await verifyGuestUserLimits(userId)
      if (!withinLimits) {
        logger.warn("[POST /api/chat] Guest limit exceeded", {
          reqId,
          userId,
          reason,
        })
        return NextResponse.json(
          { error: reason || "Guest user limits exceeded" },
          { status: 403 }
        )
      }
    }

    const cookieStore = await cookies()
    logger.info("[POST /api/chat] Creating Supabase client", { reqId })
    const supabase = await createServerClient(cookieStore)
    logger.info("[POST /api/chat] Supabase client created", { reqId })

    logger.info("[POST /api/chat] Starting chat stream via handler", {
      reqId,
      userId,
      formId: initialFormId,
    })
    const currentFormId = initialFormId || `form_${nanoid()}`

    await ensureFormExists(supabase, currentFormId, userId)

    const chatDB = new ChatService(supabase)
    const cookieHeader = req.headers.get("cookie") ?? undefined

    // Persist the last user message as-is
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === "user") {
      await chatDB.saveMessage(currentFormId, userId, lastUserMessage)
    }

    let writerRef: any = null
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          writerRef = writer as any
          chatDB.writeStreamEvent(writer as any, "chat_initialized")

          const toolContext = {
            dataStream: writer as any, // Cast to 'any' to avoid type mismatch
            formId: currentFormId,
            supabase,
            userId,
            options: normalizedOptions,
            isFirstMessage: messages.length <= 1,
            cookieHeader,
          }

          const tools = createChatTools(toolContext)
          const intent = (normalizedOptions as any)?.intent || "general"
          const riFlag = Boolean(
            (normalizedOptions as any)?.responseIntelligence
          )
          const systemTemplate =
            process.env.CODEGEN_PREVIEW_UI === "true"
              ? "chat/codegen-system.md"
              : (normalizedOptions as any)?.singlePass
                ? "chat/form-creation-system_single-pass_v1.md"
                : "chat/form-creation-system.md"
          const system = await loadPrompt(systemTemplate, {
            session_form_id: currentFormId,
            session_intent: intent,
            ri_requested: riFlag,
            // Include guardrails only for user-facing chat endpoint
            include_guards: true,
          })
          const MODEL = getModel(normalizedOptions?.model)
          const result = await streamText({
            model: MODEL,
            messages: convertToModelMessages(messages as any),
            tools,
            system,
            maxOutputTokens: normalizedOptions?.maxOutputTokens ?? 2000,
            toolChoice: "auto",
            stopWhen({ steps }) {
              // Stop if `createForm` has been successfully called and produced a result.
              const hasCreateFormResult = steps.some((s) =>
                s.toolResults?.some(
                  (tr) =>
                    tr.toolName === "createForm" &&
                    "result" in tr &&
                    tr.result != null
                )
              )
              return steps.length > 10 || hasCreateFormResult
            },
          })

          writer.merge(result.toUIMessageStream())
        } catch (executeError) {
          logger.error("Error in chat stream execution", {
            userId,
            formId: currentFormId,
            error: executeError,
          })
        }
      },
      onFinish: async ({ messages: finalMessages }) => {
        // The last message in the stream is the complete assistant message
        const assistantMessage = finalMessages[finalMessages.length - 1]

        if (assistantMessage && assistantMessage.role === "assistant") {
          try {
            await chatDB.saveMessage(currentFormId, userId, assistantMessage)
            logger.info("Assistant message saved successfully", {
              formId: currentFormId,
              userId,
            })
          } catch (error) {
            logger.error("Error saving assistant message", {
              formId: currentFormId,
              userId,
              error,
            })
          }
        }
        if (writerRef && typeof writerRef.write === "function") {
          chatDB.writeStreamEvent(writerRef, "chat_completed")
        }
      },
      onError: (error) => {
        logger.error("Error in chat stream:", { error })
        return error instanceof Error ? error.message : String(error)
      },
    })

    const res = createUIMessageStreamResponse({ stream })
    const durationMs = Date.now() - startedAt
    logger.info("[POST /api/chat] Chat stream initialized", {
      reqId,
      durationMs,
      status: (res as any)?.status,
    })
    try {
      ;(res as any)?.headers?.set?.("x-request-id", reqId)
    } catch {}
    return res
  } catch (error) {
    const durationMs = Date.now() - startedAt
    logger.error("[POST /api/chat] Unhandled error", {
      reqId,
      durationMs,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    })

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "x-request-id": reqId },
      }
    )
  }
}

export async function GET(req: NextRequest) {
  const reqId = `chat-get-${nanoid(8)}`
  const startedAt = Date.now()
  logger.info("[GET /api/chat] Incoming history request", {
    reqId,
    method: req.method,
    url: req.url,
  })
  let authResult
  try {
    logger.info("[GET /api/chat] Authenticating", { reqId })
    authResult = await requireAuth(req)
    logger.info("[GET /api/chat] Authenticated", {
      reqId,
      userId: authResult.user.id,
      isGuest: authResult.isGuest,
    })
  } catch (error) {
    logger.warn("[GET /api/chat] Authentication failed", {
      reqId,
      error: error instanceof Error ? error.message : String(error),
    })
    return authErrorResponse({
      name: "AuthError",
      message: error instanceof Error ? error.message : "Authentication failed",
      statusCode: 401,
    })
  }

  const { searchParams } = new URL(req.url)
  const formId = searchParams.get("formId")
  logger.info(
    `[GET /api/chat] Request for history. Received formId: '${formId}', userId: ${authResult.user.id}`
  )

  if (!formId) {
    logger.warn("[GET /api/chat] Missing formId parameter", { reqId })
    return new Response(JSON.stringify({ error: "Missing formId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "x-request-id": reqId },
    })
  }

  try {
    logger.info("[GET /api/chat] Verifying ownership", {
      reqId,
      formId,
      userId: authResult.user.id,
    })
    const ownership = await verifyUserOwnsForm(formId, authResult.user.id)

    if (!ownership.formExists) {
      logger.warn("[GET /api/chat] Form not found", { reqId, formId })
      return new Response(JSON.stringify({ error: "Form not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "x-request-id": reqId },
      })
    }

    if (!ownership.isOwner) {
      logger.warn("[GET /api/chat] Unauthorized access to form", {
        reqId,
        formId,
        userId: authResult.user.id,
      })
      return new Response(
        JSON.stringify({ error: "Unauthorized to access this form" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": reqId,
          },
        }
      )
    }

    const cookieStore = await cookies()
    logger.info("[GET /api/chat] Creating Supabase client", { reqId })
    const supabase = await createServerClient(cookieStore)
    logger.info("[GET /api/chat] Supabase client created", { reqId })
    const chatService = new ChatService(supabase)

    logger.info("[GET /api/chat] Fetching chat history", { reqId, formId })
    const data = await chatService.getChatHistory(formId)
    const durationMs = Date.now() - startedAt
    logger.info("[GET /api/chat] History fetched", {
      reqId,
      formId,
      messagesCount: data.length,
      durationMs,
    })

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "x-request-id": reqId },
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    logger.error("[GET /api/chat] Unexpected error", {
      reqId,
      formId,
      durationMs,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    })
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "x-request-id": reqId },
      }
    )
  }
}
