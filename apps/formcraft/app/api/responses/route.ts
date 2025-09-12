import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserCanAccessFormVersion } from "@/app/lib/middleware/authorization"
import { createServerClient, Json } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    let authResult
    try {
      authResult = await requireAuth(request)
    } catch (error) {
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const searchParam = request.nextUrl.searchParams.get("search")
    const pageParam = request.nextUrl.searchParams.get("page")
    const pageSizeParam = request.nextUrl.searchParams.get("pageSize")

    let filters: Record<string, unknown> = {}
    if (searchParam) {
      try {
        filters = JSON.parse(searchParam)
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid search param" },
          { status: 400 }
        )
      }
    }

    let validQuestionIds: string[] = []
    const formVersionId = filters.form_version_id as string
    if (formVersionId) {
      const hasAccess = await verifyUserCanAccessFormVersion(
        formVersionId,
        authResult.user.id
      )

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: "Unauthorized to view these responses" },
          { status: 403 }
        )
      }

      const { data: formVersion, error: formVersionError } = await supabase
        .from("form_versions")
        .select("questions")
        .eq("version_id", formVersionId)
        .single()

      if (formVersionError) {
        return NextResponse.json(
          { success: false, error: "Failed to fetch form version" },
          { status: 500 }
        )
      }

      let questionsArr: Array<Json> = []
      if (Array.isArray(formVersion.questions)) {
        questionsArr = formVersion.questions
      } else if (typeof formVersion.questions === "string") {
        try {
          questionsArr = JSON.parse(formVersion.questions)
        } catch {
          questionsArr = []
        }
      }
      validQuestionIds = questionsArr
        .filter(
          (q) =>
            q &&
            typeof q === "object" &&
            q !== null &&
            "id" in q &&
            typeof q.id === "string"
        )
        .map((q) => (q as { id: string }).id)
    }

    const allowedSubmissionFilters = [
      "form_version_id",
      "status",
      "user_id",
      "created_at",
      "completed_at",
      "testmode",
    ]
    const submissionFilters: Record<string, unknown> = {}
    const answerFilters: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(filters)) {
      if (allowedSubmissionFilters.includes(key)) {
        // Temporary compatibility: if status is an array, coerce to first value
        if (key === "status" && Array.isArray(value)) {
          submissionFilters[key] = value.length ? value[0] : undefined
        } else {
          submissionFilters[key] = value
        }
      } else if (validQuestionIds.includes(key)) {
        answerFilters[key] = value
      }
    }

    // Defaults
    // If testmode is array ['true','false'] or empty, treat as undefined (Any)
    if (Array.isArray(submissionFilters.testmode)) {
      const arr = submissionFilters.testmode as any[]
      if (arr.length !== 1) delete submissionFilters.testmode
      else submissionFilters.testmode = String(arr[0]) === "true"
    }
    if (submissionFilters.testmode === undefined)
      submissionFilters.testmode = false
    if (submissionFilters.status === undefined) {
      submissionFilters.status = "completed"
    }

    const page = pageParam ? parseInt(pageParam, 10) : 1
    const page_size = pageSizeParam ? parseInt(pageSizeParam, 10) : 20

    const { data: rpcResponseArray, error } = await supabase.rpc(
      "get_filtered_submissions",
      {
        submission_filters: submissionFilters as any,
        answer_filters: answerFilters as any,
        page,
        page_size,
      }
    )

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch form responses" },
        { status: 500 }
      )
    }

    if (!rpcResponseArray || rpcResponseArray.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to process form responses" },
        { status: 500 }
      )
    }

    const result = rpcResponseArray[0]

    return NextResponse.json({
      success: true,
      data: result?.data || [],
      page,
      pageSize: page_size,
      totalCount: result?.total_count || 0,
      totalCompletedCount: result?.total_completed_count || 0,
      totalInProgressCount: result?.total_in_progress_count || 0,
      totalFilteredCount: result?.total_filtered_count || 0,
      completedCount: result?.completed_count || 0,
      inProgressCount: result?.in_progress_count || 0,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch form responses" },
      { status: 500 }
    )
  }
}
