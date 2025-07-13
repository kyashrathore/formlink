import { getEnvVars, getRequiredEnvVar } from "@/app/lib/utils/env"
import { createServerClient, Database } from "@formlink/db"
import { QuestionTypeEnumSchema } from "@formlink/schema"
import { BaseMessage } from "@langchain/core/messages"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamObject } from "ai"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { MODEL_DEFAULT } from "../../config"
import { ENHANCED_METADATA_PROMPT } from "../../prompts"
import { AgentEvent, createAgentEvent } from "../../types/agent-events"
import {
  AgentState,
  AgentTask,
  FormMetadata,
  GenerateSchemaTaskDef,
} from "../state"
import { handleStreamWithTimeout } from "../utils"

const QuestionDetailSchema = z.object({
  question_specs: z.string().min(1, "Question text cannot be empty."),
  type: QuestionTypeEnumSchema,
})

const MetadataResponseSchema = z.object({
  title: z.string().min(1, "Title cannot be empty."),
  description: z.string().min(1, "Description cannot be empty."),
  questionDetails: z
    .array(QuestionDetailSchema)
    .min(1, "At least one question detail is required."),
  journeyScript: z
    .string()
    .min(1, "Journey script cannot be empty.")
    .describe("Complete form journey in markdown format with semantic tags"),
})

export async function generateMetadataAndTasksNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const nodeName = "generateMetadataAndTasksNode"
  const _agentEvents: AgentEvent[] = []
  let currentEventSequence = state.eventSequence

  const allEnv = getEnvVars()
  const apiKey = getRequiredEnvVar("OPENROUTER_API_KEY", allEnv)
  const selectedModel = state.selectedModel || MODEL_DEFAULT
  // API Key check already done, assuming it's present or getRequiredEnvVar throws
  const openRouterProvider = createOpenRouter({ apiKey })

  const messages: BaseMessage[] = [...(state.agentMessages ?? [])]

  if (!state.normalizedInputContent) {
    const errorMsg =
      "Normalized input content is missing. Cannot generate metadata."
    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        { message: errorMsg, recoverable: false },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    const errorReturnState: Partial<AgentState> = {
      agentMessages: messages,
      errorDetails: { node: nodeName, message: errorMsg },
      status: "FAILED" as const,
      _agentEvents,
      eventSequence: currentEventSequence,
    }
    // No full state snapshot here as it's an early exit before major processing
    return errorReturnState
  }

  _agentEvents.push(
    createAgentEvent(
      "task_started",
      "progress",
      {
        taskId: `${nodeName}_${state.formId}`,
        taskType: "metadata_and_task_generation",
        current: 0,
        total: 1,
        message: "Generating form metadata and task list...",
      },
      state.formId,
      state.userId,
      currentEventSequence++
    )
  )

  let formMetadata: FormMetadata | undefined = undefined
  const tasksToPersist: AgentTask[] = []
  const questionTitlesFromAI: string[] = []
  let questionDetailsCount = 0

  try {
    const systemPromptTemplate = ENHANCED_METADATA_PROMPT || ""
    const aiSystemPromptWithInput = systemPromptTemplate.replace(
      "{{userInput}}",
      state.normalizedInputContent
    )

    const streamResult = await streamObject({
      model: openRouterProvider(selectedModel),
      schema: MetadataResponseSchema,
      system: aiSystemPromptWithInput,
      prompt: state.normalizedInputContent,
    })

    // Iterate for streaming experience (though this node resolves once fully done)
    let tempTitle: string | undefined
    let tempDescription: string | undefined
    let tempJourneyScript: string | undefined
    const tempQuestionDetails: Array<{
      question_specs: string
      type: z.infer<typeof QuestionTypeEnumSchema>
    }> = []
    for await (const partialObject of streamResult.partialObjectStream) {
      if (partialObject.title) tempTitle = partialObject.title
      if (partialObject.description) tempDescription = partialObject.description
      if (partialObject.journeyScript)
        tempJourneyScript = partialObject.journeyScript
      if (partialObject.questionDetails) {
        for (
          let i = tempQuestionDetails.length;
          i < partialObject.questionDetails.length;
          i++
        ) {
          const detail = partialObject.questionDetails[i]
          if (
            detail &&
            typeof detail.question_specs === "string" &&
            detail.type
          ) {
            tempQuestionDetails.push({
              question_specs: detail.question_specs,
              type: detail.type,
            })
          }
        }
      }
    }
    const aiResponseData = await handleStreamWithTimeout(streamResult, 5000) // Ensure full object

    // AI Response Data received

    if (
      !aiResponseData ||
      !aiResponseData.title ||
      !aiResponseData.description
    ) {
      throw new Error("Failed to obtain complete form metadata from AI stream.")
    }

    // Log journey script generation
    if (aiResponseData.journeyScript) {
      // Journey script generated by AI
    } else {
      // Journey script not generated by AI
    }

    formMetadata = {
      title: aiResponseData.title,
      description: aiResponseData.description,
    }

    ;(aiResponseData.questionDetails || []).forEach(
      (detail: any, index: any) => {
        questionDetailsCount++
        const questionTitle = detail.question_specs
        questionTitlesFromAI.push(questionTitle)
        tasksToPersist.push({
          id: uuidv4(),
          form_id: state.formId,
          task_definition: {
            type: "generate_question_schema",
            question_title: questionTitle,
            question_type: detail.type,
            order: index,
          } as GenerateSchemaTaskDef,
          status: "pending",
          order: index,
        })
      }
    )

    let supabase
    try {
      supabase = await createServerClient(null, "service")
    } catch (e) {
      const errorMsg = "Failed to initialize Supabase client for DB operations."
      _agentEvents.push(
        createAgentEvent(
          "agent_error",
          "error",
          { message: errorMsg, details: e, recoverable: false },
          state.formId,
          state.userId,
          currentEventSequence++
        )
      )
      return {
        agentMessages: messages,
        errorDetails: {
          node: nodeName,
          message: errorMsg,
          originalError: e as Error,
        },
        status: "FAILED" as const,
        _agentEvents,
        eventSequence: currentEventSequence,
      }
    }

    if (tasksToPersist.length > 0) {
      const tasksToInsert = tasksToPersist.map((task) => ({
        id: task.id,
        form_id: task.form_id,
        task_definition: task.task_definition as any,
        status: task.status,
      }))
      const { error: insertError } = await supabase
        .from("tasks")
        .insert(tasksToInsert)
      if (insertError) {
        const errorMsg = "Failed to insert tasks into database."
        _agentEvents.push(
          createAgentEvent(
            "agent_error",
            "error",
            { message: errorMsg, details: insertError, recoverable: false },
            state.formId,
            state.userId,
            currentEventSequence++
          )
        )
        return {
          agentMessages: messages,
          formMetadata,
          questionTitlesFromAI,
          tasksToPersist,
          errorDetails: {
            node: nodeName,
            message: errorMsg,
            originalError: insertError,
          },
          status: "FAILED" as const,
          _agentEvents,
          eventSequence: currentEventSequence,
        }
      } else {
        // Log task_list_generated to DB (optional, as events are now streamed)
        // Consider if this DB log is still needed or if streamed event is sufficient
      }
    }

    _agentEvents.push(
      createAgentEvent(
        "agent_warning",
        "system",
        {
          message: `Task list generated for form ${formMetadata.title}. ${tasksToPersist.length} tasks created.`,
          details: {
            taskCount: tasksToPersist.length + 2, // +1 for metadata task, +1 for finalization
            questionTaskCount: questionDetailsCount,
            event_source: "metadata_generator_task_list",
          },
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    // Add event for journey script generation
    if (aiResponseData.journeyScript) {
      _agentEvents.push(
        createAgentEvent(
          "agent_warning",
          "system",
          {
            message: `Form journey script generated with psychological strategy and result generation instructions.`,
            details: {
              hasStrategy: aiResponseData.journeyScript.includes("<strategy>"),
              hasResultGeneration: aiResponseData.journeyScript.includes(
                "<result-generation>"
              ),
              event_source: "metadata_generator_journey_script",
            },
          },
          state.formId,
          state.userId,
          currentEventSequence++
        )
      )
    }

    _agentEvents.push(
      createAgentEvent(
        "task_completed",
        "progress",
        {
          taskId: `${nodeName}_${state.formId}`,
          taskType: "metadata_and_task_generation",
          current: 1,
          total: 1,
          message: "Form metadata and task list generated successfully.",
          output: {
            formTitle: formMetadata?.title,
            taskCount: tasksToPersist.length,
          },
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    // No final state snapshot from this node, finalizeFormNode will do that.
    // This node just updates state and produces events related to its specific job.
    return {
      agentMessages: messages,
      formMetadata,
      questionTitlesFromAI,
      tasksToPersist,
      journeyScript: aiResponseData.journeyScript,
      errorDetails: undefined,
      status: "PROCESSING" as const,
      _agentEvents,
      eventSequence: currentEventSequence,
    }
  } catch (error: any) {
    // Error in metadata generator node
    const rawErrorMessage =
      error?.message || "Unknown error during metadata/task generation."
    let detailedNodeMessage = `Failed during metadata/task generation: ${rawErrorMessage}`
    // (Keep original error classification logic if needed)

    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: "I encountered an issue while trying to plan out the form.", // User-friendly
          details: { nodeMessage: detailedNodeMessage, originalError: error },
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )
    _agentEvents.push(
      createAgentEvent(
        "task_failed",
        "progress",
        {
          taskId: `${nodeName}_${state.formId}`,
          taskType: "metadata_and_task_generation",
          current: 1,
          total: 1,
          message: detailedNodeMessage,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    return {
      agentMessages: messages,
      errorDetails: {
        node: nodeName,
        message: detailedNodeMessage,
        originalError: error,
      },
      status: "FAILED" as const,
      _agentEvents,
      eventSequence: currentEventSequence,
    }
  }
}
