import { requireAuth } from "@/app/lib/middleware/auth"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  try {
    await requireAuth(req)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }

  const { formId } = await context.params
  try {
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    // Fetch form to get current version ids
    const { data: formRow } = await (supabase as any)
      .from("forms")
      .select("current_published_version_id, current_draft_version_id")
      .eq("id", formId)
      .maybeSingle()

    const publishedId = (formRow as any)?.current_published_version_id
    const draftId = (formRow as any)?.current_draft_version_id
    const versionId = publishedId || draftId
    if (!versionId) {
      return NextResponse.json({ success: true, questions: [] })
    }

    const { data: version } = await (supabase as any)
      .from("form_versions")
      .select("questions, status")
      .eq("version_id", versionId)
      .maybeSingle()

    let questions: any[] = []
    const raw = (version as any)?.questions
    if (Array.isArray(raw)) questions = raw
    else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) questions = parsed
      } catch {}
    }

    const simplified = questions
      .filter((q) => q && q.id)
      .map((q) => ({
        id: q.id,
        label: q.label || q.title || q.id,
        type: q.type || undefined,
      }))

    return NextResponse.json({ success: true, questions: simplified })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
