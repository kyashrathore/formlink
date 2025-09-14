import { z } from "zod"

// Sort specification for UI tables
export const RISortSchema = z
  .object({
    by: z.string(),
    dir: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()

// Insight card specification (client renders, values come from responses API)
// Strict insight spec schema used by the agent and API
const TrendArgsSchema = z
  .object({
    field: z
      .enum(["created_at", "completed_at"])
      .default("created_at")
      .optional(),
    window: z
      .string()
      .regex(/^\d+(d|w|m)$/i)
      .default("7d")
      .optional(),
    by: z.string().optional(), // status or a question id
  })
  .strict()

const BreakdownArgsSchema = z
  .object({
    field: z.string().default("status").optional(), // status | created_at | question id
    by: z.string().optional(),
    topN: z.number().int().positive().max(20).default(10).optional(),
    stacked: z.boolean().default(true).optional(),
  })
  .strict()

const CountArgsSchema = z.object({ label: z.string().optional() }).strict()

export const RIInsightSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("count"), args: CountArgsSchema.optional() }),
  z.object({ type: z.literal("trend"), args: TrendArgsSchema.optional() }),
  z.object({
    type: z.literal("breakdown"),
    args: BreakdownArgsSchema.optional(),
  }),
])

// Sidecar proposed keys/virtual columns
export const RISidecarSchema = z
  .object({
    proposed_keys: z
      .array(
        z
          .object({
            key: z.string(),
            type: z
              .enum(["string", "number", "boolean", "timestamp", "json"])
              .default("string"),
            description: z.string().optional(),
            default: z.any().optional(),
            pii: z.enum(["none", "low", "high"]).default("none").optional(),
            index_hint: z
              .enum(["none", "gin", "btree"])
              .default("none")
              .optional(),
          })
          .strict()
      )
      .optional(),
    virtual_columns: z
      .array(
        z
          .object({
            key: z.string(),
            label: z.string().optional(),
            format: z.string().optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict()

// Top-level UI spec
export const RIUISchema = z
  .object({
    columns: z.array(z.string()).default(["created_at", "status"]),
    sort: RISortSchema.optional(),
    insights_spec: z.array(RIInsightSpecSchema).optional(),
  })
  .strict()

// RPC (server) spec
export const RIRPCSchema = z
  .object({
    submission_filters: z.record(z.any()).default({}),
    answer_filters: z.record(z.any()).default({}),
    page_size: z.number().int().positive().max(200).optional(),
  })
  .strict()

// Plan meta
export const RIFollowupItemSchema = z
  .object({
    kind: z
      .enum(["insight", "action", "column", "chart", "filter"])
      .default("insight"),
    title: z.string(),
    payload: z.record(z.any()).optional(),
  })
  .strict()

export const RIMetaSchema = z
  .object({
    rationale: z.string().optional(),
    followups: z.array(z.union([z.string(), RIFollowupItemSchema])).optional(),
    view_name: z.string().optional(),
  })
  .strict()

// Full plan schema
export const RIPlanSchema = z
  .object({
    rpc: RIRPCSchema,
    ui: RIUISchema,
    actions: z
      .array(
        z
          .object({
            action_key: z.string(),
            params: z.record(z.any()).default({}),
            title: z.string().optional(),
          })
          .strict()
      )
      .optional(),
    sidecar_spec: RISidecarSchema.optional(),
    meta: RIMetaSchema.optional(),
  })
  .strict()

// Response wrapper schema
export const RIPlanResponseSchema = z
  .object({
    plan_version: z.string().default("ri.v1"),
    plan: RIPlanSchema,
    warnings: z.array(z.string()).optional(),
    correlationId: z.string().optional(),
  })
  .strict()

export type RIPlanResponse = z.infer<typeof RIPlanResponseSchema>
export type RIPlan = z.infer<typeof RIPlanSchema>

// Request schema for RI within the forms route context
export const RIRequestSchema = z
  .object({
    userPrompt: z.string().min(1),
    viewContext: z.string().default("buildertab"),
  })
  .strict()

export type RIRequest = z.infer<typeof RIRequestSchema>
