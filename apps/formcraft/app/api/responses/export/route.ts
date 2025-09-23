import logger from "@/app/lib/logger"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserCanAccessFormVersion } from "@/app/lib/middleware/authorization"
import { createServerClient, Json } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value)

  // Escape quotes and wrap in quotes if contains comma, newline, or quotes
  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes('"')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function generateCSV(data: any[], columns: string[]): string {
  // Generate header row
  const header = columns.map((col) => escapeCSVValue(col)).join(",")

  // Generate data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col]
        return escapeCSVValue(value)
      })
      .join(",")
  })

  return [header, ...rows].join("\n")
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
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

    // Parse request body
    const body = await request.json()
    const { format = "csv", search, submission_ids } = body

    if (format !== "csv") {
      return NextResponse.json(
        { success: false, error: "Only CSV format is currently supported" },
        { status: 400 }
      )
    }

    // Parse search filters
    let filters: Record<string, unknown> = {}
    if (search) {
      try {
        filters = typeof search === "string" ? JSON.parse(search) : search
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid search param" },
          { status: 400 }
        )
      }
    }

    // Get form version ID and validate access
    const formVersionId = filters.form_version_id as string
    if (!formVersionId) {
      return NextResponse.json(
        { success: false, error: "form_version_id is required" },
        { status: 400 }
      )
    }

    const hasAccess = await verifyUserCanAccessFormVersion(
      formVersionId,
      authResult.user.id
    )

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Unauthorized to export these responses" },
        { status: 403 }
      )
    }

    // Get form version details to extract question IDs and labels
    const { data: formVersion, error: formVersionError } = await supabase
      .from("form_versions")
      .select("questions, title")
      .eq("version_id", formVersionId)
      .single()

    if (formVersionError || !formVersion) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch form version" },
        { status: 500 }
      )
    }

    // Parse questions to get field information
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

    const validQuestionIds = questionsArr
      .filter(
        (q) =>
          q &&
          typeof q === "object" &&
          q !== null &&
          "id" in q &&
          typeof q.id === "string"
      )
      .map((q) => (q as { id: string }).id)

    // Build question map for labels
    const questionMap = new Map<string, string>()
    questionsArr.forEach((q: any) => {
      if (q?.id && q?.label) {
        questionMap.set(q.id, q.label)
      } else if (q?.id && q?.title) {
        questionMap.set(q.id, q.title)
      } else if (q?.id) {
        questionMap.set(q.id, q.id)
      }
    })

    // Process filters
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
        if (key === "status" && Array.isArray(value)) {
          submissionFilters[key] = value.length ? value[0] : undefined
        } else {
          submissionFilters[key] = value
        }
      } else if (validQuestionIds.includes(key)) {
        answerFilters[key] = value
      }
    }

    // Apply defaults for filters
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

    // Fetch all responses (no pagination for export)
    const { data: rpcResponseArray, error } = await supabase.rpc(
      "get_filtered_submissions",
      {
        submission_filters: submissionFilters as any,
        answer_filters: answerFilters as any,
        page: 1,
        page_size: 10000, // Large limit for export
      }
    )

    if (error || !rpcResponseArray || rpcResponseArray.length === 0) {
      if (error) {
        logger.error?.("[RESP][export] RPC failed", {
          message: error.message,
          details: (error as any).details || null,
          hint: (error as any).hint || null,
          code: (error as any).code || null,
          submissionFilters,
          answerFilters,
        })
      } else {
        logger.error?.("[RESP][export] RPC returned empty result", {
          submissionFilters,
          answerFilters,
        })
      }
      return NextResponse.json(
        { success: false, error: "Failed to fetch form responses for export" },
        { status: 500 }
      )
    }

    const result = rpcResponseArray[0]
    let exportData: any[] = []

    // Ensure data is an array
    if (result?.data && Array.isArray(result.data)) {
      exportData = result.data
    }

    // Filter by submission_ids if provided
    if (
      submission_ids &&
      Array.isArray(submission_ids) &&
      submission_ids.length > 0
    ) {
      exportData = exportData.filter((row: any) =>
        submission_ids.includes(row.submission_id)
      )
    }

    // Transform data for CSV export
    const csvData = exportData.map((row: any) => {
      const flatRow: Record<string, unknown> = {
        submission_id: row.submission_id,
        status: row.status,
        created_at: row.created_at,
        completed_at: row.completed_at,
        testmode: row.testmode,
      }

      // Add answer fields
      if (row.answers && typeof row.answers === "object") {
        for (const [questionId, answer] of Object.entries(row.answers)) {
          const label = questionMap.get(questionId) || questionId
          flatRow[label] = answer
        }
      }

      return flatRow
    })

    // Generate column list
    const baseColumns = [
      "submission_id",
      "status",
      "created_at",
      "completed_at",
      "testmode",
    ]
    const answerColumns = Array.from(questionMap.values())
    const allColumns = [...baseColumns, ...answerColumns]

    // Generate CSV
    const csv = generateCSV(csvData, allColumns)

    // Return CSV as download
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="responses-export.csv"`,
      },
    })
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to export responses" },
      { status: 500 }
    )
  }
}
