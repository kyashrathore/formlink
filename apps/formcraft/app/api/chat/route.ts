import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { ChatService } from "../../lib/chat/services/chat-service"
import { validateChatRequest } from "../../lib/chat/utils/validation"
import logger from "../../lib/logger"
import { handleChatRequest } from "./handlers"

// POST handler for chat messages
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const {
      messages,
      formId: initialFormId,
      options,
    } = validateChatRequest(body)

    // Use authenticated user's ID
    const userId = authResult.user.id
    const isGuest = authResult.isGuest

    // Check guest limits if applicable
    if (isGuest && !initialFormId) {
      const { verifyGuestUserLimits } = await import(
        "../../lib/middleware/authorization"
      )
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

    // Handle the chat request
    return await handleChatRequest(
      messages,
      initialFormId,
      userId,
      supabase,
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

// GET handler for fetching chat history
export async function GET(req: NextRequest) {
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
    // Verify user owns the form
    const { verifyUserOwnsForm } = await import(
      "../../lib/middleware/authorization"
    )
    const ownership = await verifyUserOwnsForm(
      formId,
      authResult.user.id,
      authResult.isGuest
    )

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
  } catch (error: any) {
    logger.error("Unexpected error in /api/chat GET (history)", {
      formId,
      error,
    })
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
