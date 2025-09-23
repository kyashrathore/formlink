import { randomUUID } from "node:crypto"
import {
  getComposioClient,
  isComposioEnabled,
} from "@/app/lib/actions/composio-client"
import { ActionExecutionError } from "@/app/lib/actions/errors"
import { validateActionParameters } from "@/app/lib/actions/schema-registry"
import { sendEmail } from "@/app/lib/actions/usesend-adapter"
import logger from "@/app/lib/logger"
import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import type { Json } from "@formlink/db"
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

function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJson(entry))
  }
  if (typeof value === "object") {
    const result: Record<string, Json> = {}
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = toJson(nested)
    }
    return result
  }
  return String(value)
}

function scrubParams(params: Record<string, unknown>): Json {
  const scrubbed: Record<string, Json> = {}
  const secretKeys = ["apiKey", "token", "authorization", "password", "secret"]
  for (const [key, value] of Object.entries(params || {})) {
    const lower = key.toLowerCase()
    if (secretKeys.some((secret) => lower.includes(secret))) {
      scrubbed[key] = value ? "[redacted]" : null
    } else {
      scrubbed[key] = toJson(value)
    }
  }
  return scrubbed
}

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

  let connectedAccountId: string | null = null
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
    const toolkit = match?.toolkit || null
    if (toolkit) {
      const { data: connRow, error: connError } = await supabase
        .from("tool_connections")
        .select("connected_account_id, auth_status")
        .eq("user_id", auth.user.id)
        .eq("provider", "composio")
        .eq("toolkit", toolkit)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (connError && connError.code !== "PGRST116") {
        logger.warn?.("[actions] failed to read tool connection", {
          error: connError.message,
        })
      }
      connectedAccountId = connRow?.connected_account_id ?? null
    }
  }

  let existingLogId: string | null = null
  if (action.idempotencyKey) {
    const { data: existingLog, error: selectError } = await supabase
      .from("response_actions_log")
      .select("id, status, provider_response")
      .eq("form_id", formId)
      .eq("action_name", action.slug)
      .eq("idempotency_key", action.idempotencyKey)
      .maybeSingle()

    if (selectError && selectError.code !== "PGRST116") {
      logger.error?.("[actions] failed to check idempotency", {
        error: selectError.message,
      })
    }

    if (existingLog) {
      if (existingLog.status === "completed") {
        return NextResponse.json({
          success: true,
          status: "duplicate",
          providerResponse: existingLog.provider_response,
        })
      }
      if (
        existingLog.status === "running" ||
        existingLog.status === "pending"
      ) {
        return NextResponse.json(
          { success: false, error: "Action is already in progress" },
          { status: 409 }
        )
      }
      existingLogId = existingLog.id
    }
  }

  const logId = existingLogId || randomUUID()
  const provider = action.kind === "email" ? "usesend" : "composio"

  const { error: upsertError } = await supabase
    .from("response_actions_log")
    .upsert(
      {
        id: logId,
        form_id: formId,
        action_name: action.slug,
        submission_ids: submissionIds,
        user_id: auth.user.id,
        status: "running",
        started_at: new Date().toISOString(),
        provider,
        idempotency_key: action.idempotencyKey ?? null,
        params: scrubParams(mergedParams),
        connected_account_id: connectedAccountId,
      },
      { onConflict: "id" }
    )

  if (upsertError) {
    logger.error?.("[actions] failed to upsert log", {
      error: upsertError.message,
    })
  }

  // Record per-submission linkages (sidecar rows) for activity views
  try {
    const rows = submissionIds.map((sid) => ({
      submission_id: sid,
      action_log_id: logId,
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

  try {
    if (action.kind === "email") {
      const result = await sendEmail(action.params as any)
      await supabase
        .from("response_actions_log")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: result
            ? toJson({ emailId: (result as { emailId?: string })?.emailId })
            : null,
        })
        .eq("id", logId)

      return NextResponse.json({
        success: true,
        status: "completed",
        provider: "usesend",
        result,
      })
    }

    if (!isComposioEnabled()) {
      throw new ActionExecutionError("Composio integration disabled", {
        status: 503,
        provider: "composio",
      })
    }

    const client = getComposioClient()
    const execution = await client.executeTool({
      toolSlug: action.slug,
      userId: auth.user.id,
      args: mergedParams,
    })

    await supabase
      .from("response_actions_log")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        provider_response: execution?.data ? toJson(execution.data) : null,
        result: execution?.data ? toJson(execution.data) : null,
      })
      .eq("id", logId)

    // No per-form auth status update; tool connections are global

    return NextResponse.json({
      success: true,
      status: "completed",
      provider: "composio",
      providerReference: execution?.providerReference,
      result: execution?.data,
    })
  } catch (error) {
    const status =
      error instanceof ActionExecutionError && error.status ? error.status : 500
    const message =
      error instanceof Error ? error.message : "Action execution failed"

    logger.error?.("[actions] execution failed", {
      error: message,
    })

    await supabase
      .from("response_actions_log")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", logId)

    return NextResponse.json({ success: false, error: message }, { status })
  }
}
