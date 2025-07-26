import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const awaitedParams = await params
    const formId = awaitedParams?.formId

    if (!formId) {
      return NextResponse.json(
        { error: "Form ID is required" },
        { status: 400 }
      )
    }

    const { requireAuth, authErrorResponse } = await import(
      "../../../../lib/middleware/auth"
    )
    let authResult
    try {
      authResult = await requireAuth(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const { data: formOwner, error: ownerError } = await supabase
      .from("forms")
      .select("user_id")
      .eq("id", formId)
      .single()

    if (ownerError || !formOwner) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    if (formOwner.user_id !== authResult.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data: formData, error: formError } = await supabase
      .from("forms")
      .select("short_id")
      .eq("id", formId)
      .single()

    if (formError) {
      return NextResponse.json(
        { error: "Database error: " + formError.message },
        { status: 500 }
      )
    }

    if (!formData) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    return NextResponse.json({ shortId: formData.short_id })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Internal server error: " +
          (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 }
    )
  }
}
