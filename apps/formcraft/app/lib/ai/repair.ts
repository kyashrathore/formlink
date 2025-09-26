import { generateObject } from "@/app/lib/ai/tracing"
import logger from "@/app/lib/logger"
import { loadPrompt } from "@formlink/prompts"
import { z } from "zod"
import { getModel } from "./provider"

// Prefer fast, low-latency model via Vercel for repair retries
const REPAIR_MODEL = getModel()

// Removed inline long system; use centralized prompt template instead

export async function repairJSON<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  error: z.ZodError
): Promise<T | null> {
  try {
    const errorDetails = error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
      code: e.code,
    }))

    const startedAt = Date.now()
    logger.info("[REPAIR] generateObject start", {
      model: String(REPAIR_MODEL),
      errorCount: errorDetails.length,
      schemaHint: (schema as any)?._def?.typeName || "zodSchema",
    })

    // Try up to 3 attempts for repair
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const system = await loadPrompt("form/create-form-repair.md", {
          errors_json: errorDetails,
          json_payload: data,
          generation_context: {
            model: String(REPAIR_MODEL),
            schema_name: (schema as any)?._def?.typeName || "zodSchema",
            timestamp: new Date().toISOString(),
          },
        })
        const { object: repairedData } = await generateObject({
          model: REPAIR_MODEL,
          schema,
          system,
          prompt: "",
        })
        logger.info("[REPAIR] generateObject success", {
          durationMs: Date.now() - startedAt,
          model: String(REPAIR_MODEL),
          attempt,
        })
        return repairedData
      } catch (err) {
        logger.warn("[REPAIR] attempt failed", {
          attempt,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    logger.error("[REPAIR] all attempts failed")
    return null
  } catch (repairError) {
    logger.error("[REPAIR] Error repairing JSON", {
      error:
        repairError instanceof Error
          ? { message: repairError.message, stack: repairError.stack }
          : String(repairError),
    })
    return null
  }
}
