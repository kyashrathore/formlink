import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({
  formId: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  let authResult
  try {
    authResult = await requireAuth(request)
  } catch (error) {
    return authErrorResponse({
      name: "AuthError",
      message: error instanceof Error ? error.message : "Authentication failed",
      statusCode: 401,
    })
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

  const ownership = await verifyUserOwnsForm(
    formId,
    authResult.user.id as string
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
    .select("role, content, created_at, id")
    .eq("form_id", formId as string)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch messages", details: error.message },
      { status: 500 }
    )
  }

  const formattedMessages = messages.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.created_at,
  }))

  return NextResponse.json(formattedMessages, { status: 200 })
}
