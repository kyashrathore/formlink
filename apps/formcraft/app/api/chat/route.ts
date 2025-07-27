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

export async function POST(req: NextRequest) {
  try {
    let authResult
    try {
      authResult = await requireAuth(req)
    } catch (error) {
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

    const userId = authResult.user.id
    const isGuest = authResult.isGuest

    if (isGuest && !initialFormId) {
      const { withinLimits, reason } = await verifyGuestUserLimits(userId)
      if (!withinLimits) {
        return NextResponse.json(
          { error: reason || "Guest user limits exceeded" },
          { status: 403 }
        )
      }
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    return await handleChatRequest(
      messages as any,
      initialFormId,
      userId,
      supabase as any,
      options
    )
  } catch (error) {
    logger.error("Error in /api/chat POST:", { error })

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

export async function GET(req: NextRequest) {
  let authResult
  try {
    authResult = await requireAuth(req)
  } catch (error) {
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
    return new Response(JSON.stringify({ error: "Missing formId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const ownership = await verifyUserOwnsForm(formId, authResult.user.id)

    if (!ownership.formExists) {
      return new Response(JSON.stringify({ error: "Form not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!ownership.isOwner) {
      return new Response(
        JSON.stringify({ error: "Unauthorized to access this form" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const chatService = new ChatService(supabase)

    const data = await chatService.getChatHistory(formId)
    logger.info(
      `[GET /api/chat] Found ${data.length} messages for formId '${formId}'.`
    )

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    logger.error("Unexpected error in /api/chat GET (history)", {
      formId,
      error,
    })
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
