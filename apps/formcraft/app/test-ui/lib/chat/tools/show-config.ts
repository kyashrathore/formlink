import { tool } from "ai"
import { ShowConfigButtonSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext, ShowConfigResult } from "../types"

export function showConfigButtonTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.showConfigButton,
    parameters: ShowConfigButtonSchema,
    execute: async ({
      buttonType,
      formId: targetFormIdFromTool,
      metadata,
    }): Promise<ShowConfigResult> => {
      const { dataStream, formId, userId } = context

      // Use targetFormIdFromTool if provided by AI, otherwise fallback to session formId
      const finalTargetFormId = targetFormIdFromTool || formId

      dataStream.writeData({
        eventName: "ui_action",
        eventData: {
          action: "show_config_button",
          buttonType,
          formId: finalTargetFormId,
          metadata: metadata || {},
          backend_timestamp: new Date().toISOString(),
        },
      })

      return {
        success: true,
        action: "config_button_shown",
        buttonType,
        formId: finalTargetFormId,
        message: `${buttonType} configuration options are now available.`,
      }
    },
  })
}
