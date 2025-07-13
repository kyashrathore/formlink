import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Define an interface for the message structure from Supabase
interface SupabaseMessage {
  id: string
  role: "user" | "assistant" // Or whatever roles are stored
  content: string
  created_at: string // Assuming ISO string format
}

const paramsSchema = z.object({
  formId: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  // Require authentication
  const { requireAuth, authErrorResponse } = await import(
    "../../../../lib/middleware/auth"
  )
  let authResult
  try {
    authResult = await requireAuth(request)
  } catch (error: any) {
    return authErrorResponse(error)
  }

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)
  const awaitedParams = await params
  const paramsValidation = paramsSchema.safeParse(awaitedParams)

  if (!paramsValidation.success) {
    return NextResponse.json(
      {
        error: "Invalid formId parameter",
        details: paramsValidation.error.format(),
      },
      { status: 400 }
    )
  }

  const { formId } = paramsValidation.data

  // Verify user owns the form
  const { verifyUserOwnsForm } = await import(
    "../../../../lib/middleware/authorization"
  )
  const ownership = await verifyUserOwnsForm(
    formId,
    authResult.user.id,
    authResult.isGuest
  )

  if (!ownership.formExists) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 })
  }

  if (!ownership.isOwner) {
    return NextResponse.json(
      { error: "Unauthorized to access messages for this form" },
      { status: 403 }
    )
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("role, content, created_at, id") // Assuming 'created_at' is the timestamp
    .eq("form_id", formId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching messages from Supabase:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages", details: error.message },
      { status: 500 }
    )
  }

  // Transform to match the expected structure in the frontend store if necessary
  const formattedMessages = messages.map((msg: any) => ({
    id: msg.id, // Keep id if needed for keys
    role: msg.role,
    content: msg.content,
    timestamp: msg.created_at, // Ensure this matches what the store expects
  }))

  return NextResponse.json(formattedMessages, { status: 200 })
}
