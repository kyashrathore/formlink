import { tool } from "ai"
import { createFormAgent } from "../../agents/simple-agent"
import logger from "../../logger"
import { CreateFormAgentSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext, FormCreationResult } from "../types"

export function createFormTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.createFormAgent,
    parameters: CreateFormAgentSchema,
    execute: async ({ prompt }): Promise<FormCreationResult> => {
      const { dataStream, formId, supabase, userId, options } = context

      try {
        // Get the shortId from the existing form
        const { data: formData, error: fetchError } = await supabase
          .from("forms")
          .select("short_id")
          .eq("id", formId)
          .single()

        if (fetchError || !formData) {
          logger.error("[TOOL] Form not found in database", {
            formId,
            error: fetchError,
          })
          throw new Error(`Form ${formId} not found in database`)
        }

        const shortId = formData.short_id
        logger.info("[TOOL] Using existing form", { formId, shortId })

        return await processFormCreation(
          dataStream,
          formId,
          shortId,
          userId,
          prompt,
          options
        )
      } catch (error) {
        logger.error("[TOOL] Error in createFormAgent tool", { error })
        return {
          success: false,
          formId,
          message: "Form creation failed due to an error",
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}

async function processFormCreation(
  dataStream: any,
  formId: string,
  shortId: string,
  userId: string,
  prompt: string,
  options?: any
): Promise<FormCreationResult> {
  logger.info("[TOOL] createFormAgent called", {
    formId,
    userId,
    prompt: prompt.substring(0, 100) + "...",
  })

  let formTitle = "Untitled Form"
  let questionCount = 0
  let formDescription = ""
  let success = false

  const agentParams = {
    prompt,
    formId,
    shortId,
    selectedModel: options?.model,
  }

  for await (const agentEvent of createFormAgent(agentParams, userId)) {
    logger.info({
      message: "[TOOL] Processing agentEvent from createFormAgent",
      type: agentEvent.type,
      category: agentEvent.category,
      sequence: agentEvent.sequence,
    })

    dataStream.writeData({
      type: "custom_agent_event",
      payload: agentEvent as any,
    })

    if (
      agentEvent.category === "state" &&
      agentEvent.type === "state_snapshot"
    ) {
      logger.info({
        message: "[TOOL] StateSnapshot received",
        isComplete: agentEvent.data.isComplete,
        status: agentEvent.data.agentState?.status,
        formTitleInData: agentEvent.data.form?.title,
        questionCountInData: agentEvent.data.form?.questions?.length,
      })

      if (agentEvent.data.isComplete) {
        success = agentEvent.data.agentState.status === "COMPLETED"
        formTitle = agentEvent.data.form.title || "Untitled Form"
        questionCount = agentEvent.data.form.questions.length
        formDescription = agentEvent.data.form.description || ""
        logger.info({
          message: "[TOOL] Final state snapshot processed",
          success,
          formTitle,
          questionCount,
        })
      }
    } else if (
      agentEvent.category === "error" &&
      agentEvent.type === "agent_error"
    ) {
      success = false
      logger.warn({
        message: "[TOOL] Agent error event processed, setting success=false",
        errorData: agentEvent.data,
      })
    }
  }

  logger.info("[TOOL] LangGraph agent execution completed", {
    formId,
    success,
    questionCount,
  })

  return {
    success,
    formId,
    formTitle,
    questionCount,
    formDescription,
    message: success
      ? `Form creation completed successfully. Created "${formTitle}" with ${questionCount} questions.`
      : "Form creation failed",
  }
}
