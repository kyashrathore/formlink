import { getModel } from "@/app/lib/ai/provider"
import { generateObject } from "@/app/lib/ai/tracing"
import logger from "@/app/lib/logger"
import { RIPlanResponseSchema } from "@/app/lib/ri/types"
import { loadPrompt } from "@formlink/prompts"
import { z } from "zod"

export function autoFixRIPlan(obj: unknown, error: z.ZodError) {
  const clone = JSON.parse(JSON.stringify(obj))

  const getAtPath = (root: any, path: (string | number)[]) =>
    path.reduce((acc, key) => (acc == null ? undefined : acc[key as any]), root)
  const setAtPath = (root: any, path: (string | number)[], value: any) => {
    let cur = root
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      if (cur[key as any] == null || typeof cur[key as any] !== "object") {
        cur[key as any] = typeof path[i + 1] === "number" ? [] : {}
      }
      cur = cur[key as any]
    }
    cur[path[path.length - 1] as any] = value
  }
  const delAtPath = (root: any, path: (string | number)[]) => {
    if (!path.length) return
    const parent = getAtPath(root, path.slice(0, -1))
    if (parent && typeof parent === "object") {
      delete parent[path[path.length - 1] as any]
    }
  }

  for (const issue of error.issues) {
    const path = issue.path as (string | number)[]
    switch (issue.code) {
      case "invalid_union_discriminator": {
        // Common case: insights_spec[].type not in allowed set; try to coerce
        const last = String(path[path.length - 1] || "")
        if (last === "type") {
          const parent = getAtPath(clone, path.slice(0, -1))
          const raw = String(getAtPath(clone, path) ?? "").toLowerCase()
          const map: Record<string, string> = {
            kpi: "metric",
            metrics: "metric",
            number: "metric",
            timeseries: "trend",
            time_series: "trend",
            timeline: "trend",
            breakdowns: "breakdown",
            category_breakdown: "breakdown",
            pie: "breakdown",
            bar: "breakdown",
            total: "count",
            counter: "count",
            summary_text: "summary",
            text_block: "text",
          }
          const allowed = new Set([
            "count",
            "trend",
            "breakdown",
            "metric",
            "text",
            "summary",
          ])
          const mapped = map[raw]
          if (mapped && allowed.has(mapped)) setAtPath(clone, path, mapped)
          else if (parent && typeof parent === "object") {
            // invalid and unmapped: default to a safe count card
            ;(parent as any).type = "count"
            ;(parent as any).args = (parent as any).args || {}
          }
        }
        break
      }
      case "invalid_enum_value": {
        const last = String(path[path.length - 1] || "")
        if (["chart", "format", "field"].includes(last)) delAtPath(clone, path)
        else if (last === "agg") setAtPath(clone, path, "avg")
        else if (last === "dir") setAtPath(clone, path, "desc")
        break
      }
      case "unrecognized_keys": {
        const keys = (issue as any).keys as string[] | undefined
        const parent = getAtPath(clone, path)
        if (parent && typeof parent === "object" && Array.isArray(keys)) {
          for (const key of keys) delete parent[key]
        }
        break
      }
      case "invalid_type": {
        const expected = (issue as any).expected
        const current = getAtPath(clone, path)
        if (expected === "number") {
          const n = Number(current)
          if (Number.isFinite(n)) setAtPath(clone, path, n)
          else delAtPath(clone, path)
        } else if (expected === "boolean") {
          const value = String(current).toLowerCase()
          if (value === "true") setAtPath(clone, path, true)
          else if (value === "false") setAtPath(clone, path, false)
          else delAtPath(clone, path)
        } else if (expected === "string") {
          if (current == null) setAtPath(clone, path, "")
          else setAtPath(clone, path, String(current))
        } else if (expected === "array") {
          setAtPath(
            clone,
            path,
            Array.isArray(current) ? current : current != null ? [current] : []
          )
        } else if (expected === "object") {
          setAtPath(
            clone,
            path,
            typeof current === "object" && current ? current : {}
          )
        } else {
          delAtPath(clone, path)
        }
        break
      }
      case "too_small": {
        const last = String(path[path.length - 1] || "")
        const current = getAtPath(clone, path)
        if (typeof current === "number") {
          const min = (issue as any).minimum
          if (typeof min === "number") setAtPath(clone, path, min)
        } else if (last === "topN") {
          setAtPath(clone, path, 1)
        }
        break
      }
      case "too_big": {
        const last = String(path[path.length - 1] || "")
        const current = getAtPath(clone, path)
        if (typeof current === "number") {
          const max = (issue as any).maximum
          if (typeof max === "number") setAtPath(clone, path, max)
        } else if (last === "topN") {
          setAtPath(clone, path, 20)
        }
        break
      }
      case "invalid_string": {
        const last = String(path[path.length - 1] || "")
        if (last === "window") setAtPath(clone, path, "7d")
        break
      }
      default:
        break
    }
  }

  // Ensure required skeletons exist
  if (!clone?.plan || typeof clone.plan !== "object") {
    ;(clone as any).plan = {}
  }
  if (!clone?.plan?.rpc || typeof clone.plan.rpc !== "object") {
    ;(clone as any).plan.rpc = {
      submission_filters: {},
      answer_filters: {},
      page_size: 20,
    }
  }
  if (!clone?.plan?.ui || typeof clone.plan.ui !== "object") {
    ;(clone as any).plan.ui = {
      columns: ["created_at", "status"],
      insights_spec: [],
    }
  }
  if (!Array.isArray((clone as any).plan.ui.insights_spec)) {
    ;(clone as any).plan.ui.insights_spec = []
  } else {
    // Coerce bad insight entries to safe defaults
    const allowed = new Set([
      "count",
      "trend",
      "breakdown",
      "metric",
      "text",
      "summary",
    ])
    ;(clone as any).plan.ui.insights_spec = (
      clone as any
    ).plan.ui.insights_spec.map((entry: any) => {
      const t = String(entry?.type ?? "").toLowerCase()
      if (!allowed.has(t)) return { type: "count", args: {} }
      return entry
    })
  }
  // Normalize actions: require action_key or drop entry; map slug/key to action_key
  if (Array.isArray((clone as any).plan?.actions)) {
    ;(clone as any).plan.actions = (clone as any).plan.actions
      .map((a: any) => {
        if (!a) return null
        const ak = a.action_key || a.key || a.slug
        if (typeof ak === "string" && ak.trim()) {
          return { ...a, action_key: ak }
        }
        return null
      })
      .filter(Boolean)
  }

  return clone
}

export async function repairRIPlanWithAI(
  data: unknown,
  error: z.ZodError,
  generationContext?: {
    system_prompt?: string
    user_prompt?: unknown
    model?: string
    schema_name?: string
    schema_version?: string
    timestamp?: string
  }
): Promise<unknown | null> {
  // Fast, low-latency repair model via Vercel
  const REPAIR_MODEL = getModel(
    process.env.AI_GATEWAY_DEFAULT_MODEL || "openai/gpt-4o-mini",
    "vercel"
  )
  const errorDetails = error.errors.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }))
  const system = await loadPrompt("ri/plan-repair.md", {
    errors_json: errorDetails,
    json_payload: data,
    generation_context: generationContext || {},
  })

  // Try up to 3 times with the fast repair model
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { object } = await generateObject({
        model: REPAIR_MODEL,
        schema: RIPlanResponseSchema,
        system,
        prompt: "",
      })
      return object
    } catch (repairError) {
      logger.warn("[RI] AI repair attempt failed", {
        attempt,
        error:
          repairError instanceof Error
            ? repairError.message
            : String(repairError),
      })
    }
  }
  logger.error("[RI] AI repair failed after 3 attempts")
  return null
}
