import { createServerClient, SupabaseClient } from "@formlink/db"
import crypto from "node:crypto"
import { cookies } from "next/headers"
import { z } from "zod"
import { generateObject } from "ai"
import { getModel } from "@/app/lib/ai/provider"
import path from "node:path"
import fs from "node:fs"
import logger from "@/app/lib/logger"

export type SummarySpec = {
  type: "summary"
  args?: {
    title?: string
    description?: string
    content?: string
    layout?: Record<string, unknown>
    layout_variant?: "small" | "medium" | "large"
    angles?: string[]
  }
}

export type SummaryRequest = {
  formId: string
  formVersionId?: string | null
  plan?: {
    rpc?: { submission_filters?: Record<string, unknown>; answer_filters?: Record<string, unknown> }
    ui?: { insights_spec?: SummarySpec[] }
  }
  locale?: string
  search?: Record<string, unknown>
}

export type SummaryResponse = {
  summaries: Array<{ title?: string; content: string }>
  cache: { hit: boolean; key: string; updatedAt?: string }
}

function stableStringifyDeep(obj: any): string {
  const seen = new WeakSet()
  const normalize = (v: any): any => {
    if (v === null || typeof v !== "object") return v
    if (seen.has(v)) return undefined
    seen.add(v)
    if (Array.isArray(v)) return v.map(normalize)
    const out: Record<string, any> = {}
    for (const key of Object.keys(v).sort()) out[key] = normalize(v[key])
    return out
  }
  return JSON.stringify(normalize(obj))
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex")
}

async function getLatestSubmissionAt(supabase: SupabaseClient, formId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("created_at")
    .eq("form_id", formId)
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) return null
  return (data && data[0]?.created_at) || null
}

function buildCacheKey(input: SummaryRequest, latest: string | null): string {
  // Hash both plan rpc and UI search; server will merge with UI winning
  const filters = {
    planRpc: input.plan?.rpc || {},
    search: input.search || {},
  }
  const summariesOnly = (input.plan?.ui?.insights_spec || []).filter((x) => x?.type === "summary")
  const specHash = sha256(stableStringifyDeep(summariesOnly))
  const filtersHash = sha256(stableStringifyDeep(filters))
  const parts = [
    "summary",
    input.formId,
    input.formVersionId || "none",
    filtersHash,
    specHash,
    input.locale || "en",
    latest || "no-data",
  ]
  return parts.join(":")
}

export async function getOrComputeSummary(req: SummaryRequest): Promise<SummaryResponse> {
  // Use service client explicitly (no session cookies needed)
  const supabase = await createServerClient(undefined, "service")

  const latest = await getLatestSubmissionAt(supabase, req.formId)
  const id = buildCacheKey(req, latest)
  // Helpful metadata for debugging cache behavior
  try {
    const summariesOnly = (req.plan?.ui?.insights_spec || []).filter((x) => x?.type === "summary")
    const filtersForHash = { planRpc: req.plan?.rpc || {}, search: req.search || {} }
    const specHash = sha256(stableStringifyDeep(summariesOnly))
    const filtersHash = sha256(stableStringifyDeep(filtersForHash))
    logger.info("[SUMMARY] Cache key computed", {
      formId: req.formId,
      formVersionId: req.formVersionId,
      id,
      filtersHash,
      specHash,
      latest,
    })
  } catch {}

  // Try cache
  const { data: cached, error: readErr } = await supabase
    .from("ri_ai_cache")
    .select("value, meta, updated_at")
    .eq("id", id)
    .maybeSingle()
  if (readErr) {
    logger.warn("[SUMMARY] Cache read error", { id, error: readErr.message })
  }

  if (cached?.value) {
    const expiresAt = cached.meta?.expiresAt as string | undefined
    const isExpired = expiresAt ? Date.now() > Date.parse(expiresAt) : false
    // Fire-and-forget refresh if expired, but return cached immediately
    if (isExpired) {
      logger.info("[SUMMARY] Cache hit (expired) — scheduling refresh", {
        id,
        updatedAt: cached.updated_at,
        expiresAt,
      })
      void refreshSummary(supabase, id, req, latest)
    } else {
      logger.info("[SUMMARY] Cache hit", { id, updatedAt: cached.updated_at })
    }
    return {
      summaries: (cached.value?.summaries as any[]) || [],
      cache: { hit: true, key: id, updatedAt: cached.updated_at },
    }
  }
  logger.info("[SUMMARY] Cache miss (not found)", { id })

  // Compute with AI
  const summaries = await computeSummariesWithAI(supabase, req)
  const payload = { summaries }
  const meta = { latest, expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), version: "summary.v1" }
  const { error: upsertErr } = await supabase
    .from("ri_ai_cache")
    .upsert({ id, value: payload, meta, updated_at: new Date().toISOString() })
  if (upsertErr) {
    logger.warn("[SUMMARY] Cache write error", { id, error: upsertErr?.message, raw: upsertErr })
  } else {
    logger.info("[SUMMARY] Cache populated", { id })
  }
  return { summaries, cache: { hit: false, key: id, updatedAt: new Date().toISOString() } }
}

// Background refresh helper
async function refreshSummary(supabase: SupabaseClient, id: string, req: SummaryRequest, latest: string | null) {
  try {
    const summaries = await computeSummariesWithAI(supabase, req)
    const { error } = await supabase
      .from("ri_ai_cache")
      .upsert({
        id,
        value: { summaries },
        meta: { latest, expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), version: "summary.v1" },
        updated_at: new Date().toISOString(),
      })
    if (error) logger.warn("[SUMMARY] Refresh write error", { id, error: error.message })
    else logger.info("[SUMMARY] Cache refreshed", { id })
  } catch {}
}

// Load system prompt for summaries at module init
let SUMMARY_SYSTEM_PROMPT = ""
try {
  const candidates = [
    path.resolve(process.cwd(), "apps/formcraft/app/lib/chat/prompts/summary-system.md"),
    path.resolve(process.cwd(), "app/lib/chat/prompts/summary-system.md"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      SUMMARY_SYSTEM_PROMPT = fs.readFileSync(p, "utf8")
      break
    }
  }
} catch {}

const SummariesObjectSchema = z
  .object({ summaries: z.array(z.object({ title: z.string().optional(), content: z.string().min(1) })).min(1).max(5) })
  .strict()

async function computeSummariesWithAI(supabase: SupabaseClient, req: SummaryRequest) {
  // Load questions meta
  let questions: Array<{ id: string; label?: string }> = []
  if (req.formVersionId) {
    try {
      const { data } = await supabase
        .from("form_versions")
        .select("questions, form_id")
        .eq("version_id", req.formVersionId)
        .single()
      const q = (data as any)?.questions
      const arr: any[] = Array.isArray(q) ? q : typeof q === "string" ? JSON.parse(q) : []
      questions = arr
        .filter((x) => x && typeof x === "object" && typeof x.id === "string")
        .map((x) => ({ id: x.id as string, label: (x as any).title || (x as any).label }))
    } catch {}
  }
  // Sample recent rows (completed, non-test) via RPC if version is available
  let rows: Array<{ submission_id: string; created_at: string; status: string; answers?: Record<string, unknown> }> = []
  // Merge plan.rpc filters with UI 'search' (UI wins)
  let submission_filters: Record<string, unknown> = {
    ...(req.plan?.rpc?.submission_filters || {}),
  }
  let answer_filters: Record<string, unknown> = {
    ...(req.plan?.rpc?.answer_filters || {}),
  }
  if (req.search && req.formVersionId) {
    const allowedSubmissionFilters = [
      "form_version_id",
      "status",
      "user_id",
      "created_at",
      "completed_at",
      "testmode",
    ]
    const validQuestionIds = questions.map((q) => q.id)
    for (const [key, value] of Object.entries(req.search)) {
      if (allowedSubmissionFilters.includes(key)) submission_filters[key] = value
      else if (validQuestionIds.includes(key)) answer_filters[key] = value
    }
  }

  // Coerce certain submission filters (arrays/strings -> proper types)
  // status: if array, take first; if empty, delete
  if (Array.isArray(submission_filters.status)) {
    const arr = submission_filters.status as any[]
    submission_filters.status = arr.length ? arr[0] : undefined
    if (submission_filters.status === undefined) delete (submission_filters as any).status
  }
  // testmode: accept boolean, or string/array -> boolean
  if (Array.isArray(submission_filters.testmode)) {
    const arr = submission_filters.testmode as any[]
    if (arr.length === 1) submission_filters.testmode = String(arr[0]).toLowerCase() === "true"
    else delete (submission_filters as any).testmode
  } else if (typeof submission_filters.testmode === "string") {
    submission_filters.testmode = (submission_filters.testmode as string).toLowerCase() === "true"
  }
  // Ensure form_version_id is set from request
  submission_filters.form_version_id = req.formVersionId

  // Apply defaults ONLY when neither plan nor search provided them
  if (submission_filters.status === undefined && !req.search) {
    submission_filters.status = "completed"
  }
  if (submission_filters.testmode === undefined) {
    submission_filters.testmode = false
  }

  let totalFiltered = 0
  if (req.formVersionId) {
    try {
      const { data: rpc } = await supabase.rpc("get_filtered_submissions", {
        submission_filters: {
          form_version_id: submission_filters.form_version_id,
          status: submission_filters.status,
          testmode: submission_filters.testmode,
          user_id: submission_filters.user_id,
          created_at: submission_filters.created_at,
          completed_at: submission_filters.completed_at,
        } as any,
        answer_filters: answer_filters as any,
        page: 1,
        page_size: 50,
      })
      const res = Array.isArray(rpc) ? rpc[0] : null
      rows = (Array.isArray(res?.data) ? (res!.data as any[]) : []) as any
      totalFiltered = Number((res as any)?.total_filtered_count || 0)
    } catch {}
  }
  // Keep only short textual answers per row
  const compactRows = rows.map((r) => {
    const ans = (r as any).answers || {}
    const textOnly: Record<string, string> = {}
    for (const [k, v] of Object.entries(ans)) {
      if (typeof v === "string") {
        const s = v.replace(/\s+/g, " ").trim()
        if (s) textOnly[k] = s
      }
    }
    return { submission_id: (r as any).submission_id, created_at: (r as any).created_at, status: (r as any).status, answers: textOnly }
  })
  // If there are no matching submissions, avoid AI call and return empty summaries
  if (!totalFiltered) {
    return []
  }

  // Minimal input; can enrich with computed metrics/breakdowns later
  const summariesSpecs = (req.plan?.ui?.insights_spec || []).filter((x) => x.type === "summary") as SummarySpec[]
  const angles = summariesSpecs.flatMap((s) => s.args?.angles || [])
  const MODEL = getModel("google/gemini-2.5-pro", "openrouter")
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: SummariesObjectSchema,
      system: SUMMARY_SYSTEM_PROMPT || "Return ONLY JSON: { summaries: [{ title?, content }] }",
      prompt: JSON.stringify({ questions, rows: compactRows, angles, context: {} }),
    })
    return object.summaries as Array<{ title?: string; content: string }>
  } catch {
    // Fallback: simple single summary placeholder
    const text = summariesSpecs[0]?.args?.description || "Summary pending."
    return [{ title: summariesSpecs[0]?.args?.title || "Summary", content: String(text) }]
  }
}
