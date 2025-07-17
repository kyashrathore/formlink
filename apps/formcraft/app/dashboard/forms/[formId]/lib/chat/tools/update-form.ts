import { tool } from "ai"
import { updateFormAgent } from "../../agents/simple-agent"
import logger from "../../logger"
import { UpdateFormSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext, FormUpdateResult } from "../types"

export function updateFormTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.updateForm,
    parameters: UpdateFormSchema,
    execute: async ({ updates }): Promise<FormUpdateResult> => {
      const { dataStream, formId, userId, options, isFirstMessage } = context

      try {
        return await processFormUpdate(
          dataStream,
          formId,
          userId,
          updates,
          options,
          isFirstMessage
        )
      } catch (error) {
        logger.error("Error in updateForm tool:", { error })
        return {
          success: false,
          formId,
          message: "Form update failed due to an error",
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}

async function processFormUpdate(
  dataStream: any,
  targetFormId: string,
  userId: string,
  updates: any,
  options?: any,
  isFirstMessage: boolean = false
): Promise<FormUpdateResult> {
  logger.info("[TOOL] Starting form update agent execution", { targetFormId })

  let success = false
  const agentUpdateParams = {
    formId: targetFormId,
    updates,
    selectedModel: options?.model,
  }

  for await (const agentEvent of updateFormAgent(agentUpdateParams, userId)) {
    dataStream.writeData({
      type: "custom_agent_event",
      payload: agentEvent as any,
    })

    if (
      agentEvent.category === "state" &&
      agentEvent.type === "state_snapshot" &&
      agentEvent.data.isComplete
    ) {
      success = agentEvent.data.agentState.status === "COMPLETED"
    } else if (
      agentEvent.category === "error" &&
      agentEvent.type === "agent_error"
    ) {
      success = false
    }
  }

  logger.info("[TOOL] LangGraph update agent execution completed", {
    targetFormId,
    success,
  })

  // If this is the first message and the update succeeded, send a navigation hint
  if (isFirstMessage && success) {
    dataStream.writeData({
      type: "custom_agent_event",
      payload: {
        type: "task_completed",
        category: "progress",
        data: {
          taskId: `navigate_to_form_${targetFormId}`,
          taskType: "navigation_hint",
          message: "Form ready for viewing",
        },
        formId: targetFormId,
        userId,
        timestamp: new Date().toISOString(),
      },
    })
  }

  return {
    success,
    formId: targetFormId,
    message: success ? "Form updated successfully" : "Form update failed",
  }
}
