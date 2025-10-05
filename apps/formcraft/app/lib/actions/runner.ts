import { randomUUID } from "node:crypto"
import {
  getComposioClient,
  isComposioEnabled,
} from "@/app/lib/actions/composio-client"
import { ActionExecutionError } from "@/app/lib/actions/errors"
import { sendEmail } from "@/app/lib/actions/usesend-adapter"
import logger from "@/app/lib/logger"
import type { SupabaseClient } from "@formlink/db"

export type ActionSource = "manual" | "view" | "lifecycle"

export interface ExecuteActionParams {
  supabase: SupabaseClient
  formId: string
  userId: string
  authUserId: string
  submissionIds: string[]
  action: {
    slug: string
    kind: "email" | "composio"
    provider: "usesend" | "composio"
    params: Record<string, unknown>
    idempotencyKey?: string | null
    viewId?: string | null
    toolsApplied?: Array<Record<string, unknown>> | null
    toolkit?: string | null
  }
  source: ActionSource
}

export type ExecuteActionResult =
  | {
      success: true
      status: "completed" | "duplicate"
      result?: unknown
      logId: string
    }
  | { success: false; status: number; error: string; logId?: string }

function toJson(value: unknown): unknown {
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
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = toJson(nested)
    }
    return result
  }
  return String(value)
}

function scrubParams(params: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {}
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

export async function executeActionWithLogging(
  params: ExecuteActionParams
): Promise<ExecuteActionResult> {
  const {
    supabase,
    formId,
    userId,
    authUserId,
    submissionIds,
    action,
    source,
  } = params

  const idempotencyKey = action.idempotencyKey || null
  let existingLogId: string | null = null
  if (idempotencyKey) {
    const { data: existingLog, error: selectError } = await supabase
      .from("response_actions_log")
      .select("id, status, provider_response")
      .eq("form_id", formId)
      .eq("action_name", action.slug)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (selectError && selectError.code !== "PGRST116") {
      logger.error?.("[actions] failed to check idempotency", {
        error: selectError.message,
      })
    }

    if (existingLog) {
      if (existingLog.status === "completed") {
        return {
          success: true,
          status: "duplicate",
          result: existingLog.provider_response,
          logId: existingLog.id,
        }
      }
      if (
        existingLog.status === "running" ||
        existingLog.status === "pending"
      ) {
        return {
          success: false,
          status: 409,
          error: "Action is already in progress",
        }
      }
      existingLogId = existingLog.id
    }
  }

  let connectedAccountId: string | null = null
  if (action.kind === "composio") {
    const toolkit = action.toolkit || action.slug.split("_")[0] || ""
    const { data: connRow, error: connError } = await supabase
      .from("tool_connections")
      .select("connected_account_id, auth_status")
      .eq("user_id", authUserId)
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

  const logId = existingLogId || randomUUID()

  const { error: upsertError } = await supabase
    .from("response_actions_log")
    .upsert(
      {
        id: logId,
        form_id: formId,
        user_id: authUserId,
        submission_ids: submissionIds,
        action_name: action.slug,
        status: "running",
        started_at: new Date().toISOString(),
        provider: action.provider,
        idempotency_key: idempotencyKey,
        params: scrubParams(action.params),
        connected_account_id: connectedAccountId,
        view_id: action.viewId ?? null,
        source,
        tools_applied: action.toolsApplied || null,
      },
      { onConflict: "id" }
    )

  if (upsertError) {
    logger.error?.("[actions] failed to upsert log", {
      error: upsertError.message,
    })
    return {
      success: false,
      status: 500,
      error: "Failed to record action log",
      logId,
    }
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

      return { success: true, status: "completed", result, logId }
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
      userId,
      args: action.params,
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

    return {
      success: true,
      status: "completed",
      result: execution?.data,
      logId,
    }
  } catch (error) {
    const status =
      error instanceof ActionExecutionError && error.status ? error.status : 500
    const message =
      error instanceof Error ? error.message : "Action execution failed"

    logger.error?.("[actions] execution failed", { error: message })

    await supabase
      .from("response_actions_log")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", logId)

    return { success: false, status, error: message, logId }
  }
}
