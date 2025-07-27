import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
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

  const awaitedParams = await params
  const formId = awaitedParams?.formId

  if (!formId) {
    return NextResponse.json({ error: "Form ID is required" }, { status: 400 })
  }

  try {
    const ownership = await verifyUserOwnsForm(formId, authResult.user.id)

    if (!ownership.formExists) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    if (!ownership.isOwner) {
      return NextResponse.json(
        { error: "Unauthorized to publish this form" },
        { status: 403 }
      )
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const { data: formData, error: formError } = await supabase
      .from("forms")
      .select("current_draft_version_id")
      .eq("id", formId)
      .single()

    if (formError || !formData) {
      const msg = formError?.message || "Form not found"
      return NextResponse.json({ error: msg }, { status: 404 })
    }

    const draftVersionId = formData.current_draft_version_id

    if (!draftVersionId) {
      return NextResponse.json(
        { error: "No draft version available to publish" },
        { status: 404 }
      )
    }

    const { error: publishError } = await supabase
      .from("form_versions")
      .update({ status: "published" })
      .eq("version_id", draftVersionId)
      .eq("status", "draft")

    if (publishError) {
      return NextResponse.json(
        { error: publishError.message || "Failed to publish draft version" },
        { status: 500 }
      )
    }

    const { error: updateFormError } = await supabase
      .from("forms")
      .update({
        current_published_version_id: draftVersionId,
        current_draft_version_id: null,
      })
      .eq("id", formId)

    if (updateFormError) {
      return NextResponse.json(
        { error: updateFormError.message || "Failed to update form record" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      published_version_id: draftVersionId,
      message: "Form published successfully",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
