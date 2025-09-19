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
const LayoutSchema = z
  .object({
    colSpan: z.number().int().min(1).max(12).optional(),
    rowSpan: z.number().int().min(1).max(6).optional(),
    minH: z.number().int().min(80).max(1200).optional(),
  })
  .strict()

// Advanced args (pass-through for planner; UI may ignore initially)
const CompositeSchema = z
  .object({
    formula: z.string(),
    fields: z.array(z.string()).min(1),
    aggregation: z.enum(["sum", "avg", "median", "mode"]).optional(),
  })
  .strict()

const ComparisonSchema = z
  .object({
    baseline: z.enum(["previous_period", "average", "target"]).optional(),
    change_type: z.enum(["absolute", "percentage", "index"]).optional(),
  })
  .strict()

const SegmentationSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    filters: z
      .array(
        z
          .object({ field: z.string(), op: z.string(), value: z.any().optional() })
          .strict()
      )
      .optional(),
  })
  .strict()

const ThresholdsSchema = z
  .object({ warning: z.number().optional(), critical: z.number().optional(), target: z.number().optional() })
  .strict()

const CorrelationSchema = z
  .object({
    x: z.string().optional(),
    y: z.string().optional(),
    method: z.enum(["pearson", "spearman", "kendall"]).optional(),
  })
  .strict()

const AdvancedArgsSchema = z
  .object({
    composite: CompositeSchema.optional(),
    comparison: ComparisonSchema.optional(),
    segmentation: SegmentationSchema.optional(),
    thresholds: ThresholdsSchema.optional(),
    correlation: CorrelationSchema.optional(),
    // Display hint for UI grid layout density
    layout_variant: z.enum(["small", "medium", "large"]).optional(),
  })
  .strict()

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
    chart: z.enum(["line", "area", "bar"]).optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    layout: LayoutSchema.optional(),
  })
  .merge(AdvancedArgsSchema)
  .strict()

const BreakdownArgsSchema = z
  .object({
    field: z.string().default("status").optional(), // status | created_at | question id
    by: z.string().optional(),
    topN: z.number().int().positive().max(20).default(10).optional(),
    stacked: z.boolean().default(true).optional(),
    chart: z.enum(["bar", "pie"]).optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    layout: LayoutSchema.optional(),
  })
  .merge(AdvancedArgsSchema)
  .strict()

const CountArgsSchema = z
  .object({
    label: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    layout: LayoutSchema.optional(),
  })
  .merge(AdvancedArgsSchema)
  .strict()

const TextArgsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    layout: LayoutSchema.optional(),
  })
  .merge(AdvancedArgsSchema)
  .strict()

export const RIInsightSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("count"), args: CountArgsSchema.optional() }),
  z.object({ type: z.literal("trend"), args: TrendArgsSchema.optional() }),
  z.object({
    type: z.literal("breakdown"),
    args: BreakdownArgsSchema.optional(),
  }),
  // Numeric/statistical metric insight (e.g., avg budget, sum revenue)
  z.object({
    type: z.literal("metric"),
    args: z
      .object({
        field: z.string(),
        agg: z.enum(["avg", "sum", "min", "max", "median"]).default("avg"),
        by: z.string().optional(),
        format: z.enum(["number", "currency"]).default("number").optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        layout: LayoutSchema.optional(),
      })
      .merge(AdvancedArgsSchema)
      .optional(),
  }),
  z.object({ type: z.literal("text"), args: TextArgsSchema.optional() }),
  z.object({ type: z.literal("summary"), args: TextArgsSchema.optional() }),
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
