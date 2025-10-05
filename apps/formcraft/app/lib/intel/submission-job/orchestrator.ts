import { getModel } from "@/app/lib/ai/provider"
import { generateObject, generateText } from "@/app/lib/ai/tracing"
import logger from "@/app/lib/logger"
import { loadPrompt } from "@formlink/prompts"
import { tool } from "ai"
import { z } from "zod"
import {
  SUBMISSION_HOOKS,
  type LifecycleActionResult,
  type LifecycleOrchestratorInput,
  type LifecycleOrchestratorOutput,
  type LifecycleToolSummary,
  type SubmissionHook,
} from "./types"

const FAMILY_MODEL_ENV = "AI_SUBMISSION_INTEL_MODEL"

const spamSchema = z.object({
  score: z.number().min(0).max(1),
  flags: z.array(z.string()).default([]),
  summary: z.string().optional(),
})

const enrichmentSchema = z.object({
  enrichment: z
    .object({
      email: z.string().email().optional(),
      company: z
        .object({
          name: z.string().optional(),
          domain: z.string().optional(),
          website: z.string().url().optional(),
          size: z.string().optional(),
          industry: z.string().optional(),
        })
        .partial()
        .optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    })
    .partial()
    .default({}),
  summary: z.string().optional(),
})

const leadSchema = z.object({
  score: z.number().min(0).max(100),
  tier: z.enum(["A", "B", "C", "D"]),
  summary: z.string().optional(),
})

const tagSchema = z.object({
  tags: z.array(z.string()).default([]),
  summary: z.string().optional(),
})

type EmptyInput = Record<string, never>
type SpamResult = z.infer<typeof spamSchema>
type EnrichmentResult = z.infer<typeof enrichmentSchema>
type LeadResult = z.infer<typeof leadSchema>
type TagResult = z.infer<typeof tagSchema>
type ExecuteActionInput = {
  slug: string
  params?: Record<string, unknown>
  rationale?: string
}
type ExecuteActionResult = { accepted: boolean }

const DEFAULT_SIDECAR_KEYS = new Set(["spam", "lead", "tags", "enrichment"])

function stringifyContext(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}

export async function runLifecycleOrchestrator(
  input: LifecycleOrchestratorInput
): Promise<LifecycleOrchestratorOutput> {
  const toolsApplied: LifecycleToolSummary[] = []
  const sidecar: Record<string, unknown> = {}
  const requestedActions: LifecycleActionResult[] = []
  const requestedActionKeys = new Set<string>()
  const guardrails = input.config.guardrails
  const maxActions = Math.max(0, guardrails.maxActionsPerSubmission ?? 0)

  const resolvedHooks = Array.isArray(input.config.enabledHooks)
    ? (input.config.enabledHooks.filter((hook): hook is SubmissionHook =>
        (SUBMISSION_HOOKS as readonly string[]).includes(hook as string)
      ) as SubmissionHook[])
    : [...SUBMISSION_HOOKS]
  const enabledHooks = new Set<SubmissionHook>(resolvedHooks)

  const modelRef = getModel(process.env[FAMILY_MODEL_ENV])

  const allowedActions = new Map(
    input.config.allowedActions.map((action) => [action.slug, action])
  )

  const preferredKeys = new Set([
    ...DEFAULT_SIDECAR_KEYS,
    ...(input.config.sidecarKeys || []),
  ])

  const answersJson = stringifyContext(input.answers)
  const existingSidecar =
    (input.currentSidecar as Record<string, unknown> | undefined) || {}
  const sidecarJson = stringifyContext(existingSidecar)

  const hookCatalog: string[] = []

  const analyticsTools: Record<string, unknown> = {}

  // Gate spam tool behind env flag to allow staged rollout
  const spamEnv = (
    process.env.AI_SUBMISSION_INTEL_SPAM_ENABLED || ""
  ).toLowerCase()
  const spamEnabled = spamEnv === "true" || spamEnv === "1"

  if (enabledHooks.has("spam") && spamEnabled) {
    const spamSystem = await loadPrompt("intel/tool_spam_v1.md", {
      answers: answersJson,
      current_spam: stringifyContext(
        (existingSidecar as Record<string, unknown> | undefined)?.spam ?? {}
      ),
    })
    analyticsTools.detectSpam = tool<EmptyInput, SpamResult>({
      description:
        "Analyze submission answers for spam risk and return a score between 0 and 1 plus any notable flags.",
      inputSchema: z.object({}),
      execute: async (_input: Record<string, never>) => {
        const started = Date.now()
        const { object } = await generateObject({
          model: modelRef,
          schema: spamSchema,
          system: spamSystem,
          prompt: "",
        })
        sidecar.spam = { score: object.score, flags: object.flags }
        const summary = object.summary || `score=${object.score.toFixed(2)}`
        toolsApplied.push({
          name: "detectSpam",
          summary,
          durationMs: Date.now() - started,
        })
        return object
      },
    })
    hookCatalog.push("- spam check: evaluate spam likelihood and flags")
  }

  if (enabledHooks.has("enrichment")) {
    const enrichmentSystem = await loadPrompt("intel/tool_enrich_v1.md", {
      answers: answersJson,
      current_enrichment: stringifyContext(
        (existingSidecar as Record<string, unknown> | undefined)?.enrichment ??
          {}
      ),
    })
    analyticsTools.enrichSubmission = tool<EmptyInput, EnrichmentResult>({
      description:
        "Enrich submission with contact/company details inferred from provided answers.",
      inputSchema: z.object({}),
      execute: async (_input: Record<string, never>) => {
        const started = Date.now()
        const { object } = await generateObject({
          model: modelRef,
          schema: enrichmentSchema,
          system: enrichmentSystem,
          prompt: "",
        })
        if (Object.keys(object.enrichment || {}).length) {
          sidecar.enrichment = object.enrichment
        }
        const summary = object.summary || "enrichmentUpdated"
        toolsApplied.push({
          name: "enrichSubmission",
          summary,
          durationMs: Date.now() - started,
        })
        return object
      },
    })
    hookCatalog.push(
      "- enrichment: derive enrichment details (email, domain, etc.)"
    )
  }

  if (enabledHooks.has("lead")) {
    const leadSystem = await loadPrompt("intel/tool_lead_score_v1.md", {
      answers: answersJson,
      current_lead: stringifyContext(
        (existingSidecar as Record<string, unknown> | undefined)?.lead ?? {}
      ),
      // Provide enrichment context to improve fit/intent evaluation
      current_enrichment: stringifyContext(
        (existingSidecar as Record<string, unknown> | undefined)?.enrichment ??
          {}
      ),
    })
    analyticsTools.scoreLead = tool<EmptyInput, LeadResult>({
      description:
        "Score lead quality (0-100) and assign a tier A-D based on intent and fit.",
      inputSchema: z.object({}),
      execute: async (_input: Record<string, never>) => {
        const started = Date.now()
        const { object } = await generateObject({
          model: modelRef,
          schema: leadSchema,
          system: leadSystem,
          prompt: "",
        })
        sidecar.lead = { score: object.score, tier: object.tier }
        const summary =
          object.summary || `score=${object.score}, tier=${object.tier}`
        toolsApplied.push({
          name: "scoreLead",
          summary,
          durationMs: Date.now() - started,
        })
        return object
      },
    })
    hookCatalog.push("- lead score: evaluate lead score and tier")
  }

  if (enabledHooks.has("tags")) {
    const tagSystem = await loadPrompt("intel/tool_tags_v1.md", {
      answers: answersJson,
      current_tags: stringifyContext(
        (existingSidecar as Record<string, unknown> | undefined)?.tags ?? []
      ),
      allowed_tags: JSON.stringify(input.config.tagVocabulary || []),
    })
    analyticsTools.tagSubmission = tool<EmptyInput, TagResult>({
      description:
        "Suggest concise topical tags that describe the submission themes.",
      inputSchema: z.object({}),
      execute: async (_input: Record<string, never>) => {
        const started = Date.now()
        const { object } = await generateObject({
          model: modelRef,
          schema: tagSchema,
          system: tagSystem,
          prompt: "",
        })
        // Sanitize and enforce vocabulary + limits server-side
        const vocab = Array.isArray(input.config.tagVocabulary)
          ? new Set(
              (input.config.tagVocabulary || []).map((t) => t.toLowerCase())
            )
          : null
        const maxFromEnv = Number(process.env.AI_SUBMISSION_TAG_MAX || "")
        const MAX_TAGS =
          Number.isFinite(maxFromEnv) && maxFromEnv > 0
            ? Math.floor(maxFromEnv)
            : 5

        const seen = new Set<string>()
        const normalized: string[] = []
        for (const raw of object.tags || []) {
          if (typeof raw !== "string") continue
          const t = raw.trim().toLowerCase().replace(/\s+/g, " ")
          if (t.length < 2) continue
          // 1–3 words only
          if (t.split(" ").length > 3) continue
          if (vocab && !vocab.has(t)) continue
          if (!seen.has(t)) {
            seen.add(t)
            normalized.push(t)
          }
          if (normalized.length >= MAX_TAGS) break
        }

        sidecar.tags = normalized
        const summary =
          object.summary ||
          (normalized.length ? normalized.join(",") : "no_tags")
        toolsApplied.push({
          name: "tagSubmission",
          summary,
          durationMs: Date.now() - started,
        })
        return object
      },
    })
    hookCatalog.push("- auto-tagging: suggest topical tags from answers")
  }

  const executeActionTool = tool<ExecuteActionInput, ExecuteActionResult>({
    description:
      "Execute an allowed lifecycle action once analytic tools have run.",
    inputSchema: z.object({
      slug: z.string(),
      params: z.record(z.any()).optional(),
      rationale: z.string().max(180).optional(),
    }),
    execute: async ({ slug, params, rationale }) => {
      const started = Date.now()

      if (!input.config.enabled) {
        throw new Error("Lifecycle automation disabled")
      }

      if (input.isTestmode && guardrails.skipTestmode) {
        throw new Error("Guardrails skip testmode submissions")
      }

      if (maxActions <= 0) {
        throw new Error("Max actions per submission is zero")
      }

      if (requestedActions.length >= maxActions) {
        throw new Error("Action limit already reached")
      }

      const allowed = allowedActions.get(slug)
      if (!allowed) {
        throw new Error(`Action '${slug}' is not in allowedActions`)
      }

      const effectiveParams =
        params && Object.keys(params).length ? params : allowed.params

      const key = `${slug}:${JSON.stringify(effectiveParams || {})}`
      if (requestedActionKeys.has(key)) {
        throw new Error(`Action '${slug}' already requested with these params`)
      }
      requestedActionKeys.add(key)

      requestedActions.push({
        slug,
        provider: allowed.provider,
        params: effectiveParams || {},
        rationale,
      })

      toolsApplied.push({
        name: "executeAction",
        summary: slug,
        durationMs: Date.now() - started,
      })

      return { accepted: true }
    },
  })

  const system = await loadPrompt("intel/submission_lifecycle_system_v1.md", {
    form_id: input.formId,
    submission_id: input.submissionId,
    trigger: input.trigger,
    lifecycle_enabled: String(input.config.enabled),
    max_actions_per_submission: String(maxActions),
    cooldown_seconds: String(guardrails.cooldownSeconds ?? 0),
    skip_testmode: String(Boolean(guardrails.skipTestmode)),
    submission_status: input.trigger,
    is_testmode: String(Boolean(input.isTestmode)),
    current_sidecar: sidecarJson,
    allowed_actions: JSON.stringify(input.config.allowedActions ?? []),
    preferred_sidecar_keys: JSON.stringify([...preferredKeys]),
    operator_prompt: input.config.orchestratorPrompt || "",
    answers: answersJson,
    hook_catalog:
      hookCatalog.length > 0
        ? hookCatalog.join("\n")
        : "- (submission hooks disabled)",
  })

  try {
    await generateText({
      model: modelRef,
      system,
      prompt: "",
      toolChoice: "auto",
      tools: {
        ...(analyticsTools as Record<string, ReturnType<typeof tool>>),
        executeAction: executeActionTool,
      },
    })
  } catch (error) {
    logger.error("[Lifecycle] AI orchestrator failed", {
      submissionId: input.submissionId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const sidecarUpdates: Record<string, unknown> = {}
  Object.entries(sidecar).forEach(([key, value]) => {
    if (preferredKeys.size === 0 || preferredKeys.has(key)) {
      sidecarUpdates[key] = value
    }
  })

  return {
    sidecarUpdates,
    actions: requestedActions,
    toolsApplied,
  }
}
