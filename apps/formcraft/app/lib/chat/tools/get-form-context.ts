import { tool } from "ai"
import logger from "../../logger"
import { GetFormContextSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { FormService } from "../services/form-service"
import { ChatToolContext, GetFormContextResult } from "../types"

export function getFormContextTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.getFormContext,
    inputSchema: GetFormContextSchema,
    execute: async ({
      formId: toolCallFormId,
    }): Promise<GetFormContextResult> => {
      const { formId, supabase } = context
      const targetFormId = toolCallFormId || formId

      // Guard: On first message/new chat, do NOT allow getFormContext pre-check. Instruct to use createForm.
      if (context.isFirstMessage) {
        logger.info(
          "[TOOL getFormContext] Blocked on first message. Instructing to use createForm for new creation."
        )
        return {
          success: false,
          formId: targetFormId,
          error:
            "New session detected. Use the createForm tool to create a new form. Do not pre-check with getFormContext.",
        }
      }

      if (!targetFormId) {
        logger.warn(
          "[TOOL getFormContext] Attempted to get context without a targetFormId."
        )
        return {
          success: false,
          error:
            "Form ID is required and was not provided, nor is there an active form in the session.",
        }
      }

      logger.info(
        `[TOOL getFormContext] Attempting to fetch context for formId: ${targetFormId}`
      )

      try {
        const formService = new FormService(supabase)
        const contextData = await formService.getFormContext(targetFormId)

        if (!contextData) {
          return {
            success: false,
            formId: targetFormId,
            error: "Form record or draft version not found.",
          }
        }

        logger.info(
          `[TOOL getFormContext] Successfully fetched context for formId: ${targetFormId}`
        )
        return {
          success: true,
          formId: targetFormId,
          context: {
            ...contextData,
            settings: contextData.settings as Record<string, unknown>,
          },
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(
          `[TOOL getFormContext] Error during context fetch for ${targetFormId}:`,
          errorMessage
        )
        return {
          success: false,
          formId: targetFormId,
          error: errorMessage,
        }
      }
    },
  })
}
