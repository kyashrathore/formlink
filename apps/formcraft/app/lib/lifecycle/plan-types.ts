import { z } from "zod"

export const LifecycleAllowedActionSchema = z
  .object({
    slug: z.string(),
    provider: z.enum(["usesend", "composio"]),
    params: z.record(z.any()).default({}),
  })
  .strict()

export const SubmissionHookEnum = z.enum(["spam", "enrichment", "lead", "tags"])

export const LifecyclePlanProposalSchema = z
  .object({
    plan_version: z.literal("lifecycle.v1"),
    correlationId: z.string().optional(),
    proposal: z
      .object({
        allowedActions: z.array(LifecycleAllowedActionSchema).default([]),
        enabledHooks: z.array(SubmissionHookEnum).optional(),
        orchestratorPrompt: z.string().optional(),
        rationale: z.string().optional(),
      })
      .strict(),
  })
  .strict()

export type LifecyclePlanProposal = z.infer<typeof LifecyclePlanProposalSchema>
export type LifecycleAllowedAction = z.infer<
  typeof LifecycleAllowedActionSchema
>
