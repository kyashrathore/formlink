import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  formId: z.string().uuid().optional(),
  toolkit: z.string().min(1),
})

export async function POST(request: Request) {
  let auth
  try {
    auth = await requireAuth(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }

  const payload = await request.json().catch(() => null)
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload" },
      { status: 400 }
    )
  }

  const { formId, toolkit } = parsed.data

  if (formId) {
    const ownership = await verifyUserOwnsForm(formId, auth.user.id)
    if (!ownership.formExists) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      )
    }
    if (!ownership.isOwner) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this form" },
        { status: 403 }
      )
    }
  }

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  // Best-effort: clear connection row for this user+toolkit
  try {
    await (supabase as any)
      .from("tool_connections")
      .update({
        auth_status: "not_connected",
        connected_account_id: null,
        pending_connection_request_id: null,
      })
      .eq("user_id", auth.user.id)
      .eq("provider", "composio")
      .eq("toolkit", toolkit)
  } catch {}

  return NextResponse.json({ success: true })
}
