import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserCanAccessFormVersion } from "@/app/lib/middleware/authorization"
import { createServerClient, Json } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

type InsightSpec =
  | { type: "count"; args?: { label?: string } }
  | { type: "trend"; args?: { window?: string; field?: string; by?: string } }
  | {
      type: "breakdown"
      args?: { field?: string; topN?: number; by?: string; stacked?: boolean }
    }

function parseInsightsParam(param: string | null): InsightSpec[] {
  if (!param) return []
  try {
    const parsed = JSON.parse(param)
    if (Array.isArray(parsed)) return parsed as InsightSpec[]
  } catch {}
  return []
}

function startDateForWindow(win?: string): Date | null {
  if (!win) return null
  const now = new Date()
  const m = /^(\d+)(d|w|m)$/i.exec(win)
  if (!m) return null
  const [, num, unitRaw] = m
  const n = parseInt(num!, 10)
  const unit = (unitRaw! as string).toLowerCase()
  const d = new Date(now)
  if (unit === "d") d.setDate(d.getDate() - n)
  else if (unit === "w") d.setDate(d.getDate() - n * 7)
  else if (unit === "m") d.setMonth(d.getMonth() - n)
  return d
}

function toISODate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

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
    const insightsParam = request.nextUrl.searchParams.get("insights")

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

    // Optional insights computation (experimental)
    let insights: Array<Record<string, unknown>> | undefined
    const insightSpecs = parseInsightsParam(insightsParam)
    if (insightSpecs.length) {
      // For better accuracy on trend/breakdown, fetch up to a capped number of rows
      let rows: any[] = Array.isArray(result?.data)
        ? (result.data as any[])
        : []
      const needsAllRows = insightSpecs.some((s) => s.type !== "count")
      if (needsAllRows) {
        const cap = 5000
        const { data: allArr } = await supabase.rpc(
          "get_filtered_submissions",
          {
            submission_filters: submissionFilters as any,
            answer_filters: answerFilters as any,
            page: 1,
            page_size: cap,
          }
        )
        const all =
          allArr && allArr[0] && Array.isArray(allArr[0].data)
            ? allArr[0].data
            : []
        rows = all.length ? all : rows
      }

      insights = insightSpecs.map((spec: InsightSpec) => {
        if (spec.type === "count") {
          // Default to filtered count
          return {
            type: "count",
            label: (spec as any).args?.label || "Filtered",
            count: result?.total_filtered_count || 0,
          }
        }

        if (spec.type === "trend") {
          const field = (spec as any).args?.field || "created_at"
          const by = (spec as any).args?.by as string | undefined
          const buckets = new Map<string, Map<string, number> | number>()
          // Optional window lower bound
          const from = startDateForWindow((spec as any).args?.window)
          for (const r of rows) {
            const iso = String(r[field] || r["created_at"] || "")
            const d = new Date(iso)
            if (isNaN(d.getTime())) continue
            if (from && d < from) continue
            const key = toISODate(d)
            if (by) {
              let cat: string
              if (by === "status") cat = String(r.status)
              else if (by === "created_at") cat = key
              else cat = String((r.answers && r.answers[by]) ?? "Unknown")
              if (!buckets.has(key)) buckets.set(key, new Map<string, number>())
              const inner = buckets.get(key) as Map<string, number>
              inner.set(cat, (inner.get(cat) || 0) + 1)
            } else {
              const prev = (buckets.get(key) as number) || 0
              buckets.set(key, prev + 1)
            }
          }
          const data = Array.from(buckets.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([bucket, val]) => {
              if (val instanceof Map) {
                const series: Record<string, number> = {}
                val.forEach((v, k) => (series[k] = v))
                return { bucket, series }
              }
              return { bucket, count: val as number }
            })
          return by
            ? { type: "trend", field, by, data }
            : { type: "trend", field, data }
        }

        if (spec.type === "breakdown") {
          const field = (spec as any).args?.field || "status"
          const by = (spec as any).args?.by as string | undefined
          const topN = Number((spec as any).args?.topN) || 10
          const counts = new Map<string, Map<string, number> | number>()
          for (const r of rows) {
            let key: string
            if (field === "status") key = String(r.status)
            else if (field === "created_at")
              key = toISODate(new Date(String(r.created_at)))
            else key = String((r.answers && r.answers[field]) ?? "Unknown")
            if (by) {
              let cat: string
              if (by === "status") cat = String(r.status)
              else if (by === "created_at")
                cat = toISODate(new Date(String(r.created_at)))
              else cat = String((r.answers && r.answers[by]) ?? "Unknown")
              if (!counts.has(key)) counts.set(key, new Map<string, number>())
              const inner = counts.get(key) as Map<string, number>
              inner.set(cat, (inner.get(cat) || 0) + 1)
            } else {
              const prev = (counts.get(key) as number) || 0
              counts.set(key, prev + 1)
            }
          }
          const entries = Array.from(counts.entries()).map(([name, val]) => {
            if (val instanceof Map) {
              const series: Record<string, number> = {}
              let total = 0
              val.forEach((v, k) => {
                series[k] = v
                total += v
              })
              return { name, total, series }
            }
            return { name, count: val as number }
          })
          const sorted = entries.sort(
            (a, b) => (b.total ?? b.count ?? 0) - (a.total ?? a.count ?? 0)
          )
          const sliced = sorted.slice(0, topN)
          const data = sliced.map((e) =>
            "series" in e
              ? { name: e.name, series: (e as any).series }
              : { name: e.name, count: (e as any).count }
          )
          return by
            ? { type: "breakdown", field, by, data }
            : { type: "breakdown", field, data }
        }
        return { type: (spec as any).type, data: [] }
      })
    }

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
      insights,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch form responses" },
      { status: 500 }
    )
  }
}
