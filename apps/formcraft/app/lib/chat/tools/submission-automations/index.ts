import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import { getModel } from "@/app/lib/ai/provider"
import { generateObject } from "@/app/lib/ai/tracing"
import { TOOL_DESCRIPTIONS } from "@/app/lib/chat/prompts"
import type { ChatToolContext } from "@/app/lib/chat/types"
import {
  LifecyclePlanProposalSchema,
  type LifecyclePlanProposal,
} from "@/app/lib/lifecycle/plan-types"
import logger from "@/app/lib/logger"
import { tool } from "ai"
import { z } from "zod"
import { buildActionsPromptContext } from "../response-intelligence/actions-context"

const InputSchema = z
  .object({
    prompt: z
      .string()
      .describe(
        "User's instruction for lifecycle automation (spam checks, notifications, CRM, etc.)."
      ),
    context: z
      .object({
        correlationId: z.string().optional(),
        // Optional: current lifecycle config summary for better suggestions
        current: z
          .object({
            enabled: z.boolean().optional(),
            allowedActions: z
              .array(
                z.object({
                  slug: z.string(),
                  provider: z.enum(["usesend", "composio"]).optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .strict()

export function proposeLifecycleAutomationTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.proposeLifecycleAutomation,
    inputSchema: InputSchema,
    execute: async ({ prompt, context: planContext }) => {
      const { dataStream, formId, userId } = context

      const model = getModel(process.env.AI_SUBMISSION_INTEL_MODEL)

      const actionsCtx = buildActionsPromptContext()
      const curatedBySlug = new Map(CURATED_ACTIONS.map((a) => [a.slug, a]))

      const SYSTEM = [
        "You are a lifecycle automation planner for new submissions.",
        "Two non-negotiable rules:",
        "1) Submission hooks vs actions: spam, tagging, sentiment, enrichment, lead are SUBMISSION HOOKS. Put them in proposal.enabledHooks if requested. NEVER include them in proposal.allowedActions.",
        "2) Actions catalog only: proposal.allowedActions must contain ONLY curated action slugs from the catalog below (e.g., USESEND_SEND_EMAIL). If a user asks for anything not in the catalog, omit it.",
        "Prefer concise rationale (<= 160 chars).",
        "Output strictly adheres to the provided JSON schema.",
        "\nCurated actions (slug: description):\n" +
          actionsCtx.lines.join("\n"),
      ].join("\n")

      const ObjectSchema = z
        .object({
          proposal: z
            .object({
              allowedActions: z
                .array(
                  z.object({
                    slug: z.string(),
                    // Model may try to guess provider; we will fix after
                    provider: z.enum(["usesend", "composio"]).optional(),
                    params: z.record(z.any()).optional(),
                    title: z.string().optional(),
                  })
                )
                .default([]),
              enabledHooks: z
                .array(z.enum(["spam", "enrichment", "lead", "tags"]))
                .optional(),
              orchestratorPrompt: z.string().optional(),
              rationale: z.string().optional(),
            })
            .strict(),
        })
        .strict()

      try {
        const { object } = await generateObject({
          model,
          system: SYSTEM,
          prompt: `User: ${prompt}\nCurrent: ${JSON.stringify(planContext || {}, null, 2)}`,
          schema: ObjectSchema,
        })

        // Sanitize and map to curated actions only
        const seen = new Set<string>()
        const allowedActions = (object.proposal?.allowedActions || [])
          .map((a) => {
            const match = curatedBySlug.get(a.slug)
            if (!match) return null
            return {
              slug: match.slug,
              provider:
                (match.provider as "usesend" | "composio") ||
                (a.provider as any) ||
                "composio",
              params: (a.params as Record<string, unknown>) || {},
            }
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x))
          .filter((x) => {
            const key = `${x.slug}:${JSON.stringify(x.params || {})}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })

        const plan: LifecyclePlanProposal = {
          plan_version: "lifecycle.v1",
          correlationId: planContext?.correlationId,
          proposal: {
            allowedActions,
            enabledHooks: (object as any).proposal?.enabledHooks,
            orchestratorPrompt: object.proposal?.orchestratorPrompt,
            rationale: object.proposal?.rationale,
          },
        }

        const parsed = LifecyclePlanProposalSchema.safeParse(plan)
        if (!parsed.success) {
          logger.warn("[LifecyclePlan] schema validation failed", {
            issues: parsed.error.issues,
          })
        }

        try {
          dataStream.write({
            type: "data-agent_event",
            data: {
              type: "lifecycle_automation_plan",
              category: "lifecycle",
              plan,
              formId,
              userId,
              timestamp: new Date().toISOString(),
            },
          })
        } catch (eventError) {
          logger.warn("[LifecyclePlan] Failed to emit event", {
            error:
              eventError instanceof Error
                ? eventError.message
                : String(eventError),
          })
        }

        return { success: true, plan }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error("[LifecyclePlan] generation failed", { message })
        return { success: false, error: message }
      }
    },
  })
}
