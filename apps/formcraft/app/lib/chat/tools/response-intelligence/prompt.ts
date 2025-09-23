import fs from "node:fs"
import path from "node:path"
import url from "node:url"
import logger from "@/app/lib/logger"
import type { ActionsPromptContext } from "./actions-context"

let cachedPrompt: string | null = null
let cachedPath: string | null = null

const ACTIONS_PLACEHOLDER = "{{ACTION_CONTEXT}}"

const FALLBACK_PROMPT = `You are an expert data analyst.\n\nPrompt file missing; cannot run Response Intelligence without ri-system.md.`

export function getRISystemPrompt(): {
  prompt: string
  path: string | null
  isFallback: boolean
} {
  if (cachedPrompt) {
    return {
      prompt: cachedPrompt,
      path: cachedPath,
      isFallback: cachedPath == null,
    }
  }

  let moduleDir = process.cwd()
  try {
    const dirname = path.dirname(url.fileURLToPath(import.meta.url))
    moduleDir = dirname
  } catch (error) {
    logger.warn("[RI] Failed to resolve module directory", {
      error: error instanceof Error ? error.message : String(error),
    })
  }

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
      if (fs.existsSync(candidate)) {
        cachedPrompt = fs.readFileSync(candidate, "utf8")
        cachedPath = candidate
        logger.info("[RI] Loaded RI system prompt", { candidate })
        return { prompt: cachedPrompt, path: cachedPath, isFallback: false }
      }
    } catch (error) {
      logger.warn("[RI] Failed to read RI system prompt candidate", {
        candidate,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.warn("[RI] Using fallback RI system prompt", {
    candidates,
    cwd: process.cwd(),
    moduleDir,
  })
  cachedPrompt = FALLBACK_PROMPT
  cachedPath = null
  return { prompt: cachedPrompt, path: cachedPath, isFallback: true }
}

export function buildSystemPrompt(
  basePrompt: string,
  actionsPrompt: ActionsPromptContext
): string {
  const { summary, lines } = actionsPrompt

  const availableActionsText = summary.curatedActionCount
    ? lines.join("\n")
    : "No curated actions are available."

  const gatingText = [
    summary.composioEnabled
      ? "Composio integrations are enabled."
      : "Composio integrations are disabled.",
    summary.usesendEnabled
      ? "useSend email actions are enabled."
      : "useSend email actions are disabled.",
  ].join("\n")

  const actionGuidance = [
    availableActionsText,
    "",
    gatingText,
    "",
    "Use the action slugs exactly as written when populating plan.actions entries.",
  ]
    .join("\n")
    .trim()

  const merged = basePrompt.includes(ACTIONS_PLACEHOLDER)
    ? basePrompt.replace(ACTIONS_PLACEHOLDER, actionGuidance)
    : [basePrompt, "Action Guidance:", actionGuidance].join("\n\n")

  return merged
}
