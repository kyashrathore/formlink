import { ChatService } from "@/app/lib/chat/services/chat-service"
import { validateChatRequest } from "@/app/lib/chat/utils/validation"
import logger from "@/app/lib/logger"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import {
  verifyGuestUserLimits,
  verifyUserOwnsForm,
} from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { handleChatRequest } from "./handlers"
import { customAlphabet } from "nanoid"

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
    logger.info("[POST /api/chat] Request validated", {
      reqId,
      formId: initialFormId,
      messagesCount: Array.isArray(messages) ? messages.length : 0,
      intent: (options as any)?.intent,
      responseIntelligence: Boolean((options as any)?.responseIntelligence),
      maxOutputTokens: (options as any)?.maxOutputTokens,
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
    const res = await handleChatRequest(
      messages as any,
      initialFormId,
      userId,
      supabase as any,
      options
    )
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
      error: error instanceof Error
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
          headers: { "Content-Type": "application/json", "x-request-id": reqId },
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
      error: error instanceof Error
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
