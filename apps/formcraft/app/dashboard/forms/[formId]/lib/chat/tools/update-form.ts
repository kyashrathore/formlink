import { updateFormAgent } from "@/app/lib/agents/simple-agent"
import { ChatToolContext, FormUpdateResult } from "@/app/lib/chat/types"
import { tool } from "ai"
import logger from "../../logger"
import { UpdateFormSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"

export function updateFormTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.updateForm,
    inputSchema: UpdateFormSchema,
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

interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
}

interface FormAgentOptions {
  model?: string
  [key: string]: unknown
}

interface FormUpdate {
  [key: string]: unknown
}

async function processFormUpdate(
  dataStream: DataStream,
  targetFormId: string,
  userId: string,
  updates: FormUpdate,
  options?: FormAgentOptions,
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
    dataStream.write({
      type: "data-agent_event",
      data: agentEvent,
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

  if (isFirstMessage && success) {
    dataStream.write({
      type: "data-agent_event",
      data: {
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
