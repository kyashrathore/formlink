import { getModel } from "@/app/lib/ai/provider"
import logger from "@/app/lib/logger"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserCanAccessFormVersion } from "@/app/lib/middleware/authorization"
import { createServerClient, Json } from "@formlink/db"
import { generateObject } from "ai"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Load Summary Insights system prompt once at module load (no gate)
let SUMMARY_SYSTEM_PROMPT =
  "Return ONLY JSON with a 'summaries' array of {title, content}."
let SUMMARY_SYSTEM_PROMPT_PATH: string | null = null
try {
  const path = require("node:path")
  const fs = require("node:fs")
  let moduleDir = process.cwd()
  try {
    const url = require("node:url")
    // eslint-disable-next-line no-undef
    const maybeDirname =
      typeof __dirname !== "undefined" ? __dirname : undefined
    moduleDir = maybeDirname || path.dirname(url.fileURLToPath(import.meta.url))
  } catch {}
  const candidates = [
    // Relative to this route file
    path.resolve(moduleDir, "../../lib/chat/prompts/summary-system.md"),
    // Absolute from repo root
    path.resolve(
      process.cwd(),
      "apps/formcraft/app/lib/chat/prompts/summary-system.md"
    ),
  ]
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        SUMMARY_SYSTEM_PROMPT = fs.readFileSync(candidate, "utf8")
        SUMMARY_SYSTEM_PROMPT_PATH = candidate
        logger.info("[RESP] Loaded summary system prompt", { candidate })
        break
      }
    } catch {}
  }
  if (!SUMMARY_SYSTEM_PROMPT_PATH) {
    logger.warn("[RESP] Using fallback summary system prompt", { candidates })
  }
} catch (e) {
  logger.warn("[RESP] Failed to resolve summary system prompt", {
    error: e instanceof Error ? e.message : String(e),
  })
}

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
    const reqStart = Date.now()
    const url = request.nextUrl
    logger.info("[RESP] Request start", {
      path: url.pathname,
      search: url.search,
    })
    let authResult
    try {
      const authStart = Date.now()
      authResult = await requireAuth(request)
      logger.info("[RESP] Auth ok", { durationMs: Date.now() - authStart })
    } catch (error) {
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
    }

    const cookieStart = Date.now()
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    logger.info("[RESP] Supabase client created", {
      durationMs: Date.now() - cookieStart,
    })

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
    let questionLabelMap: Record<string, string> = {}
    const formVersionId = filters.form_version_id as string
    if (formVersionId) {
      const accessStart = Date.now()
      const hasAccess = await verifyUserCanAccessFormVersion(
        formVersionId,
        authResult.user.id
      )
      logger.info("[RESP] Access check done", {
        formVersionId,
        durationMs: Date.now() - accessStart,
        hasAccess,
      })

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: "Unauthorized to view these responses" },
          { status: 403 }
        )
      }
      const qStart = Date.now()
      const { data: formVersion, error: formVersionError } = await supabase
        .from("form_versions")
        .select("questions")
        .eq("version_id", formVersionId)
        .single()
      logger.info("[RESP] Loaded form version questions", {
        durationMs: Date.now() - qStart,
        formVersionId,
        hasQuestions: Boolean(formVersion?.questions),
      })

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

      // Build id -> human label map
      questionLabelMap = questionsArr.reduce(
        (acc, q) => {
          if (
            q &&
            typeof q === "object" &&
            q !== null &&
            "id" in q &&
            typeof (q as any).id === "string"
          ) {
            const id = (q as any).id as string
            const title = (q as any).title || (q as any).label || id
            acc[id] = String(title)
          }
          return acc
        },
        {} as Record<string, string>
      )
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

    const rpcStart = Date.now()
    const { data: rpcResponseArray, error } = await supabase.rpc(
      "get_filtered_submissions",
      {
        submission_filters: submissionFilters as any,
        answer_filters: answerFilters as any,
        page,
        page_size,
      }
    )
    logger.info("[RESP] RPC get_filtered_submissions", {
      durationMs: Date.now() - rpcStart,
      page,
      page_size,
      submissionFilterKeys: Object.keys(submissionFilters),
      answerFilterKeys: Object.keys(answerFilters),
    })

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
    logger.info("[RESP] RPC result meta", {
      totalCount: result?.total_count || 0,
      totalFilteredCount: result?.total_filtered_count || 0,
      returnedRows: Array.isArray(result?.data)
        ? (result.data as any[]).length
        : 0,
    })

    // Optional insights computation (experimental)
    let insights: Array<Record<string, unknown>> | undefined
    const insightSpecs = parseInsightsParam(insightsParam)
    if (insightSpecs.length) {
      const insightsStart = Date.now()
      logger.info("[RESP] Insights compute start", {
        insightCount: insightSpecs.length,
        insightTypes: insightSpecs.map((s: any) => s?.type),
      })
      const cleanCategory = (val: unknown): string => {
        let s = String(val ?? "Unknown")
        s = s.replace(/\s+/g, " ").trim()
        // normalize fancy quotes/dashes
        s = s
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2013\u2014]/g, "-")
        return s.length ? s : "Unknown"
      }
      const fieldLabelFor = (field?: string): string | undefined => {
        if (!field) return undefined
        const base = String(field).includes(":")
          ? String(field).split(":")[0]!
          : String(field)
        if (base === "status") return "Status"
        if (base === "created_at") return "Created At"
        if (base === "completed_at") return "Completed At"
        return questionLabelMap[base] || base
      }

      const toDomain = (val: unknown): string => {
        const s = String(val ?? "").trim()
        const at = s.indexOf("@")
        if (at > 0) return s.slice(at + 1).toLowerCase()
        try {
          const u = new URL(s)
          return u.hostname.toLowerCase().replace(/^www\./, "")
        } catch {
          return "Unknown"
        }
      }

      const toExt = (val: unknown): string => {
        const s = String(val ?? "").trim()
        const dot = s.lastIndexOf(".")
        return dot > -1 ? s.slice(dot + 1).toLowerCase() : "unknown"
      }
      // For better accuracy on trend/breakdown, fetch up to a capped number of rows
      let rows: any[] = Array.isArray(result?.data)
        ? (result.data as any[])
        : []
      const needsAllRows = insightSpecs.some((s) => s.type !== "count")
      logger.info("[RESP] Insight rows source", {
        initialRows: rows.length,
        needsAllRows,
      })
      if (needsAllRows) {
        const cap = 5000
        const allStart = Date.now()
        const { data: allArr } = await supabase.rpc(
          "get_filtered_submissions",
          {
            submission_filters: submissionFilters as any,
            answer_filters: answerFilters as any,
            page: 1,
            page_size: cap,
          }
        )
        logger.info("[RESP] RPC all rows for insights", {
          durationMs: Date.now() - allStart,
          cap,
          rows:
            allArr && allArr[0] && Array.isArray(allArr[0].data)
              ? allArr[0].data.length
              : 0,
        })
        const all =
          allArr && allArr[0] && Array.isArray(allArr[0].data)
            ? allArr[0].data
            : []
        rows = all.length ? all : rows
        logger.info("[RESP] Insight rows ready", {
          rows: rows.length,
        })
      }

      insights = insightSpecs.map((spec: InsightSpec, idx: number) => {
        const tStart = Date.now()
        // Helper for numeric parsing (for metrics)
        const parseNumber = (val: unknown): number | null => {
          if (typeof val === "number" && isFinite(val)) return val
          const s = String(val ?? "")
            .replace(/,/g, "")
            .trim()
          const m = s.match(/-?\d*\.?\d+/)
          if (!m) return null
          const n = Number(m[0])
          return isFinite(n) ? n : null
        }

        if (spec.type === "count") {
          // Default to filtered count
          const out = {
            type: "count",
            label: (spec as any).args?.label || "Filtered",
            count: result?.total_filtered_count || 0,
          }
          logger.info("[RESP] Insight computed", {
            idx,
            type: spec.type,
            durationMs: Date.now() - tStart,
          })
          return out
        }

        if ((spec as any).type === "metric") {
          const args: any = (spec as any).args || {}
          const field = String(args.field || "")
          const by = args.by as string | undefined
          const agg = String(args.agg || "avg").toLowerCase()
          const fmt = String(args.format || "number").toLowerCase()
          const values: number[] = []
          const byMap = new Map<string, number[]>()
          for (const r of rows) {
            const v = field === "created_at" ? r.created_at : r.answers?.[field]
            const n = parseNumber(v)
            if (n === null) continue
            values.push(n)
            if (by) {
              let cat: string
              if (by === "status") cat = cleanCategory(r.status)
              else if (by === "created_at")
                cat = toISODate(new Date(String(r.created_at)))
              else cat = cleanCategory(r.answers?.[by])
              if (!byMap.has(cat)) byMap.set(cat, [])
              byMap.get(cat)!.push(n)
            }
          }
          const aggFn = (arr: number[]): number => {
            if (!arr.length) return 0
            switch (agg) {
              case "sum":
                return arr.reduce((a, b) => a + b, 0)
              case "min":
                return Math.min(...arr)
              case "max":
                return Math.max(...arr)
              case "median": {
                const srt = [...arr].sort((a, b) => a - b)
                const mid = Math.floor(srt.length / 2)
                return srt.length % 2
                  ? srt[mid]!
                  : (srt[mid - 1]! + srt[mid]!) / 2
              }
              case "avg":
              default:
                return arr.reduce((a, b) => a + b, 0) / arr.length
            }
          }
          if (!by) {
            const value = aggFn(values)
            const out = {
              type: "metric",
              field,
              field_label: fieldLabelFor(field),
              agg,
              format: fmt,
              data: { value },
            }
            logger.info("[RESP] Insight computed", {
              idx,
              type: "metric",
              field,
              durationMs: Date.now() - tStart,
              count: values.length,
            })
            return out
          } else {
            const entries = Array.from(byMap.entries()).map(([name, arr]) => ({
              name,
              value: aggFn(arr),
            }))
            const data = entries.sort((a, b) => (b.value || 0) - (a.value || 0))
            const out = {
              type: "metric",
              field,
              field_label: fieldLabelFor(field),
              by,
              by_label: fieldLabelFor(by),
              agg,
              format: fmt,
              data,
            }
            logger.info("[RESP] Insight computed", {
              idx,
              type: "metric",
              field,
              by,
              durationMs: Date.now() - tStart,
              groups: data.length,
            })
            return out
          }
        }

        if (spec.type === "trend") {
          const field = (spec as any).args?.field || "created_at"
          const by = (spec as any).args?.by as string | undefined
          const byIsDerived =
            typeof by === "string" && /:(domain|ext)$/.test(by)
          const byBase = byIsDerived ? by!.split(":")[0]! : by
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
              if (byBase === "status") cat = cleanCategory(r.status)
              else if (byBase === "created_at") cat = key
              else {
                const raw = r.answers && (r.answers as any)[byBase!]
                if (byIsDerived) {
                  const op = by!.split(":")[1]
                  cat = op === "domain" ? toDomain(raw) : toExt(raw)
                } else {
                  cat = cleanCategory(raw)
                }
              }
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
          const base: any = {
            type: "trend",
            field,
            field_label: fieldLabelFor(field),
            data,
          }
          if (by) ((base.by = by), (base.by_label = fieldLabelFor(by)))
          return base
        }

        if (spec.type === "breakdown") {
          const field = (spec as any).args?.field || "status"
          const by = (spec as any).args?.by as string | undefined
          const fieldIsDerived =
            typeof field === "string" && /:(domain|ext)$/.test(field as string)
          const fieldBase = fieldIsDerived
            ? (field as string).split(":")[0]!
            : field
          const byIsDerived =
            typeof by === "string" && /:(domain|ext)$/.test(by)
          const byBase = byIsDerived ? by!.split(":")[0]! : by
          const topN = Number((spec as any).args?.topN) || 10
          const counts = new Map<string, Map<string, number> | number>()
          for (const r of rows) {
            let key: string
            if (fieldBase === "status") key = cleanCategory(r.status)
            else if (fieldBase === "created_at")
              key = toISODate(new Date(String(r.created_at)))
            else {
              const raw = r.answers && (r.answers as any)[fieldBase as string]
              if (fieldIsDerived) {
                const op = (field as string).split(":")[1]
                key = op === "domain" ? toDomain(raw) : toExt(raw)
              } else {
                key = cleanCategory(raw)
              }
            }
            if (by) {
              let cat: string
              if (byBase === "status") cat = cleanCategory(r.status)
              else if (byBase === "created_at")
                cat = toISODate(new Date(String(r.created_at)))
              else {
                const raw = r.answers && (r.answers as any)[byBase as string]
                if (byIsDerived) {
                  const op = (by as string).split(":")[1]
                  cat = op === "domain" ? toDomain(raw) : toExt(raw)
                } else {
                  cat = cleanCategory(raw)
                }
              }
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
          const base: any = {
            type: "breakdown",
            field,
            field_label: fieldLabelFor(field),
            data,
          }
          if (by) ((base.by = by), (base.by_label = fieldLabelFor(by)))
          logger.info("[RESP] Insight computed", {
            idx,
            type: "breakdown",
            field,
            by,
            durationMs: Date.now() - tStart,
            buckets: data.length,
          })
          return base
        }
        return { type: (spec as any).type, data: [] }
      })
      logger.info("[RESP] Insights compute done", {
        durationMs: Date.now() - insightsStart,
        insightCount: insightSpecs.length,
      })

      // Summaries handled separately via /api/ri/summary; disable inline text AI here
      const textIdxs: number[] = []
      if (textIdxs.length) {
        try {
          const MODEL = getModel("google/gemini-2.5-pro", "openrouter")
          // No timeout/sample cap (per request)
          const truncate = (s: string, n: number) =>
            s.length <= n ? s : s.slice(0, n) + "…"
          const pickSample = <T>(arr: T[], max: number) => {
            if (arr.length <= max) return arr
            const stride = Math.ceil(arr.length / max)
            const out: T[] = []
            for (let i = 0; i < arr.length && out.length < max; i += stride) {
              out.push(arr[i]!)
            }
            return out
          }
          // Note: no timeout wrapper here to capture full provider output
          const aiStart = Date.now()
          const SummarySchema = z
            .object({
              summaries: z
                .array(
                  z.object({ title: z.string(), content: z.string() }).strict()
                )
                .default([]),
            })
            .strict()
          // Reduce payload: sample rows and keep only short textual answers
          const sampled = rows
          let textualRowsWithContent = 0
          const textRows = sampled.map((r) => {
            const ans = r.answers || {}
            const textOnly: Record<string, string> = {}
            for (const [k, v] of Object.entries(ans)) {
              if (typeof v === "string") {
                const s = v.replace(/\s+/g, " ").trim()
                if (s) textOnly[k] = s
              }
            }
            if (Object.keys(textOnly).length) textualRowsWithContent++
            return {
              submission_id: r.submission_id,
              created_at: r.created_at,
              status: r.status,
              answers: textOnly,
            }
          })
          const compactRows = textRows

          // Build numeric/categorical context from computed insights for fallback and as guidance
          const metricContext = (insights || [])
            .filter((i: any) => i?.type === "metric")
            .map((m: any) => ({
              field: m.field,
              field_label: m.field_label,
              agg: m.agg,
              value: m?.data?.value,
              by: m?.by,
              series: Array.isArray(m?.data) ? m.data.slice(0, 5) : undefined,
            }))
          const breakdownContext = (insights || [])
            .filter((i: any) => i?.type === "breakdown")
            .map((b: any) => ({
              field: b.field,
              field_label: b.field_label,
              top: Array.isArray(b?.data) ? b.data.slice(0, 5) : [],
            }))
          const questions = Object.entries(questionLabelMap || {}).map(
            ([id, label]) => ({ id, label })
          )
          const angles = textIdxs.map((i) => ({
            index: i,
            type: (insightSpecs[i] as any)?.type,
            title: (insightSpecs[i] as any)?.args?.title,
            description: (insightSpecs[i] as any)?.args?.description,
          }))
          const payload = {
            instructions:
              "Produce concise, actionable textual insights (1–2 sentences each; under ~220 chars). Avoid filler.",
            formVersionId,
            questions,
            angles,
            rows: compactRows,
            context: { metrics: metricContext, breakdowns: breakdownContext },
          }
          logger.info("[RESP] Insight text AI start", {
            model: String(MODEL),
            rowSample: compactRows.length,
            timeoutMs: null,
            textualRowsWithContent,
          })
          const normalizeErr = (err: unknown) => ({
            name: (err as any)?.name,
            message: (err as any)?.message,
            code: (err as any)?.code,
            status:
              (err as any)?.status ||
              (err as any)?.cause?.status ||
              (err as any)?.cause?.response?.status,
          })

          let summariesObj: {
            summaries?: Array<{ title: string; content: string }>
          } | null = null
          try {
            const res = await generateObject({
              model: MODEL,
              schema: SummarySchema,
              system: SUMMARY_SYSTEM_PROMPT,
              prompt: JSON.stringify(payload),
            })
            summariesObj = res.object as any
          } catch (e1) {
            logger.warn(
              "[RESP] Insight text AI primary failed; retrying backup",
              {
                model: String(MODEL),
                error: normalizeErr(e1),
              }
            )
            const BACKUP_MODEL =
              process.env.RESP_SUMMARY_BACKUP_MODEL || "google/gemini-2.5-pro"
            const BACKUP = getModel(BACKUP_MODEL, "openrouter")
            try {
              const res2 = await generateObject({
                model: BACKUP,
                schema: SummarySchema,
                system: SUMMARY_SYSTEM_PROMPT,
                prompt: JSON.stringify(payload),
              })
              summariesObj = res2.object as any
              logger.info("[RESP] Insight text AI backup success", {
                backupModel: String(BACKUP),
              })
            } catch (e2) {
              logger.warn("[RESP] Insight text AI backup failed", {
                backupModel: String(BACKUP),
                error: normalizeErr(e2),
              })
              throw e2
            }
          }

          logger.info("[RESP] Insight text AI done", {
            durationMs: Date.now() - aiStart,
            textInsightCount: textIdxs.length,
          })
          const summaries = summariesObj?.summaries || []
          if (!summaries.length) {
            logger.info("[RESP] Insight text AI empty", {
              rowSample: compactRows.length,
              textualRowsWithContent,
            })
          }
          if (textIdxs.length === 1) {
            insights[textIdxs[0]!] = { type: "text", data: { summaries } }
          } else {
            insights[textIdxs[0]!] = { type: "text", data: { summaries } }
            for (let j = 1; j < textIdxs.length; j++) {
              insights[textIdxs[j]!] = { type: "text", data: { summaries: [] } }
            }
          }
        } catch (e) {
          logger.warn("[RESP] Insight text AI failed", {
            error: e instanceof Error ? e.message : String(e),
          })
          textIdxs.forEach((i) => {
            insights![i] = { type: "text", data: { summaries: [] } }
          })
        }
      }
    }

    const totalDuration = Date.now() - reqStart
    logger.info("[RESP] Response done", {
      durationMs: totalDuration,
      page,
      page_size,
      hasInsights: Boolean(insights && insights.length),
    })
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
  } catch (e) {
    logger.error("[RESP] Handler failed", {
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { success: false, error: "Failed to fetch form responses" },
      { status: 500 }
    )
  }
}
