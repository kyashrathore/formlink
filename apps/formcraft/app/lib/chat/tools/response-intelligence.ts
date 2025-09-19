import { getModel } from "@/app/lib/ai/provider"
import { repairJSON } from "@/app/lib/ai/repair"
import logger from "@/app/lib/logger"
import { RIPlanResponseSchema, type RIPlanResponse } from "@/app/lib/ri/types"
import { generateObject, generateText, tool } from "ai"
import { z } from "zod"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext } from "../types"

// Load RI system prompt once at module load with robust path resolution
let RI_SYSTEM_PROMPT = ""
let RI_SYSTEM_PROMPT_PATH: string | null = null
try {
  const path = require("node:path")
  const fs = require("node:fs")
  let moduleDir = process.cwd()
  try {
    const url = require("node:url")
    // eslint-disable-next-line no-undef
    const maybeDirname =
      typeof __dirname !== "undefined" ? __dirname : undefined
    moduleDir = maybeDirname || path.dirname(url.fileURLToPath(import.meta.url))
  } catch {}
  const candidates = [
    path.resolve(moduleDir, "../prompts/ri-system.md"),
    path.resolve(process.cwd(), "app/lib/chat/prompts/ri-system.md"),
    path.resolve(
      process.cwd(),
      "apps/formcraft/app/lib/chat/prompts/ri-system.md"
    ),
  ]
  for (const candidate of candidates) {
    try {
      const exists = fs.existsSync(candidate)
      logger.info("[RI] Checking RI system prompt candidate", {
        candidate,
        exists,
      })
      if (exists) {
        RI_SYSTEM_PROMPT = fs.readFileSync(candidate, "utf8")
        RI_SYSTEM_PROMPT_PATH = candidate
        logger.info("[RI] Loaded RI system prompt", { candidate })
        break
      }
    } catch {}
  }
  if (!RI_SYSTEM_PROMPT) {
    logger.warn(
      "[RI] Could not locate ri-system.md; using embedded fallback prompt",
      {
        candidates,
        cwd: process.cwd(),
        moduleDir,
      }
    )
    RI_SYSTEM_PROMPT = [
      "You are an expert data analyst.",
      "Return ONLY JSON that validates RIPlanResponseSchema; no prose.",
      "Prefer response content insights over basic form metrics.",
      "Generate 3–6 insights; include count and a temporal trend.",
    ].join("\n")
  }
} catch (e) {
  logger.warn("[RI] Failed to resolve RI system prompt", {
    error: e instanceof Error ? e.message : String(e),
  })
}

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

export function responseIntelligenceTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.responseIntelligence,
    inputSchema: RIInputSchema,
    execute: async ({ prompt, planContext }) => {
      const { formId, supabase, userId, dataStream } = context
      logger.info("[RI] Tool invoked", {
        formId,
        userId,
        promptPreview: typeof prompt === "string" ? prompt.slice(0, 160) : "",
        planContext: {
          mode: planContext?.mode,
          hasCurrentPlan: Boolean(planContext?.currentPlan),
          correlationId: planContext?.correlationId,
        },
      })

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
      } catch (e) {
        logger.warn("[RI] Failed to resolve formVersionId", {
          formId,
          error: e instanceof Error ? e.message : String(e),
        })
      }

      // Collect question IDs and meta (best-effort)
      let questionIds: string[] | undefined
      let questionsMeta:
        | Array<{
            id: string
            title?: string
            label?: string
            page?: number
            typeName?: string
            typeFormat?: string
          }>
        | undefined
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
          questionsMeta = arr
            .filter(
              (x) => x && typeof x === "object" && typeof x.id === "string"
            )
            .map((x) => ({
              id: x.id as string,
              title: (x as any).title,
              label: (x as any).label,
              page: (x as any).page,
              typeName: (x as any)?.type?.name,
              typeFormat: (x as any)?.type?.format,
            }))
          questionIds = (questionsMeta || []).map((x) => x.id)
          logger.info("[RI] Loaded form context", {
            formId,
            formVersionId,
            questionCount: questionIds?.length || 0,
          })
        } catch (e) {
          logger.warn("[RI] Failed to load form questions", {
            formId,
            formVersionId,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }

      const isRefine = Boolean(planContext?.currentPlan)

      // Generate object directly against schema, then sanitize/repair if needed
      try {
        const MODEL = getModel("gpt-5", "openrouter")
        const input = {
          formId,
          formVersionId,
          questionIds: questionIds || [],
          formQuestions: questionsMeta || [],
          userPrompt: prompt,
          uiHints: { defaultColumns: ["created_at", "status"] },
          currentPlan: planContext?.currentPlan || null,
          mode: planContext?.mode || (isRefine ? "refine" : "new"),
        }
        const STRICT_JSON_SYSTEM = `${RI_SYSTEM_PROMPT}\n\nRules:\n- You must produce an object that validates the given JSON schema.\n- No markdown, no code fences, no commentary.\n- Do NOT include unsupported keys in args for a given insight type.\n  - count.args: { label?, title?, description?, layout?, layout_variant? }\n  - trend.args: { field?, window?, by?, chart?, title?, description?, layout?, layout_variant? }\n  - breakdown.args: { field, by?, topN?, stacked?, chart?, title?, description?, layout?, layout_variant? }\n  - metric.args: { field, agg, by?, format?, title?, description?, layout?, layout_variant? }\n  - text|summary.args: { title?, description?, content?, layout?, layout_variant? }\n- Never put 'field' inside text/summary/count args.`

        const startedAt = Date.now()
        logger.info("[RI] generateObject start", {
          formId,
          userId,
          model: String(MODEL),
          systemPromptPath: RI_SYSTEM_PROMPT_PATH,
          systemChars: STRICT_JSON_SYSTEM.length,
          inputKeys: Object.keys(input),
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
              JSON.stringify(input),
            ].join("\n\n"),
          })
          candidate = object
          logger.info("[RI] generateObject success", {
            formId,
            userId,
            durationMs: Date.now() - startedAt,
          })
        } catch (e) {
          // Some providers may still return malformed output; fall back to text and parse
          logger.warn("[RI] generateObject failed; falling back to text", {
            error: e instanceof Error ? e.message : String(e),
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
            prompt: JSON.stringify(input),
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
          } catch (e2) {
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
          model: MODEL,
          durationMs,
          preInsightsCount: preSpecs.length,
          preInsightTypes: preSpecs.map((x: any) => x?.type).slice(0, 12),
          preInsights: preSpecs,
        })
        // Skip sanitization so we can inspect raw model output
        // candidate = sanitizeRIPlan(candidate)
        let planObj = candidate
        const parsed = RIPlanResponseSchema.safeParse(planObj)
        if (!parsed.success) {
          logger.warn("[RI] Initial schema validation failed", {
            issues: parsed.error.issues.map(
              (issue) => issue.path.join(".") + ": " + issue.message
            ),
          })
          // Try deterministic auto-fixes based on Zod issues
          logger.warn("[RI] Schema validation failed; applying auto-fix", {
            issueCount: parsed.error.issues.length,
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
              // Fallback to generic repair helper (uses generateObject under the hood)
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
        } catch {}
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

function extractFirstJSONObject(input: string): string | null {
  const start = input.indexOf("{")
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (ch === "{") depth++
    else if (ch === "}") depth--
    if (depth === 0) return input.slice(start, i + 1)
  }
  return null
}

// Best-effort deterministic auto-fixer driven by Zod issues
function autoFixRIPlan(obj: any, error: z.ZodError) {
  const clone = JSON.parse(JSON.stringify(obj))

  // Helper to get/set/delete by zod path
  const getAtPath = (root: any, path: (string | number)[]) =>
    path.reduce((acc, key) => (acc == null ? undefined : acc[key as any]), root)
  const setAtPath = (root: any, path: (string | number)[], value: any) => {
    let cur = root
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i]
      if (cur[k as any] == null || typeof cur[k as any] !== "object")
        cur[k as any] = typeof path[i + 1] === "number" ? [] : {}
      cur = cur[k as any]
    }
    cur[path[path.length - 1] as any] = value
  }
  const delAtPath = (root: any, path: (string | number)[]) => {
    if (!path.length) return
    const parent = getAtPath(root, path.slice(0, -1))
    if (parent && typeof parent === "object")
      delete parent[path[path.length - 1] as any]
  }

  for (const issue of error.issues) {
    const path = issue.path as (string | number)[]
    switch (issue.code) {
      case "invalid_enum_value": {
        const last = String(path[path.length - 1] || "")
        // Prefer deleting invalid optional enums to let defaults apply
        if (["chart", "format", "field"].includes(last)) delAtPath(clone, path)
        else if (last === "agg") setAtPath(clone, path, "avg")
        else if (last === "dir") setAtPath(clone, path, "desc")
        break
      }
      case "unrecognized_keys": {
        // When strict schema flags unknown keys, drop them
        const keys = (issue as any).keys as string[] | undefined
        const parent = getAtPath(clone, path)
        if (parent && typeof parent === "object" && Array.isArray(keys)) {
          for (const k of keys) delete parent[k]
        }
        break
      }
      case "invalid_type": {
        const got = (issue as any).received
        const expected = (issue as any).expected
        const cur = getAtPath(clone, path)
        // Primitive coercions
        if (expected === "number") {
          const n = Number(cur)
          if (Number.isFinite(n)) setAtPath(clone, path, n)
          else delAtPath(clone, path)
        } else if (expected === "boolean") {
          const v = String(cur).toLowerCase()
          if (v === "true") setAtPath(clone, path, true)
          else if (v === "false") setAtPath(clone, path, false)
          else delAtPath(clone, path)
        } else if (expected === "string") {
          if (cur == null) setAtPath(clone, path, "")
          else setAtPath(clone, path, String(cur))
        } else if (expected === "array") {
          setAtPath(
            clone,
            path,
            Array.isArray(cur) ? cur : cur != null ? [cur] : []
          )
        } else if (expected === "object") {
          setAtPath(clone, path, typeof cur === "object" && cur ? cur : {})
        } else {
          // As a safe default, remove offending field to allow defaults
          delAtPath(clone, path)
        }
        break
      }
      case "too_small": {
        const last = String(path[path.length - 1] || "")
        const cur = getAtPath(clone, path)
        if (typeof cur === "number") {
          const min = (issue as any).minimum
          if (typeof min === "number") setAtPath(clone, path, min)
        } else if (Array.isArray(cur)) {
          // leave arrays as-is (schema often allows empty defaults)
        } else if (last === "topN") {
          setAtPath(clone, path, 1)
        }
        break
      }
      case "too_big": {
        const last = String(path[path.length - 1] || "")
        const cur = getAtPath(clone, path)
        if (typeof cur === "number") {
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
      default: {
        // No-op; rely on sanitize and AI repair
      }
    }
  }

  return clone
}

async function repairRIPlanWithAI(data: unknown, error: z.ZodError) {
  const MODEL = getModel("google/gemini-2.5-pro", "openrouter")
  const errorDetails = error.errors.map((e) => ({
    path: e.path.join("."),
    message: e.message,
    code: e.code,
  }))
  const system = `You are a strict JSON repair agent for Response Intelligence plans.\n\n- Only output the corrected JSON object that validates RIPlanResponseSchema.\n- Do not invent unsupported keys.\n- Apply minimal changes required to satisfy the errors.\n- Args whitelist per type:\n  - count: label?, title?, description?, layout?, layout_variant?\n  - trend: field?, window?, by?, chart?, title?, description?, layout?, layout_variant?\n  - breakdown: field, by?, topN?, stacked?, chart?, title?, description?, layout?, layout_variant?\n  - metric: field, agg, by?, format?, title?, description?, layout?, layout_variant?\n  - text|summary: title?, description?, content?, layout?, layout_variant?`
  const prompt = `Fix the JSON to satisfy these schema errors.\n\nErrors:\n${JSON.stringify(errorDetails, null, 2)}\n\nJSON:\n${JSON.stringify(data, null, 2)}`
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: RIPlanResponseSchema,
      system,
      prompt,
    })
    return object
  } catch (e) {
    logger.error("[RI] AI repair failed", {
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}
