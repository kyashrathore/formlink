import { createHash } from "node:crypto"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import { executeActionWithLogging } from "@/app/lib/actions/runner"
import logger from "@/app/lib/logger"
import type { SupabaseClient } from "@formlink/db"
import type {
  LifecycleActionResult,
  LifecycleConfig,
  LifecycleToolSummary,
} from "./types"

export interface ExecuteActionsInput {
  supabase: SupabaseClient
  formId: string
  submissionId: string
  ownerUserId: string
  lifecycleConfig: LifecycleConfig
  actions: LifecycleActionResult[]
  toolsApplied: LifecycleToolSummary[]
}

export interface ExecuteActionsOutput {
  executed: LifecycleActionResult[]
}

export async function executeLifecycleActions(
  input: ExecuteActionsInput
): Promise<ExecuteActionsOutput> {
  if (!input.actions.length) {
    return { executed: [] }
  }

  logger.info("[Lifecycle] Actions proposed", {
    formId: input.formId,
    submissionId: input.submissionId,
    proposedCount: input.actions.length,
  })

  const guardrails = input.lifecycleConfig.guardrails
  const allowedSlugs = new Set(
    input.lifecycleConfig.allowedActions.map((action) => action.slug)
  )

  const curatedMap = new Map(
    CURATED_ACTIONS.map((action) => [action.slug, action.toolkit || null])
  )

  const unique: LifecycleActionResult[] = []
  const seen = new Set<string>()
  for (const action of input.actions) {
    if (!allowedSlugs.has(action.slug)) continue
    const key = `${action.slug}:${JSON.stringify(action.params || {})}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(action)
  }

  const limit = guardrails.maxActionsPerSubmission ?? unique.length
  const limited = limit > 0 ? unique.slice(0, limit) : unique
  const executed: LifecycleActionResult[] = []

  const cooldownSeconds = input.lifecycleConfig.guardrails.cooldownSeconds || 0

  for (const action of limited) {
    if (cooldownSeconds > 0) {
      const cutoff = new Date(Date.now() - cooldownSeconds * 1000).toISOString()
      const { data: recentLog, error: cooldownError } = await input.supabase
        .from("response_actions_log")
        .select("id, completed_at")
        .eq("form_id", input.formId)
        .eq("action_name", action.slug)
        .eq("source", "lifecycle")
        .eq("status", "completed")
        .contains("submission_ids", [input.submissionId])
        .gte("completed_at", cutoff)
        .maybeSingle()

      if (cooldownError && cooldownError.code !== "PGRST116") {
        logger.warn("[Lifecycle] Cooldown check failed", {
          submissionId: input.submissionId,
          formId: input.formId,
          action: action.slug,
          error: cooldownError.message,
        })
      }

      if (recentLog) {
        logger.info("[Lifecycle] Action skipped due to cooldown", {
          submissionId: input.submissionId,
          action: action.slug,
          cooldownSeconds,
        })
        continue
      }
    }

    const idempotencyKey = createHash("sha256")
      .update(
        `${input.submissionId}:${action.slug}:${JSON.stringify(
          action.params || {}
        )}`
      )
      .digest("hex")

    const result = await executeActionWithLogging({
      supabase: input.supabase,
      formId: input.formId,
      userId: input.ownerUserId,
      authUserId: input.ownerUserId,
      submissionIds: [input.submissionId],
      source: "lifecycle",
      action: {
        slug: action.slug,
        kind: action.provider === "usesend" ? "email" : "composio",
        provider: action.provider,
        params: action.params,
        idempotencyKey,
        viewId: null,
        toolsApplied: input.toolsApplied as any,
        toolkit: curatedMap.get(action.slug) || null,
      },
    })

    if (result.success && result.status === "completed") {
      executed.push(action)
      try {
        await input.supabase.from("submission_action_logs").upsert(
          [
            {
              submission_id: input.submissionId,
              action_log_id: result.logId,
            },
          ] as any,
          { onConflict: "submission_id,action_log_id" }
        )
      } catch (err) {
        logger.warn("[Lifecycle] failed to link submission_action_logs", {
          submissionId: input.submissionId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return { executed }
}
