export type SubmissionLifecycleTrigger = "completed" | "partial" | "manual"

export interface LifecycleGuardrails {
  skipTestmode: boolean
  maxActionsPerSubmission: number
  cooldownSeconds?: number
}

export interface LifecycleAllowedAction {
  slug: string
  provider: "usesend" | "composio"
  params: Record<string, unknown>
}

export const SUBMISSION_HOOKS = ["spam", "enrichment", "lead", "tags"] as const

export type SubmissionHook = (typeof SUBMISSION_HOOKS)[number]

export interface LifecycleConfig {
  enabled: boolean
  guardrails: LifecycleGuardrails
  sidecarKeys?: string[]
  allowedActions: LifecycleAllowedAction[]
  orchestratorPrompt?: string
  enabledHooks?: SubmissionHook[]
  /** Optional fixed vocabulary of allowed tags. When provided, AI output is filtered to this set. */
  tagVocabulary?: string[]
}

export interface LifecycleToolSummary {
  name: string
  summary?: string
  durationMs?: number
}

export interface LifecycleActionResult {
  slug: string
  provider: "usesend" | "composio"
  params: Record<string, unknown>
  rationale?: string
}

export interface LifecycleOrchestratorInput {
  formId: string
  submissionId: string
  formVersionId?: string | null
  answers: Record<string, unknown>
  currentSidecar: Record<string, unknown>
  config: LifecycleConfig
  trigger: SubmissionLifecycleTrigger
  isTestmode: boolean
}

export interface LifecycleOrchestratorOutput {
  sidecarUpdates: Record<string, unknown>
  actions: LifecycleActionResult[]
  toolsApplied: LifecycleToolSummary[]
}
