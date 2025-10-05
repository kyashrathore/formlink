import { executeActionWithLogging } from "@/app/lib/actions/runner"
import { validateActionParameters } from "@/app/lib/actions/schema-registry"
import logger from "@/app/lib/logger"
import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const actionSchema = z.object({
  kind: z.enum(["email", "composio"]),
  slug: z.string().min(1),
  params: z.record(z.any()).default({}),
  idempotencyKey: z.string().optional(),
})

const requestSchema = z.object({
  formId: z.string().uuid(),
  submissionIds: z.array(z.string().uuid()).min(1),
  action: actionSchema,
  viewId: z.string().uuid().optional(),
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
  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload",
        issues: parsed.error.issues,
      },
      { status: 400 }
    )
  }

  const { formId, submissionIds, action } = parsed.data
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

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  let mergedParams: Record<string, unknown> = { ...(action.params || {}) }
  let toolkit: string | null = null
  if (action.kind === "composio") {
    // If a view is provided, fetch view params and validate required fields
    if (parsed.data.viewId) {
      const { viewId } = parsed.data
      try {
        const { data: viewRow } = await (supabase as any)
          .from("response_views")
          .select("id, user_id, form_id, actions")
          .eq("id", viewId)
          .eq("form_id", formId)
          .eq("user_id", auth.user.id)
          .maybeSingle()
        const actionsArr =
          viewRow && Array.isArray((viewRow as any).actions)
            ? ((viewRow as any).actions as any[])
            : []
        const entry = actionsArr.find((a) => a?.slug === action.slug)
        const viewParams: Record<string, unknown> | undefined =
          entry?.params || {}
        // Merge view params with runtime overrides (runtime takes precedence)
        mergedParams = { ...(viewParams || {}), ...(action.params || {}) }
      } catch (_e) {
        return NextResponse.json(
          { success: false, error: "Failed to load view parameters" },
          { status: 500 }
        )
      }
    }

    // Resolve mapped values from submission answers if present
    const tokenRegex = /\{\{\s*(answer|submission|form):([^}]+)\s*\}\}/
    const hasToken = (val: unknown): boolean => {
      if (typeof val === "string") return tokenRegex.test(val)
      if (Array.isArray(val)) return val.some((v) => hasToken(v))
      if (val && typeof val === "object") {
        return Object.values(val as Record<string, unknown>).some((v) =>
          hasToken(v)
        )
      }
      return false
    }

    const needsMapping = hasToken(mergedParams)
    if (needsMapping) {
      if (!parsed.data.viewId) {
        return NextResponse.json(
          {
            success: false,
            error: "Parameter mappings require a view context",
          },
          { status: 400 }
        )
      }
      if (submissionIds.length !== 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Select exactly one response when using mapped parameters (per-response execution).",
          },
          { status: 422 }
        )
      }
      const singleId = submissionIds[0]!
      // Optional: form metadata for tokens
      let formTitle: string | null = null
      try {
        const { data: formRow } = await (supabase as any)
          .from("forms")
          .select("current_published_version_id, current_draft_version_id")
          .eq("id", formId)
          .maybeSingle()
        const vid =
          (formRow as any)?.current_published_version_id ||
          (formRow as any)?.current_draft_version_id ||
          null
        if (vid) {
          const { data: vrow } = await (supabase as any)
            .from("form_versions")
            .select("title")
            .eq("version_id", vid)
            .maybeSingle()
          const t = (vrow as any)?.title
          if (typeof t === "string") formTitle = t
          else if (t && typeof t === "object") {
            // Best-effort stringify when title stored as structured JSON
            try {
              formTitle = JSON.stringify(t)
            } catch {
              formTitle = null
            }
          }
        }
      } catch {}
      const { data: answersRows, error: answersError } = await supabase
        .from("form_answers")
        .select("question_id, answer_value")
        .eq("submission_id", singleId)
      if (answersError) {
        return NextResponse.json(
          { success: false, error: "Failed to load response answers" },
          { status: 500 }
        )
      }
      const answersMap = new Map<string, unknown>()
      for (const row of answersRows || []) {
        answersMap.set((row as any).question_id, (row as any).answer_value)
      }
      const resolveTokens = (val: unknown): unknown => {
        if (typeof val === "string") {
          const m = val.match(tokenRegex)
          if (m) {
            const ns = m[1]
            const key = m[2]! as string
            if (ns === "answer") {
              return answersMap.get(key) ?? null
            }
            if (ns === "submission" && key === "id") {
              return singleId
            }
            if (ns === "form") {
              if (key === "id") return formId
              if (key === "title") return formTitle || ""
            }
          }
          return val
        }
        if (Array.isArray(val)) return val.map((v) => resolveTokens(v))
        if (val && typeof val === "object") {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            out[k] = resolveTokens(v)
          }
          return out
        }
        return val
      }
      mergedParams = resolveTokens(mergedParams) as Record<string, unknown>
    }

    // Normalize params for known provider quirks
    const normalizeParamsForSlug = (
      slug: string,
      params: Record<string, unknown>
    ): Record<string, unknown> => {
      const out: Record<string, unknown> = { ...(params || {}) }
      // Slack chat.postMessage expects `channel`; we store `channel_id` in view params
      if (slug === "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL") {
        if (out.channel_id && !out.channel) {
          out.channel = out.channel_id
        }
      }
      // HubSpot create contact expects `{ properties: { ... } }` — keep as-is if present
      if (slug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES") {
        const props = out.properties as Record<string, unknown> | undefined
        if (props && typeof props === "object" && !Array.isArray(props)) {
          // no-op; already in expected shape
        }
      }
      return out
    }
    mergedParams = normalizeParamsForSlug(action.slug, mergedParams)

    const validation = await validateActionParameters(
      action.slug,
      (mergedParams as Record<string, unknown>) || {}
    )
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters for action",
          issues: validation.errors,
        },
        { status: 422 }
      )
    }

    // Resolve toolkit from curated actions and fetch global tool connection
    const { CURATED_ACTIONS } = await import("@/app/lib/actions/registry")
    const match = CURATED_ACTIONS.find((a) => a.slug === action.slug)
    toolkit = match?.toolkit || null
  }

  const provider = action.kind === "email" ? "usesend" : "composio"

  const result = await executeActionWithLogging({
    supabase,
    formId,
    userId: auth.user.id,
    authUserId: auth.user.id,
    submissionIds,
    source: "manual",
    action: {
      slug: action.slug,
      kind: action.kind,
      provider,
      params: mergedParams,
      idempotencyKey: action.idempotencyKey ?? null,
      viewId: parsed.data.viewId ?? null,
      toolsApplied: null,
      toolkit,
    },
  })

  if (result.success && result.status === "completed") {
    try {
      const rows = submissionIds.map((sid) => ({
        submission_id: sid,
        action_log_id: result.logId,
      }))
      if (rows.length) {
        await supabase
          .from("submission_action_logs")
          .upsert(rows as any, { onConflict: "submission_id,action_log_id" })
      }
    } catch (err) {
      logger.warn?.("[actions] failed to record submission_action_logs", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (result.success) {
    return NextResponse.json({
      success: true,
      status: result.status,
      provider,
      result: result.result,
    })
  }

  return NextResponse.json(
    { success: false, error: result.error },
    { status: result.status }
  )
}
