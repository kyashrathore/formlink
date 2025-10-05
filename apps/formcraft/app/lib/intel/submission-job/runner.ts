import logger from "@/app/lib/logger"
import { createServerClient, SupabaseClient } from "@formlink/db"
import { executeLifecycleActions } from "./executor"
import { runLifecycleOrchestrator } from "./orchestrator"
import { applySidecarUpdates } from "./sidecar"
import type {
  LifecycleConfig,
  LifecycleGuardrails,
  LifecycleOrchestratorInput,
  LifecycleOrchestratorOutput,
  SubmissionLifecycleTrigger,
} from "./types"
import { SUBMISSION_HOOKS } from "./types"

type JsonObject = Record<string, unknown>

const DEFAULT_GUARDRAILS: LifecycleGuardrails = {
  skipTestmode: true,
  maxActionsPerSubmission: 3,
}

async function getServiceClient(): Promise<SupabaseClient> {
  return createServerClient(null, "service")
}

function normalizeLifecycleConfig(raw: unknown): LifecycleConfig | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const enabled = Boolean(obj.enabled)
  const guardrailsSource =
    obj.guardrails &&
    typeof obj.guardrails === "object" &&
    !Array.isArray(obj.guardrails)
      ? (obj.guardrails as object)
      : {}
  const guardrails = {
    ...DEFAULT_GUARDRAILS,
    ...guardrailsSource,
  }
  const allowedActions = Array.isArray(obj.allowedActions)
    ? (obj.allowedActions as any[])
        .filter(
          (action) =>
            action &&
            typeof action.slug === "string" &&
            (action.provider === "usesend" || action.provider === "composio")
        )
        .map((action) => ({
          slug: String(action.slug),
          provider: action.provider as "usesend" | "composio",
          params: (action.params as Record<string, unknown>) || {},
        }))
    : []

  // Optional: per-form tag vocabulary; fallback to env if provided
  let tagVocabulary: string[] | undefined
  if (Array.isArray(obj.tagVocabulary)) {
    tagVocabulary = (obj.tagVocabulary as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().toLowerCase())
  } else if (
    typeof process !== "undefined" &&
    process.env.AI_SUBMISSION_TAG_VOCAB
  ) {
    tagVocabulary = String(process.env.AI_SUBMISSION_TAG_VOCAB)
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  }

  // Preserve enabledHooks and sanitize to allowed set. Back-compat: map enabledTools -> enabledHooks
  let enabledHooks: typeof SUBMISSION_HOOKS | undefined
  const rawEnabledHooks = Array.isArray((obj as any).enabledHooks)
    ? ((obj as any).enabledHooks as unknown[])
    : Array.isArray((obj as any).enabledTools)
    ? ((obj as any).enabledTools as unknown[])
    : undefined

  if (rawEnabledHooks) {
    const allowed = new Set<string>(SUBMISSION_HOOKS as readonly string[])
    const cleaned = rawEnabledHooks
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => allowed.has(v)) as unknown as typeof SUBMISSION_HOOKS
    if (cleaned.length) enabledHooks = cleaned
  }

  return {
    enabled,
    guardrails,
    sidecarKeys: Array.isArray(obj.sidecarKeys)
      ? (obj.sidecarKeys as string[])
      : undefined,
    allowedActions,
    orchestratorPrompt:
      typeof obj.orchestratorPrompt === "string"
        ? obj.orchestratorPrompt
        : undefined,
    enabledHooks,
    tagVocabulary,
  }
}

export interface RunSubmissionJobOptions {
  submissionId: string
  formVersionId?: string | null
  trigger: SubmissionLifecycleTrigger
}

export async function runSubmissionJob(
  options: RunSubmissionJobOptions
): Promise<void> {
  const supabase = await getServiceClient()

  const { submissionId } = options
  const start = Date.now()

  const { data: submission, error: submissionError } = await supabase
    .from("form_submissions")
    .select(
      "submission_id, form_version_id, status, testmode, metadata, last_updated_at"
    )
    .eq("submission_id", submissionId)
    .maybeSingle()

  if (submissionError) {
    logger.error("[Lifecycle] Failed to load submission", {
      submissionId,
      error: submissionError.message,
    })
    return
  }

  if (!submission) {
    logger.warn("[Lifecycle] Submission not found", { submissionId })
    return
  }

  const formVersionId = options.formVersionId || submission.form_version_id
  if (!formVersionId) {
    logger.warn("[Lifecycle] Missing form version for submission", {
      submissionId,
    })
    return
  }

  const { data: version, error: versionError } = await supabase
    .from("form_versions")
    .select("form_id")
    .eq("version_id", formVersionId)
    .maybeSingle()

  if (versionError || !version?.form_id) {
    logger.error("[Lifecycle] Failed to load form version", {
      submissionId,
      formVersionId,
      error: versionError?.message,
    })
    return
  }

  const formId = version.form_id as string

  const { data: formRow, error: formError } = await supabase
    .from("forms")
    .select("id, user_id, agent_state")
    .eq("id", formId)
    .maybeSingle()

  if (formError || !formRow) {
    logger.error("[Lifecycle] Failed to load form row", {
      submissionId,
      formId,
      error: formError?.message,
    })
    return
  }

  const lifecycleConfig = normalizeLifecycleConfig(
    (formRow.agent_state as JsonObject | null)?.lifecycle_v1
  )

  if (!lifecycleConfig || !lifecycleConfig.enabled) {
    logger.info("[Lifecycle] Lifecycle automation disabled", {
      submissionId,
      formId,
    })
    return
  }

  if (submission.testmode && lifecycleConfig.guardrails.skipTestmode) {
    logger.info("[Lifecycle] Skipping test submission", {
      submissionId,
      formId,
    })
    return
  }

  const { data: answerRows, error: answersError } = await supabase
    .from("form_answers")
    .select("question_id, answer_value")
    .eq("submission_id", submissionId)

  if (answersError) {
    logger.error("[Lifecycle] Failed to load answers", {
      submissionId,
      error: answersError.message,
    })
    return
  }

  const answers: Record<string, unknown> = {}
  answerRows?.forEach((row) => {
    answers[row.question_id] = row.answer_value
  })

  const currentSidecar =
    ((submission.metadata as JsonObject | undefined)?.sidecar as JsonObject) ||
    {}

  const orchestratorInput: LifecycleOrchestratorInput = {
    formId,
    submissionId,
    formVersionId,
    answers,
    currentSidecar,
    config: lifecycleConfig,
    trigger: options.trigger,
    isTestmode: Boolean(submission.testmode),
  }

  let output: LifecycleOrchestratorOutput
  try {
    output = await runLifecycleOrchestrator(orchestratorInput)
  } catch (orchestratorError) {
    logger.error("[Lifecycle] Orchestrator failed", {
      submissionId,
      error:
        orchestratorError instanceof Error
          ? orchestratorError.message
          : orchestratorError,
    })
    return
  }

  try {
    await applySidecarUpdates(supabase, submissionId, output.sidecarUpdates)
  } catch (sidecarError) {
    logger.error("[Lifecycle] Failed to apply sidecar updates", {
      submissionId,
      error:
        sidecarError instanceof Error ? sidecarError.message : sidecarError,
    })
  }

  try {
    await executeLifecycleActions({
      supabase,
      formId,
      submissionId,
      ownerUserId: formRow.user_id as string,
      lifecycleConfig,
      actions: output.actions,
      toolsApplied: output.toolsApplied,
    })
  } catch (actionsError) {
    logger.error("[Lifecycle] Failed to execute lifecycle actions", {
      submissionId,
      error:
        actionsError instanceof Error ? actionsError.message : actionsError,
    })
  }

  logger.info("[Lifecycle] Job completed", {
    submissionId,
    formId,
    trigger: options.trigger,
    durationMs: Date.now() - start,
    toolsApplied: output.toolsApplied.map((tool) => tool.name),
  })
}
