import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const { requireAuth, authErrorResponse } = await import(
      "../../lib/middleware/auth"
    )
    let authResult
    try {
      authResult = await requireAuth(request)
    } catch (error: any) {
      return authErrorResponse(error)
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const searchParam = request.nextUrl.searchParams.get("search")
    const pageParam = request.nextUrl.searchParams.get("page")
    const pageSizeParam = request.nextUrl.searchParams.get("pageSize")

    let filters: Record<string, any> = {}
    if (searchParam) {
      try {
        filters = JSON.parse(searchParam)
      } catch (e) {
        return NextResponse.json(
          { success: false, error: "Invalid search param" },
          { status: 400 }
        )
      }
    }

    let validQuestionIds: string[] = []
    const formVersionId = filters.form_version_id
    if (formVersionId) {
      // Verify user has access to this form version
      const { verifyUserCanAccessFormVersion } = await import(
        "../../lib/middleware/authorization"
      )
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

      let questionsArr: any[] = []
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
        .filter((q) => q && typeof q.id === "string")
        .map((q) => q.id)
    }

    const allowedSubmissionFilters = [
      "form_version_id",
      "status",
      "user_id",
      "created_at",
      "completed_at",
      "testmode",
    ]
    const submissionFilters: Record<string, any> = {}
    const answerFilters: Record<string, any> = {}

    for (const [key, value] of Object.entries(filters)) {
      if (allowedSubmissionFilters.includes(key)) {
        submissionFilters[key] = value
      } else if (validQuestionIds.includes(key)) {
        answerFilters[key] = value
      }
    }

    const page = pageParam ? parseInt(pageParam, 10) : 1
    const page_size = pageSizeParam ? parseInt(pageSizeParam, 10) : 20

    const { data: rpcResponseArray, error } = await supabase.rpc(
      "get_filtered_submissions",
      {
        submission_filters: submissionFilters,
        answer_filters: answerFilters,
        page,
        page_size,
      }
    )

    if (error) {
      console.error("Error in get_filtered_submissions RPC:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch form responses" },
        { status: 500 }
      )
    }

    // The RPC returns an array with a single object containing all fields
    if (!rpcResponseArray || rpcResponseArray.length === 0) {
      console.error(
        "Unexpected empty response from get_filtered_submissions RPC"
      )
      return NextResponse.json(
        { success: false, error: "Failed to process form responses" },
        { status: 500 }
      )
    }

    const result = rpcResponseArray[0]

    return NextResponse.json({
      success: true,
      data: result?.data || [], // data is a JSONB array of submissions
      page,
      pageSize: page_size,
      totalCount: result?.total_count || 0,
      totalCompletedCount: result?.total_completed_count || 0,
      totalInProgressCount: result?.total_in_progress_count || 0,
      totalFilteredCount: result?.total_filtered_count || 0,
      completedCount: result?.completed_count || 0,
      inProgressCount: result?.in_progress_count || 0,
    })
  } catch (error) {
    console.error("Error fetching form responses:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch form responses" },
      { status: 500 }
    )
  }
}
