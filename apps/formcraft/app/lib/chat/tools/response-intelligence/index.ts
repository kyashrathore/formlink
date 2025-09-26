import { getModel } from "@/app/lib/ai/provider"
import { repairJSON } from "@/app/lib/ai/repair"
import { generateObject, generateText } from "@/app/lib/ai/tracing"
import { TOOL_DESCRIPTIONS } from "@/app/lib/chat/prompts"
import { ChatToolContext } from "@/app/lib/chat/types"
import logger from "@/app/lib/logger"
import {
  RIInsightSpecSchema,
  RIPlan,
  RIPlanResponse,
  RIPlanResponseSchema,
  RISortSchema,
} from "@/app/lib/ri/types"
import { tool } from "ai"
import { z } from "zod"
import { buildActionsPromptContext } from "./actions-context"
import { loadFormQuestionsMeta, resolveFormVersionId } from "./form-context"
import { extractFirstJSONObject } from "./json"
import { autoFixRIPlan, repairRIPlanWithAI } from "./plan-repair"
import { buildSystemPrompt } from "./prompt"

const RIInputSchema = z
  .object({
    prompt: z
      .string()
      .describe(
        "User's instruction for responses analysis (filters, columns, actions)."
      ),
    planContext: z
      .object({
        mode: z.enum(["new", "refine"]).optional(),
        correlationId: z.string().optional(),
        currentPlan: RIPlanResponseSchema.optional(),
        // Hints injected by server; model may ignore
        saved: z.boolean().optional(),
        previousPlan: z
          .object({
            correlationId: z.string().optional(),
            status: z.enum(["unsaved", "saved", "discarded"]).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .strict()

// Update schema for deterministic patching (no AI inside tool)
const ColumnsPatchSchema = z
  .object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
    replace: z.array(z.string()).optional(),
  })
  .strict()

const SortPatchSchema = z
  .object({ set: RISortSchema.nullable().optional() })
  .strict()

const InsightsRemoveByIndexSchema = z
  .object({ index: z.number().int().min(0) })
  .strict()
const InsightsUpdateSchema = z
  .object({
    matchBy: z.object({ index: z.number().int().min(0).optional() }).strict(),
    patch: z
      .object({
        type: z
          .enum(["count", "trend", "breakdown", "metric", "text", "summary"])
          .optional(),
        args: z.any().optional(),
      })
      .catchall(z.any()),
  })
  .strict()

const InsightsPatchSchema = z
  .object({
    add: z.array(RIInsightSpecSchema).optional(),
    update: z.array(InsightsUpdateSchema).optional(),
    remove: z.array(InsightsRemoveByIndexSchema).optional(),
  })
  .strict()

const ActionsRemoveSchema = z.union([
  z.object({ index: z.number().int().min(0) }).strict(),
  z.object({ action_key: z.string() }).strict(),
])

const ActionsUpdateSchema = z
  .object({
    matchBy: z
      .object({
        index: z.number().int().min(0).optional(),
        action_key: z.string().optional(),
      })
      .strict(),
    patch: z
      .object({
        params: z.record(z.any()).optional(),
        title: z.string().optional(),
        provider: z.enum(["usesend", "composio"]).optional(),
      })
      .strict(),
  })
  .strict()

const ActionsPatchSchema = z
  .object({
    add: z
      .array(
        z
          .object({
            action_key: z.string(),
            params: z.record(z.any()).default({}),
            title: z.string().optional(),
            provider: z.enum(["usesend", "composio"]).optional(),
          })
          .strict()
      )
      .optional(),
    update: z.array(ActionsUpdateSchema).optional(),
    remove: z.array(ActionsRemoveSchema).optional(),
  })
  .strict()

const RPCPatchSchema = z
  .object({
    submission_filters: z.record(z.any()).optional(),
    answer_filters: z.record(z.any()).optional(),
    page_size: z.number().int().positive().max(200).nullable().optional(),
  })
  .strict()

export const ResponseViewUpdatesSchema = z
  .object({
    rpc: RPCPatchSchema.optional(),
    ui: z
      .object({
        columns: ColumnsPatchSchema.optional(),
        sort: SortPatchSchema.optional(),
        insights: InsightsPatchSchema.optional(),
      })
      .strict()
      .optional(),
    actions: ActionsPatchSchema.optional(),
    meta: z.object({ view_name: z.string().optional() }).strict().optional(),
  })
  .strict()

type ResponseViewUpdates = z.infer<typeof ResponseViewUpdatesSchema>

function unique(arr: string[]) {
  return Array.from(new Set(arr))
}

function applyResponseViewUpdates(
  plan: RIPlanResponse,
  updates: ResponseViewUpdates
): RIPlanResponse {
  const next: RIPlanResponse = JSON.parse(JSON.stringify(plan))
  // rpc
  if (updates.rpc) {
    const rpc = next.plan.rpc
    if (updates.rpc.submission_filters) {
      for (const [k, v] of Object.entries(updates.rpc.submission_filters)) {
        if (v === null) delete (rpc.submission_filters as any)[k]
        else (rpc.submission_filters as any)[k] = v
      }
    }
    if (updates.rpc.answer_filters) {
      for (const [k, v] of Object.entries(updates.rpc.answer_filters)) {
        if (v === null) delete (rpc.answer_filters as any)[k]
        else (rpc.answer_filters as any)[k] = v
      }
    }
    if ("page_size" in updates.rpc) {
      const ps = updates.rpc.page_size
      if (ps == null) delete (rpc as any).page_size
      else rpc.page_size = ps
    }
  }
  // ui
  if (updates.ui) {
    const ui = next.plan.ui
    if (updates.ui.columns) {
      const { add, remove, replace } = updates.ui.columns
      if (replace) ui.columns = unique(replace)
      if (add && !replace) ui.columns = unique([...(ui.columns || []), ...add])
      if (remove && !replace)
        ui.columns = (ui.columns || []).filter((c) => !remove.includes(c))
    }
    if (updates.ui.sort) {
      const s = updates.ui.sort.set
      if (s == null) delete (ui as any).sort
      else ui.sort = s
    }
    if (updates.ui.insights) {
      const ins = ui.insights_spec || []
      if (updates.ui.insights.add?.length) ins.push(...updates.ui.insights.add)
      if (updates.ui.insights.update?.length) {
        for (const upd of updates.ui.insights.update) {
          const idx =
            typeof upd.matchBy.index === "number" ? upd.matchBy.index : -1
          if (idx >= 0 && idx < ins.length) {
            const current = ins[idx] as any
            ins[idx] = { ...current, ...upd.patch }
          }
        }
      }
      if (updates.ui.insights.remove?.length) {
        const toRemove = new Set(updates.ui.insights.remove.map((r) => r.index))
        ui.insights_spec = ins.filter((_, i) => !toRemove.has(i))
      } else ui.insights_spec = ins
    }
  }
  // actions
  if (updates.actions) {
    type Action = NonNullable<RIPlan["actions"]>[number]
    const arr: Action[] = Array.isArray(next.plan.actions)
      ? (next.plan.actions as Action[])
      : []
    if (updates.actions.add?.length) arr.push(...updates.actions.add)
    if (updates.actions.update?.length) {
      for (const u of updates.actions.update) {
        let i = -1
        if (typeof u.matchBy.index === "number") i = u.matchBy.index
        else if (u.matchBy.action_key)
          i = arr.findIndex((a) => a.action_key === u.matchBy.action_key)
        if (i >= 0 && i < arr.length) {
          const p = u.patch
          arr[i] = {
            ...arr[i],
            ...(p.title !== undefined ? { title: p.title } : {}),
            ...(p.provider !== undefined ? { provider: p.provider } : {}),
            ...(p.params !== undefined ? { params: p.params } : {}),
          } as Action
        }
      }
    }
    if (updates.actions.remove?.length) {
      const rmIdx = new Set<number>()
      for (const r of updates.actions.remove) {
        if ("index" in r) rmIdx.add(r.index)
        else if ("action_key" in r) {
          const idx = arr.findIndex((a) => a.action_key === r.action_key)
          if (idx >= 0) rmIdx.add(idx)
        }
      }
      next.plan.actions = arr.filter((_, i) => !rmIdx.has(i))
    } else next.plan.actions = arr
  }
  // meta
  if (updates.meta?.view_name) {
    next.plan.meta = {
      ...(next.plan.meta || {}),
      view_name: updates.meta.view_name,
    }
  }
  return next
}

export function createResponseViewTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.createResponseView,
    inputSchema: RIInputSchema,
    execute: async ({ prompt, planContext }) => {
      const { formId, supabase, userId, dataStream } = context

      // Merge client-provided planContext from options (fallback) if model omitted it
      const optionsPlanContext = (context.options as any)?.planContext
      const mergedPlanContext = planContext ?? optionsPlanContext ?? undefined

      logger.info("[RI] Tool invoked", {
        formId,
        userId,
        promptPreview: typeof prompt === "string" ? prompt.slice(0, 160) : "",
        planContext: {
          mode: mergedPlanContext?.mode,
          hasCurrentPlan: Boolean(mergedPlanContext?.currentPlan),
          correlationId: mergedPlanContext?.correlationId,
          saved: mergedPlanContext?.saved,
          previousPlan: mergedPlanContext?.previousPlan,
        },
      })

      const formVersionId = await resolveFormVersionId(supabase, formId)
      let questionIds: string[] = []
      let questionsMeta: Awaited<
        ReturnType<typeof loadFormQuestionsMeta>
      >["questionsMeta"] = []

      if (formVersionId) {
        const questionContext = await loadFormQuestionsMeta(
          supabase,
          formVersionId
        )
        questionIds = questionContext.questionIds
        questionsMeta = questionContext.questionsMeta
        logger.info("[RI] Loaded form context", {
          formId,
          formVersionId,
          questionCount: questionIds.length,
        })
      }

      const isRefine = Boolean(mergedPlanContext?.currentPlan)
      const mode = mergedPlanContext?.mode || (isRefine ? "refine" : "new")

      const actionsPrompt = buildActionsPromptContext()
      const STRICT_JSON_SYSTEM = await buildSystemPrompt(actionsPrompt, {
        form_id: formId,
        form_version_id: formVersionId ?? null,
        question_ids: questionIds,
        form_questions: questionsMeta as any,
        user_prompt: prompt,
        ui_hints: { defaultColumns: ["created_at", "status"] },
        current_plan: mergedPlanContext?.currentPlan || null,
        mode,
        plan_disposition: {
          saved: Boolean(mergedPlanContext?.saved),
          previous_plan: mergedPlanContext?.previousPlan || null,
        },
      })

      const inputPayload = {
        formId,
        formVersionId,
        questionIds,
        formQuestions: questionsMeta,
        userPrompt: prompt,
        uiHints: { defaultColumns: ["created_at", "status"] },
        currentPlan: mergedPlanContext?.currentPlan || null,
        mode,
        planDisposition: {
          saved: Boolean(mergedPlanContext?.saved),
          previousPlan: mergedPlanContext?.previousPlan || null,
        },
      }

      try {
        const selectedModel = (context.options as any)?.model
        const MODEL = getModel(selectedModel)
        const startedAt = Date.now()

        logger.info("[RI] generateObject start", {
          formId,
          userId,
          model: String(MODEL),
          systemChars: STRICT_JSON_SYSTEM.length,
          inputKeys: Object.keys(inputPayload),
          actionsSummary: actionsPrompt.summary,
        })

        let candidate: any
        try {
          const { object } = await generateObject({
            model: MODEL,
            schema: RIPlanResponseSchema,
            system: STRICT_JSON_SYSTEM,
            prompt: "",
          })
          candidate = object
          logger.info("[RI] generateObject success", {
            formId,
            userId,
            durationMs: Date.now() - startedAt,
          })
        } catch (generateError) {
          logger.warn("[RI] generateObject failed; falling back to text", {
            error:
              generateError instanceof Error
                ? generateError.message
                : String(generateError),
          })

          const textStart = Date.now()
          logger.info("[RI] generateText start (fallback)", {
            formId,
            userId,
            model: String(MODEL),
            systemChars: STRICT_JSON_SYSTEM.length,
          })

          const textRes = await generateText({
            model: MODEL,
            system: STRICT_JSON_SYSTEM,
            prompt: "",
          })

          logger.info("[RI] generateText success (fallback)", {
            formId,
            userId,
            durationMs: Date.now() - textStart,
          })

          const raw = textRes.text || ""
          const cleaned = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")

          const jsonStr = extractFirstJSONObject(cleaned)
          if (!jsonStr) {
            return { success: false, error: "AI returned non-JSON content" }
          }

          try {
            candidate = JSON.parse(jsonStr)
          } catch (parseError) {
            logger.error("[RI] JSON parse failed", {
              error:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            })
            return { success: false, error: "JSON parse failed" }
          }
        }

        const durationMs = Date.now() - startedAt
        const preSpecs = Array.isArray(candidate?.plan?.ui?.insights_spec)
          ? candidate.plan.ui.insights_spec
          : []

        logger.info("[RI] Plan candidate generated", {
          formId,
          userId,
          model: String(MODEL),
          durationMs,
          preInsightsCount: preSpecs.length,
          preInsightTypes: preSpecs
            .map((entry: any) => entry?.type)
            .slice(0, 12),
        })

        let planObj = candidate
        const parsed = RIPlanResponseSchema.safeParse(planObj)
        if (!parsed.success) {
          logger.warn("[RI] Initial schema validation failed", {
            issues: parsed.error.issues.map(
              (issue) => issue.path.join(".") + ": " + issue.message
            ),
          })

          const autoFixed = autoFixRIPlan(planObj, parsed.error)
          const afterAutoFix = RIPlanResponseSchema.safeParse(autoFixed)

          if (!afterAutoFix.success) {
            logger.warn(
              "[RI] Schema validation still failing after auto-fix; invoking AI repair",
              {
                issues: afterAutoFix.error.issues,
              }
            )

            const repairStart = Date.now()
            logger.info("[RI] repairRIPlanWithAI start", {
              formId,
              userId,
              providerModel: String(MODEL),
              issueCount: afterAutoFix.error.issues.length,
            })

            const generation_context = {
              system_prompt: STRICT_JSON_SYSTEM,
              user_prompt: inputPayload,
              model: String(MODEL),
              schema_name: "RIPlanResponseSchema",
              schema_version: "current",
              timestamp: new Date().toISOString(),
            }

            const repaired = await repairRIPlanWithAI(
              autoFixed,
              afterAutoFix.error,
              generation_context
            )

            logger.info("[RI] repairRIPlanWithAI done", {
              formId,
              userId,
              durationMs: Date.now() - repairStart,
              success: Boolean(repaired),
            })

            if (!repaired) {
              logger.info("[RI] repairJSON fallback start", {
                formId,
                userId,
              })

              const genericRepaired = await repairJSON(
                autoFixed,
                RIPlanResponseSchema,
                afterAutoFix.error
              )

              logger.info("[RI] repairJSON fallback done", {
                formId,
                userId,
                success: Boolean(genericRepaired),
              })

              if (!genericRepaired) {
                return {
                  success: false,
                  error: "Unable to repair JSON to schema",
                }
              }

              planObj = genericRepaired
            } else {
              planObj = repaired
            }
          } else {
            planObj = afterAutoFix.data
          }
        }

        try {
          logger.info("[RI] Emitting plan event", {
            formId,
            userId,
            correlationId: planObj.correlationId,
            viewName: planObj?.plan?.meta?.view_name,
          })
          dataStream.write({
            type: "data-agent_event",
            data: {
              type: "response_intelligence_plan",
              category: "ri",
              plan: planObj,
              formId,
              userId,
              timestamp: new Date().toISOString(),
            },
          })
        } catch (eventError) {
          logger.warn("[RI] Failed to emit plan event", {
            error:
              eventError instanceof Error
                ? eventError.message
                : String(eventError),
          })
        }

        return { success: true, plan: planObj }
      } catch (err) {
        const safeError =
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : { message: String(err) }

        logger.error("[RI] Generation failed", {
          formId,
          userId,
          error: safeError,
        })

        return {
          success: false,
          error: safeError.message || "Generation failed",
        }
      }
    },
  })
}

// Update tool: requires a currentPlan and defaults mode to "refine".
const RIUpdateInputSchema = z
  .object({
    prompt: z.string(),
    planContext: z
      .object({
        mode: z.enum(["new", "refine"]).optional(),
        correlationId: z.string().optional(),
        currentPlan: RIPlanResponseSchema, // required for updates
        saved: z.boolean().optional(),
        previousPlan: z
          .object({
            correlationId: z.string().optional(),
            status: z.enum(["unsaved", "saved", "discarded"]).optional(),
          })
          .optional(),
      })
      .strict(),
  })
  .strict()

export function updateResponseViewTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.updateResponseView,
    inputSchema: z
      .object({
        planContext: z
          .object({
            currentPlan: RIPlanResponseSchema,
            correlationId: z.string().optional(),
            saved: z.boolean().optional(),
          })
          .strict(),
        updates: ResponseViewUpdatesSchema,
      })
      .strict(),
    execute: async ({ planContext, updates }) => {
      const { dataStream, formId, userId } = context
      try {
        const patched = applyResponseViewUpdates(
          planContext.currentPlan,
          updates
        )
        // Stream a minimal event for UI; avoid verbose summaries
        dataStream.write({
          type: "data-agent_event",
          data: {
            type: "response_intelligence_plan",
            category: "progress",
            data: { message: "Response View updated" },
            plan: patched,
            formId,
            userId,
            timestamp: new Date().toISOString(),
          },
        } as any)
        return { success: true, plan: patched }
      } catch (e) {
        logger.error("[RI] updateResponseView failed", {
          error: e instanceof Error ? e.message : String(e),
        })
        return {
          success: false,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    },
  })
}
