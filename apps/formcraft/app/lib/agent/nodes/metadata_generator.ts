import { getenv } from "@/lib/env"
import { createServerClient } from "@formlink/db"
import { QuestionTypeEnumSchema } from "@formlink/schema"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { ENHANCED_METADATA_PROMPT } from "../../prompts"
import { AgentEvent, createAgentEvent } from "../../types/agent-events"
import {
  AgentMessage,
  AgentState,
  AgentTask,
  FormMetadata,
  GenerateSchemaTaskDef,
} from "../state"

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

  const messages: AgentMessage[] = [...(state.agentMessages ?? [])]

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

    const openRouterProvider = createOpenRouter({
      apiKey: getenv("OPENROUTER_API_KEY") || "",
    })

    const result = await generateObject({
      model: openRouterProvider("openai/gpt-4o-mini"),
      schema: MetadataResponseSchema,
      system: aiSystemPromptWithInput,
      prompt: state.normalizedInputContent,
    })

    const aiResponseData = result.object

    if (
      !aiResponseData ||
      !aiResponseData.title ||
      !aiResponseData.description
    ) {
      throw new Error("Failed to obtain complete form metadata from AI stream.")
    }
    formMetadata = {
      title: aiResponseData.title,
      description: aiResponseData.description,
    }
    ;(aiResponseData.questionDetails || []).forEach(
      (detail: z.infer<typeof QuestionDetailSchema>, index: number) => {
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
      }
    }

    _agentEvents.push(
      createAgentEvent(
        "agent_warning",
        "system",
        {
          message: `Task list generated for form ${formMetadata.title}. ${tasksToPersist.length} tasks created.`,
          details: {
            taskCount: tasksToPersist.length + 2,
            questionTaskCount: questionDetailsCount,
            event_source: "metadata_generator_task_list",
          },
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

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
  } catch (error) {
    const rawErrorMessage =
      (error as Error)?.message ||
      "Unknown error during metadata/task generation."
    const detailedNodeMessage = `Failed during metadata/task generation: ${rawErrorMessage}`

    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: "I encountered an issue while trying to plan out the form.",
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
