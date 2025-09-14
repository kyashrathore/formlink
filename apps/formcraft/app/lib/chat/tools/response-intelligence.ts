import { getModel } from "@/app/lib/ai/provider"
import { RIPlanResponseSchema, type RIPlanResponse } from "@/app/lib/ri/types"
import { generateObject, tool } from "ai"
import { customAlphabet } from "nanoid"
import { z } from "zod"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext } from "../types"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

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
      })
      .optional(),
  })
  .strict()

function fallbackPlan({
  prompt,
  formVersionId,
}: {
  prompt: string
  formVersionId: string | null
}): RIPlanResponse {
  const p = (prompt || "").toLowerCase()
  const has7d = /last\s*7\s*days|past\s*week|7d|week/.test(p)
  const has30d = /last\s*30\s*days|past\s*month|30d|month/.test(p)
  const mentionsTop =
    /(top|high[-\s]?value|best|shortlist|short-listed|priority)/.test(p)
  const mentionsInProgress = /(in\s*progress|unfinished|ongoing)/.test(p)

  const createdAtFilter = has7d
    ? { gte: "now()-7d" }
    : has30d
      ? { gte: "now()-30d" }
      : undefined

  return {
    plan_version: "ri.v1",
    plan: {
      rpc: {
        submission_filters: {
          ...(formVersionId ? { form_version_id: formVersionId } : {}),
          status: "completed",
          testmode: false,
          ...(createdAtFilter ? { created_at: createdAtFilter } : {}),
        },
        answer_filters: {},
        page_size: 50,
      },
      ui: {
        columns: ["created_at", "status"],
        sort: { by: "created_at", dir: "desc" },
        insights_spec: [
          { type: "count", args: { label: "Completed" } },
          {
            type: "trend",
            args: { window: has7d ? "7d" : has30d ? "30d" : "14d" },
          },
        ],
      },
      meta: {
        rationale: "Heuristic fallback plan derived from the prompt",
        view_name: ((): string => {
          const timeframe = has7d
            ? "Last 7 Days"
            : has30d
              ? "Last 30 Days"
              : "Recent"
          if (mentionsTop) return `Shortlisted • ${timeframe}`
          if (mentionsInProgress) return `In Progress • ${timeframe}`
          return `Completed • ${timeframe}`
        })(),
        followups: [
          {
            kind: "insight",
            title: has7d ? "Trend (30d)" : "Trend (7d)",
            payload: { type: "trend", window: has7d ? "30d" : "7d" },
          },
          {
            kind: "filter",
            title: mentionsInProgress ? "Only Completed" : "Only In‑Progress",
            payload: {
              status: mentionsInProgress ? "completed" : "in_progress",
            },
          },
          { kind: "action", title: "Export Selected as CSV", payload: {} },
        ],
      },
    },
    warnings: [
      "Returned heuristic plan (no model output). Columns/filters are conservative.",
    ],
    correlationId: nanoid(12),
  }
}

export function responseIntelligenceTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.responseIntelligence,
    inputSchema: RIInputSchema,
    execute: async ({ prompt, planContext }) => {
      const { formId, supabase, userId, dataStream } = context

      // Resolve formVersionId (prefer published, else draft)
      let formVersionId: string | null = null
      try {
        const { data: formRow } = await supabase
          .from("forms")
          .select("current_published_version_id, current_draft_version_id")
          .eq("id", formId)
          .single()
        if (formRow) {
          formVersionId =
            (formRow as any).current_published_version_id ||
            (formRow as any).current_draft_version_id ||
            null
        }
      } catch {}

      // Collect question IDs (best-effort)
      let questionIds: string[] | undefined
      if (formVersionId) {
        try {
          const { data } = await supabase
            .from("form_versions")
            .select("questions")
            .eq("version_id", formVersionId)
            .single()
          const q = (data as any)?.questions
          let arr: any[] = []
          if (Array.isArray(q)) arr = q
          else if (typeof q === "string") arr = JSON.parse(q)
          questionIds = arr
            .filter(
              (x) => x && typeof x === "object" && typeof x.id === "string"
            )
            .map((x) => x.id as string)
        } catch {}
      }

      const isRefine = Boolean(planContext?.currentPlan)

      // Try model-first
      let plan: RIPlanResponse | null = null
      try {
        const MODEL = getModel("google/gemini-2.5-pro", "openrouter")
        const system = `You are a stateless planner for a Responses view.\nReturn ONLY JSON per schema. Do not include prose.\nBe conservative with columns/filters; use provided formVersionId if present.\nIf currentPlan is provided, refine it in-place. Preserve correlationId.\n\nSTRICT INSIGHTS SPEC RULES:\n- insights_spec is an array of at most 3 items.\n- type in {count, trend, breakdown}.\n- For trend.args: field in {created_at, completed_at}; window matches /^(\\d+)(d|w|m)$/ (e.g., 7d, 4w, 3m); optional by is either 'status' or a question id from questionIds.\n- For breakdown.args: field is 'status', 'created_at', or a question id; optional by is 'status' or a question id; topN <= 10; stacked is boolean.\n- For count.args: optional label string.\n- Reject or repair invalid windows (default 7d), fields not in the allow-list, or unknown question ids (omit or use 'status').\n- Prefer producing 1-2 items across {count, trend, breakdown}.`

        const input = {
          formId,
          formVersionId,
          questionIds: questionIds || [],
          userPrompt: prompt,
          uiHints: { defaultColumns: ["created_at", "status"] },
          currentPlan: planContext?.currentPlan || null,
          mode: planContext?.mode || (isRefine ? "refine" : "new"),
        }

        const { object } = await generateObject({
          model: MODEL,
          schema: RIPlanResponseSchema,
          system,
          prompt: JSON.stringify(input),
        })
        // Ensure sensible defaults in meta
        if (!object.plan.meta) object.plan.meta = {}
        if (!object.plan.meta.view_name) {
          const pp = (prompt || "").toLowerCase()
          const has7 = /last\s*7\s*days|past\s*week|7d|week/.test(pp)
          const has30 = /last\s*30\s*days|past\s*month|30d|month/.test(pp)
          const timeframe = has7
            ? "Last 7 Days"
            : has30
              ? "Last 30 Days"
              : "Recent"
          object.plan.meta.view_name = `Responses • ${timeframe}`
        }
        if (
          !object.plan.meta.followups ||
          object.plan.meta.followups.length === 0
        ) {
          object.plan.meta.followups = [
            {
              kind: "insight",
              title: "Trend (7d)",
              payload: { type: "trend", window: "7d" },
            },
            {
              kind: "filter",
              title: "Only Completed",
              payload: { status: "completed" },
            },
            { kind: "action", title: "Export Selected as CSV", payload: {} },
          ]
        }
        if (isRefine && planContext?.correlationId) {
          object.correlationId = planContext.correlationId
        }
        plan = object
      } catch {
        plan = null
      }

      if (!plan) {
        if (isRefine && planContext?.currentPlan) {
          plan = {
            ...planContext.currentPlan,
            warnings: [
              ...(planContext.currentPlan.warnings || []),
              "Refinement not available offline; returned current plan.",
            ],
          }
        } else {
          plan = fallbackPlan({ prompt, formVersionId })
        }
      }

      if (!plan.correlationId) plan.correlationId = nanoid(12)

      // Emit a UI event for consumers listening to the stream
      try {
        dataStream.write({
          type: "data-agent_event",
          data: {
            type: "response_intelligence_plan",
            category: "ri",
            plan,
            formId,
            userId,
            timestamp: new Date().toISOString(),
          },
        })
      } catch {}

      return { success: true, plan }
    },
  })
}
