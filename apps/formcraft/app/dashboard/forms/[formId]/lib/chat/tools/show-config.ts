import { ChatToolContext, ShowConfigResult } from "@/app/lib/chat/types"
import { tool } from "ai"
import { ShowConfigButtonSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"

export function showConfigButtonTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.showConfigButton,
    inputSchema: ShowConfigButtonSchema,
    execute: async ({
      buttonType,
      formId: targetFormIdFromTool,
      metadata,
    }): Promise<ShowConfigResult> => {
      const { dataStream, formId } = context

      const finalTargetFormId = targetFormIdFromTool || formId

      dataStream.write({
        type: "data-ui_action",
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
