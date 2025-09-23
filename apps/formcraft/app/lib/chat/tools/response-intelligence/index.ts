import { getModel } from "@/app/lib/ai/provider"
import { repairJSON } from "@/app/lib/ai/repair"
import { TOOL_DESCRIPTIONS } from "@/app/lib/chat/prompts"
import { ChatToolContext } from "@/app/lib/chat/types"
import logger from "@/app/lib/logger"
import { RIPlanResponseSchema } from "@/app/lib/ri/types"
import { generateObject, generateText, tool } from "ai"
import { z } from "zod"
import { buildActionsPromptContext } from "./actions-context"
import { loadFormQuestionsMeta, resolveFormVersionId } from "./form-context"
import { extractFirstJSONObject } from "./json"
import { autoFixRIPlan, repairRIPlanWithAI } from "./plan-repair"
import { buildSystemPrompt, getRISystemPrompt } from "./prompt"

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

export function responseIntelligenceTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.responseIntelligence,
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
      const {
        prompt: baseSystemPrompt,
        path: systemPromptPath,
        isFallback: isSystemFallback,
      } = getRISystemPrompt()
      if (isSystemFallback) {
        logger.error("[RI] Missing RI system prompt; aborting", {
          formId,
          userId,
        })
        return {
          success: false,
          error: "RI system prompt missing",
        }
      }
      const STRICT_JSON_SYSTEM = buildSystemPrompt(
        baseSystemPrompt,
        actionsPrompt
      )

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
          systemPromptPath,
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
            prompt: [
              "Generate a Responses Intelligence plan for the following context.",
              "Return only the JSON object that matches RIPlanResponseSchema.",
              JSON.stringify(inputPayload),
            ].join("\n\n"),
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
            prompt: JSON.stringify(inputPayload),
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

            const repaired = await repairRIPlanWithAI(
              autoFixed,
              afterAutoFix.error
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
