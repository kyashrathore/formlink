import { loadPrompt } from "@formlink/prompts"
import type { ActionsPromptContext } from "./actions-context"

export async function buildSystemPrompt(
  actionsPrompt: ActionsPromptContext,
  input?: {
    form_id?: string | null
    form_version_id?: string | null
    question_ids?: string[]
    form_questions?: Array<Record<string, unknown>>
    user_prompt?: string
    ui_hints?: Record<string, unknown>
    current_plan?: unknown
    mode?: string
    plan_disposition?: Record<string, unknown>
  }
): Promise<string> {
  const { summary, lines } = actionsPrompt

  const available_actions_text = summary.curatedActionCount
    ? lines.join("\n")
    : "No curated actions are available."

  const composio_status = summary.composioEnabled ? "enabled" : "disabled"
  const usesend_status = summary.usesendEnabled ? "enabled" : "disabled"

  const rendered = await loadPrompt("ri/ri-system.md", {
    available_actions_text,
    composio_status,
    usesend_status,
    // Inject analysis input (optional; may be undefined)
    form_id: input?.form_id ?? null,
    form_version_id: input?.form_version_id ?? null,
    question_ids: input?.question_ids ?? [],
    form_questions: input?.form_questions ?? [],
    user_prompt: input?.user_prompt ?? "",
    ui_hints: input?.ui_hints ?? {},
    current_plan: input?.current_plan ?? null,
    mode: input?.mode ?? "new",
    plan_disposition: input?.plan_disposition ?? {},
  })
  return rendered
}
