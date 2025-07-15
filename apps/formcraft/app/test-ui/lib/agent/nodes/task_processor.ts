import logger from "@/app/lib/logger"
import { getEnvVars, getRequiredEnvVar } from "@/app/lib/utils/env"
import { createServerClient, Database, Json } from "@formlink/db"
import {
  ChoiceQuestionSchema,
  LikertScaleQuestionSchema,
  LinearScaleQuestionSchema,
  Question,
  QuestionTypeEnumSchema,
  RankingQuestionSchema,
  RatingQuestionSchema,
  repairQuestionInputTypes,
  SimpleQuestionSchema,
} from "@formlink/schema"
import { BaseMessage } from "@langchain/core/messages"
import { RunnableConfig } from "@langchain/core/runnables"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"
import { QUESTION_SCHEMA_PROMPT } from "../../prompts"
import { AgentEvent, createAgentEvent } from "../../types/agent-events"
import { AgentState, AgentTask, GenerateSchemaTaskDef } from "../state"
import { buildFormFromState } from "../utils/form-builder"

const NODE_NAME = "processSingleTaskNode"
const DEFAULT_MODEL = "google/gemini-2.5-flash-preview-05-20"

interface TaskProcessingResult {
  taskOutput: any
  newGeneratedSchema?: Question
  taskError?: string
}

interface ProcessedTask extends AgentTask {
  status: "completed" | "failed"
  output?: any
  error?: string
  completed_at: string
}

function createErrorInstance(
  errorCandidate: unknown,
  defaultMessage: string
): Error {
  if (errorCandidate instanceof Error) {
    return errorCandidate
  }
  const message = String(errorCandidate ?? defaultMessage)
  return new Error(message)
}

function getSpecificQuestionSchema(
  type: z.infer<typeof QuestionTypeEnumSchema>
): z.ZodTypeAny {
  const schemaMap = {
    multipleChoice: ChoiceQuestionSchema,
    singleChoice: ChoiceQuestionSchema,
    rating: RatingQuestionSchema,
    ranking: RankingQuestionSchema,
    linearScale: LinearScaleQuestionSchema,
    likertScale: LikertScaleQuestionSchema,
  } as const

  return schemaMap[type as keyof typeof schemaMap] || SimpleQuestionSchema
}

async function createSupabaseClient() {
  return await createServerClient(null, "service")
}

async function updateTaskStatusInDB(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  taskId: string,
  status: string,
  additionalFields: Record<string, any> = {}
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status, ...additionalFields })
    .eq("id", taskId)

  if (error) {
    logger.warn({ error, taskId }, `Failed to update task to ${status} in DB`)
  }
}

function validateTask(task: AgentTask | undefined): string | null {
  if (!task || !task.id) {
    return "No valid task_to_process found in state for processSingleTaskNode"
  }
  return null
}

function buildQuestionPrompt(
  schemaTaskDef: GenerateSchemaTaskDef,
  state: AgentState
): string {
  const questionSystemPromptTemplate = QUESTION_SCHEMA_PROMPT || ""
  const formTitle = state.formMetadata?.title ?? "Untitled Form"
  const formDescription =
    state.formMetadata?.description ?? "No description provided."
  const questionTitle = schemaTaskDef.question_title ?? "Unnamed Question"
  const totalQuestions =
    state.tasksToPersist?.filter(
      (t) => t.task_definition.type === "generate_question_schema"
    ).length || 1

  return questionSystemPromptTemplate
    .replace(/{{formTitle}}/g, formTitle)
    .replace(/{{formDescription}}/g, formDescription)
    .replace(/{{questionTitle}}/g, questionTitle)
    .replace(/{{questionType}}/g, schemaTaskDef.question_type)
    .replace(/{{questionOrder}}/g, String(schemaTaskDef.order + 1))
    .replace(/{{totalQuestions}}/g, String(totalQuestions))
}

async function processGenerateQuestionSchema(
  currentTask: AgentTask,
  state: AgentState,
  MODEL: any
): Promise<TaskProcessingResult> {
  const schemaTaskDef = currentTask.task_definition as GenerateSchemaTaskDef

  if (!schemaTaskDef.question_title && !schemaTaskDef.question_specs) {
    return {
      taskOutput: null,
      taskError:
        "Missing question_title or question_specs for generate_question_schema task.",
    }
  }

  if (!schemaTaskDef.question_type) {
    return {
      taskOutput: null,
      taskError: `Missing question_type for task: "${schemaTaskDef.question_title}".`,
    }
  }

  let specificQuestionZodSchema: z.ZodTypeAny
  try {
    specificQuestionZodSchema = getSpecificQuestionSchema(
      schemaTaskDef.question_type
    )
  } catch (e: any) {
    return {
      taskOutput: null,
      taskError: `Failed to get Zod schema for type "${schemaTaskDef.question_type}": ${e.message}`,
    }
  }

  const populatedQuestionSystemPrompt = buildQuestionPrompt(
    schemaTaskDef,
    state
  )
  const questionTitle = schemaTaskDef.question_title ?? "Unnamed Question"
  const totalQuestions =
    state.tasksToPersist?.filter(
      (t) => t.task_definition.type === "generate_question_schema"
    ).length || 1

  const generateSchemaResult = await generateObject({
    model: MODEL,
    schema: specificQuestionZodSchema,
    system: populatedQuestionSystemPrompt,
    prompt: `Generate a complete JSON schema for the question: "${questionTitle}" (type: ${schemaTaskDef.question_type}). This is question ${schemaTaskDef.order + 1} of ${totalQuestions}.`,
  })

  if (!generateSchemaResult?.object) {
    return {
      taskOutput: null,
      taskError: `AI call for schema generation failed. Question: "${questionTitle}".`,
    }
  }

  const { object: aiGeneratedSpecificSchema } = generateSchemaResult
  const order =
    currentTask.order ?? (state.generatedQuestionSchemas?.length || 0) + 1

  const constructedQuestion: Question = {
    ...(aiGeneratedSpecificSchema as any),
    questionNo: order,
    type: "question" as const,
  }

  if (!constructedQuestion.title) {
    constructedQuestion.title = `Question ${order}`
  }

  const repairedSchemaArray = repairQuestionInputTypes([constructedQuestion])
  const finalConstructedQuestion = repairedSchemaArray[0] as Question

  return {
    taskOutput: finalConstructedQuestion,
    newGeneratedSchema: finalConstructedQuestion,
  }
}

async function processTask(
  currentTask: AgentTask,
  state: AgentState
): Promise<TaskProcessingResult> {
  const allEnv = getEnvVars()
  const openRouterProvider = createOpenRouter({
    apiKey: getRequiredEnvVar("OPENROUTER_API_KEY", allEnv),
  })
  const MODEL = openRouterProvider(state.selectedModel || DEFAULT_MODEL)

  switch (currentTask.task_definition.type) {
    case "generate_question_schema":
      return await processGenerateQuestionSchema(currentTask, state, MODEL)
    default:
      const taskDefForError = currentTask.task_definition as any
      return {
        taskOutput: null,
        taskError: `Unknown task type: ${taskDefForError?.type || "undefined"}`,
      }
  }
}

function createTaskEvents(
  currentTask: AgentTask,
  result: TaskProcessingResult,
  state: AgentState,
  currentSequence: number
): AgentEvent[] {
  const events: AgentEvent[] = []
  const taskTypeForEvent = currentTask.task_definition?.type ?? "unknown_type"
  const taskId = currentTask.id || "unknown_task_id"

  events.push(
    createAgentEvent(
      "task_started",
      "progress",
      {
        taskId,
        taskType: taskTypeForEvent,
        current: 0,
        total: 1,
        message: `Starting task: ${taskTypeForEvent} - ${(currentTask.task_definition as any)?.question_title || taskId}`,
      },
      state.formId,
      state.userId,
      currentSequence++
    )
  )

  if (result.taskError) {
    events.push(
      createAgentEvent(
        "task_failed",
        "progress",
        {
          taskId,
          taskType: taskTypeForEvent,
          current: 1,
          total: 1,
          message: `Task failed: ${result.taskError}`,
          output: result.taskOutput,
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )

    events.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: `Task processing failed for ${taskTypeForEvent}: ${result.taskError}`,
          details: result.taskError,
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )
  } else {
    if (
      currentTask.task_definition.type === "generate_question_schema" &&
      result.newGeneratedSchema
    ) {
      const schemaTaskDef = currentTask.task_definition as GenerateSchemaTaskDef
      const questionTitle =
        result.newGeneratedSchema.title ?? "Untitled Question"
      const questionIndex = schemaTaskDef.order
      const totalQuestions =
        state.tasksToPersist?.filter(
          (t) => t.task_definition.type === "generate_question_schema"
        ).length || 1
      const eventMessage = `Generated schema for question ${questionIndex + 1}/${totalQuestions}: '${questionTitle}'`

      events.push(
        createAgentEvent(
          "question_schema_generated",
          "progress",
          {
            questionTitle,
            questionIndex,
            totalQuestions,
            message: eventMessage,
          },
          state.formId,
          state.userId,
          currentSequence++
        )
      )

      // Create state snapshot with the newly generated question
      const intermediateAgentStateForSnapshot = {
        ...state,
        generatedQuestionSchemas: [
          ...(state.generatedQuestionSchemas || []),
          result.newGeneratedSchema,
        ],
      }

      const formSnapshot = buildFormFromState(intermediateAgentStateForSnapshot)

      events.push(
        createAgentEvent(
          "state_snapshot",
          "state",
          {
            form: formSnapshot,
            agentState: intermediateAgentStateForSnapshot,
            isComplete: false,
          },
          state.formId,
          state.userId,
          currentSequence++
        )
      )
    }

    events.push(
      createAgentEvent(
        "task_completed",
        "progress",
        {
          taskId,
          taskType: taskTypeForEvent,
          current: 1,
          total: 1,
          message: `Task completed: ${taskTypeForEvent}`,
          output: result.taskOutput,
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )
  }

  return events
}

async function handleDatabaseOperations(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  currentTask: AgentTask,
  processedTask: ProcessedTask,
  messages: BaseMessage[]
): Promise<void> {
  const startTime = new Date().toISOString()
  const taskId = currentTask.id || "unknown_task_id"

  try {
    await updateTaskStatusInDB(supabase, taskId, "in_progress", {
      started_at: startTime,
    })
  } catch (e) {
    logger.warn(
      { error: e },
      "Failed to update task start status in DB (non-critical)"
    )
  }

  try {
    await updateTaskStatusInDB(supabase, taskId, processedTask.status, {
      output: processedTask.output as any,
      error: processedTask.error ?? null,
      completed_at: processedTask.completed_at,
    })
  } catch (e) {
    logger.error({ error: e }, "Error updating task final status in DB")
  }
}

export async function processSingleTaskNode(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  const _agentEvents: AgentEvent[] = []
  let currentEventSequence = state.eventSequence

  const currentTask = (state as any).task_to_process as AgentTask | undefined
  const messages: BaseMessage[] = [...(state.agentMessages ?? [])]

  logger.debug(
    {
      formId: state.formId,
      userId: state.userId,
      task_to_process: currentTask,
    },
    `${NODE_NAME}: ENTRY`
  )

  const validationError = validateTask(currentTask)
  if (validationError) {
    logger.warn({ state }, validationError)

    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: "No task provided for processing in node.",
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    return {
      agentMessages: messages,
      errorDetails: {
        node: NODE_NAME,
        message: "No task_to_process found.",
        originalError: new Error("No task_to_process"),
      },
      status: "FAILED",
      _agentEvents,
      eventSequence: currentEventSequence,
    }
  }

  logger.debug(
    {
      taskId: currentTask!.id,
      type: currentTask!.task_definition?.type,
      formId: currentTask!.form_id,
    },
    "Processing task"
  )

  let supabase: Awaited<ReturnType<typeof createSupabaseClient>>
  try {
    supabase = await createSupabaseClient()
  } catch (e) {
    const errorMsg = "Supabase client initialization failed in task processor."
    logger.error({ error: e }, errorMsg)

    const failedTask = {
      ...currentTask!,
      status: "failed" as const,
      error: errorMsg,
      completed_at: new Date().toISOString(),
    }

    _agentEvents.push(
      createAgentEvent(
        "task_failed",
        "progress",
        {
          taskId: currentTask!.id || "unknown_task_id",
          taskType: currentTask!.task_definition.type,
          current: 1,
          total: 1,
          message: errorMsg,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: errorMsg,
          details: e,
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    return {
      agentMessages: messages,
      tasksToPersist: [failedTask],
      errorDetails: {
        node: NODE_NAME,
        message: errorMsg,
        originalError: createErrorInstance(e, "Supabase client error"),
      },
      status: "FAILED",
      _agentEvents,
      eventSequence: currentEventSequence,
    }
  }

  try {
    const result = await processTask(currentTask!, state)

    const processedTask: ProcessedTask = {
      ...currentTask!,
      status: result.taskError ? "failed" : "completed",
      output: result.taskOutput,
      error: result.taskError,
      completed_at: new Date().toISOString(),
    }

    await handleDatabaseOperations(
      supabase,
      currentTask!,
      processedTask,
      messages
    )

    const taskEvents = createTaskEvents(
      currentTask!,
      result,
      state,
      currentEventSequence
    )
    _agentEvents.push(...taskEvents)
    currentEventSequence += taskEvents.length

    const returnState: Partial<AgentState> = {
      agentMessages: messages,
      tasksToPersist: [processedTask],
      _agentEvents,
      eventSequence: currentEventSequence,
    }

    if (result.taskError) {
      returnState.errorDetails = {
        node: NODE_NAME,
        message: result.taskError,
        originalError: createErrorInstance(
          result.taskError,
          "Task processing error"
        ),
      }
    }

    if (result.newGeneratedSchema) {
      returnState.generatedQuestionSchemas = [result.newGeneratedSchema]
    }

    logger.debug({ returnStatePartial: returnState }, `${NODE_NAME}: EXIT`)
    return returnState
  } catch (error: any) {
    const errorMsg = error?.message
      ? String(error.message)
      : String(error?.toString() || `Unknown error in ${NODE_NAME}`)
    logger.error(
      { error, taskId: currentTask!.id },
      `${NODE_NAME}: CATCH_ERROR`
    )

    const taskFailedInCatch: ProcessedTask = {
      ...currentTask!,
      status: "failed",
      error: errorMsg,
      completed_at: new Date().toISOString(),
    }

    const taskId = currentTask!.id || "unknown_task_id"
    try {
      await updateTaskStatusInDB(supabase, taskId, "failed", {
        error: errorMsg,
        completed_at: taskFailedInCatch.completed_at,
      })
    } catch (catchDbError) {
      logger.error(
        { error: catchDbError },
        "Error updating task in DB during catch block"
      )
    }

    const taskTypeForEvent =
      currentTask!.task_definition?.type ?? "unknown_type"
    _agentEvents.push(
      createAgentEvent(
        "task_failed",
        "progress",
        {
          taskId,
          taskType: taskTypeForEvent,
          current: 1,
          total: 1,
          message: `Task failed critically: ${errorMsg}`,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: `Critical error processing task ${taskTypeForEvent}: ${errorMsg}`,
          details: error,
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    return {
      agentMessages: messages,
      tasksToPersist: [taskFailedInCatch],
      errorDetails: {
        node: NODE_NAME,
        message: `Failed to process task: ${taskTypeForEvent}. Error: ${errorMsg}`,
        originalError: createErrorInstance(error, errorMsg),
      },
      status: "FAILED",
      _agentEvents,
      eventSequence: currentEventSequence,
    }
  }
}
