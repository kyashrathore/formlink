import { RunnableConfig } from "@langchain/core/runnables"
import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph"
import logger from "../logger"
import { AgentEvent } from "../types/agent-events"
import { finalizeFormNode } from "./nodes/finalizer"
import { normalizeInputNode } from "./nodes/input_normalizer"
import { generateMetadataAndTasksNode } from "./nodes/metadata_generator"
import { processSingleTaskNode } from "./nodes/task_processor"
import { AgentState, AgentTask } from "./state"

const NODE_NAMES = {
  NORMALIZE_INPUT: "normalize_input",
  GENERATE_METADATA_AND_TASKS: "generate_metadata_and_tasks",
  SELECT_BATCH_FOR_PARALLEL_PROCESSING: "select_batch_for_parallel_processing",
  PROCESS_SINGLE_TASK: "process_single_task",
  FINALIZE_FORM: "finalize_form",
} as const

type NodeName = (typeof NODE_NAMES)[keyof typeof NODE_NAMES]

async function selectBatchForParallelProcessingNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  // Only select tasks that are truly pending (not completed, failed, or in_progress)
  const pendingTasks = (state.tasksToPersist ?? []).filter(
    (task) => task.status === "pending"
  )

  logger.debug(
    {
      totalTasks: state.tasksToPersist?.length || 0,
      pendingTasks: pendingTasks.length,
      taskStatuses: (state.tasksToPersist ?? []).map((t) => ({
        id: t.id,
        status: t.status,
      })),
    },
    "selectBatchForParallelProcessingNode: Task status check"
  )

  if (pendingTasks.length > 0) {
    // Take only a small batch to avoid overwhelming the system
    const batchSize = Math.min(pendingTasks.length, 3)
    const batchToProcess = pendingTasks.slice(0, batchSize).map((task) => ({
      ...task,
      status: "in_progress" as const,
    }))

    logger.debug(
      {
        batchSize: batchToProcess.length,
        taskIds: batchToProcess.map((t) => t.id),
      },
      "selectBatchForParallelProcessingNode: Processing batch"
    )

    return {
      current_processing_batch: batchToProcess,
      currentTaskBeingProcessed: undefined,
      errorDetails: undefined,
      status: "PROCESSING" as const,
      _agentEvents: [],
    }
  }

  logger.debug(
    "selectBatchForParallelProcessingNode: No pending tasks, proceeding to finalization"
  )

  return {
    current_processing_batch: [],
    currentTaskBeingProcessed: undefined,
    status: "PROCESSING" as const,
    _agentEvents: [],
  }
}

function shouldProcessBatchOrFinalize(state: AgentState): NodeName {
  const hasBatchToProcess =
    state.current_processing_batch && state.current_processing_batch.length > 0

  return hasBatchToProcess
    ? NODE_NAMES.PROCESS_SINGLE_TASK
    : NODE_NAMES.FINALIZE_FORM
}

function didMetadataGenerationFail(state: AgentState): NodeName {
  const hasError = state.errorDetails || state.status === "FAILED"

  return hasError
    ? NODE_NAMES.FINALIZE_FORM
    : NODE_NAMES.SELECT_BATCH_FOR_PARALLEL_PROCESSING
}

function createChannelReducer<T>(
  defaultValue: T,
  mergeStrategy: "replace" | "append" | "max" = "replace"
) {
  return {
    value: (current: T | undefined, next: T | undefined): T => {
      if (next === undefined) return current ?? defaultValue
      if (current === undefined) return next

      switch (mergeStrategy) {
        case "append":
          if (Array.isArray(current) && Array.isArray(next)) {
            return [...current, ...next] as T
          }
          return next
        case "max":
          if (typeof current === "number" && typeof next === "number") {
            return Math.max(current, next) as T
          }
          return next
        case "replace":
        default:
          return next
      }
    },
    default: () => defaultValue,
  }
}

function createStringChannelReducer(defaultValue: string) {
  return {
    value: (current: string | undefined, next: string | undefined): string => {
      return next ?? current ?? defaultValue
    },
    default: () => defaultValue,
  }
}

function createOptionalChannelReducer<T>(
  defaultValue: T | undefined = undefined
) {
  return {
    value: (current: T | undefined, next: T | undefined): T | undefined => {
      return next !== undefined ? next : current
    },
    default: () => defaultValue,
  }
}

function createArrayChannelReducer<T>(defaultValue: T[] = []) {
  return {
    value: (current: T[] | undefined, next: T[] | undefined): T[] => {
      const currentArray = current ?? defaultValue
      const nextArray = next ?? []
      return [...currentArray, ...nextArray]
    },
    default: () => defaultValue,
  }
}

function createTasksReducer() {
  return {
    value: (
      currentList: AgentTask[] | undefined,
      nextUpdates: AgentTask[] | undefined
    ): AgentTask[] => {
      const newTaskList = [...(currentList ?? [])]
      const updatesToProcess: AgentTask[] = Array.isArray(nextUpdates)
        ? nextUpdates
        : []

      updatesToProcess.forEach((updatedTask) => {
        if (updatedTask?.id && typeof updatedTask.id === "string") {
          const existingTaskIndex = newTaskList.findIndex(
            (t) => t.id === updatedTask.id
          )
          if (existingTaskIndex !== -1) {
            // Completely replace the task with the updated version
            newTaskList[existingTaskIndex] = updatedTask
          } else {
            newTaskList.push(updatedTask)
          }
        }
      })

      return newTaskList
    },
    default: () => [],
  }
}

function createAgentEventsReducer() {
  return {
    value: (
      current: AgentEvent[] | undefined,
      nextChannelUpdate: AgentEvent[] | undefined
    ): AgentEvent[] => {
      const currentEvents = current ?? []
      const newEvents = nextChannelUpdate ?? []
      return [...currentEvents, ...newEvents]
    },
    default: () => [],
  }
}

const channelsConfig: {
  [key in keyof AgentState]: {
    value: (
      current: AgentState[key] | undefined,
      next: AgentState[key] | undefined
    ) => AgentState[key]
    default: () => AgentState[key]
  }
} = {
  shortId: createStringChannelReducer(""),
  formId: createStringChannelReducer(""),
  userId: createStringChannelReducer(""),
  selectedModel: createOptionalChannelReducer<string>(),
  originalInput: createOptionalChannelReducer<any>(null),
  inputType: {
    value: (
      current: "prompt" | "url" | "html" | undefined,
      next: "prompt" | "url" | "html" | undefined
    ) => {
      return next ?? current ?? "prompt"
    },
    default: () => "prompt" as const,
  },
  normalizedInputContent: createOptionalChannelReducer<string>(),
  formMetadata: createOptionalChannelReducer(),
  questionTitlesFromAI: createArrayChannelReducer<string>(),
  tasksToPersist: createTasksReducer(),
  currentTaskBeingProcessed: createOptionalChannelReducer<AgentTask>(),
  current_processing_batch: createChannelReducer<AgentTask[]>([], "replace"),
  generatedQuestionSchemas: createArrayChannelReducer<any>(),
  settings: {
    value: (
      current: Record<string, any> | undefined,
      next: Record<string, any> | undefined
    ) => {
      return next ?? current ?? {}
    },
    default: () => ({}),
  },
  resultPageGenerationPrompt: createOptionalChannelReducer<string>(),
  journeyScript: createOptionalChannelReducer<string>(),
  errorDetails: createOptionalChannelReducer<{
    node: string
    message: string
    originalError?: any
  }>(),
  agentMessages: createArrayChannelReducer<any>(),
  iteration: {
    value: (current: number | undefined, next: number | undefined) => {
      return next ?? current ?? 0
    },
    default: () => 0,
  },
  status: createOptionalChannelReducer<
    | "INITIALIZING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "PARTIAL"
    | "COMPLETED_IMPLICITLY"
  >(),
  updated_at: createOptionalChannelReducer<string>(),
  eventSequence: {
    value: (current: number | undefined, next: number | undefined) => {
      return Math.max(current ?? 0, next ?? 0)
    },
    default: () => 0,
  },
  _agentEvents: createAgentEventsReducer(),
}

async function processTaskBatch(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  if (
    !state.current_processing_batch ||
    state.current_processing_batch.length === 0
  ) {
    return { _agentEvents: [] }
  }

  const mappedInputs = state.current_processing_batch.map((task, index) => ({
    ...state,
    currentTaskBeingProcessed: task,
    task_to_process: task,
    agentMessages: [],
    _agentEvents: [],
    // Give each parallel task a unique sequence offset to prevent event conflicts
    eventSequence: state.eventSequence + index * 100,
  }))

  const results = await Promise.all(
    mappedInputs.map((singleInput) =>
      processSingleTaskNode(singleInput as AgentState)
    )
  )

  const combinedUpdates: Partial<AgentState> = {
    tasksToPersist: results.flatMap((r) => r.tasksToPersist || []),
    generatedQuestionSchemas: results.flatMap(
      (r) => r.generatedQuestionSchemas || []
    ),
    agentMessages: results.flatMap((r) => r.agentMessages || []),
    _agentEvents: results.flatMap((r) => r._agentEvents || []),
    eventSequence: results.reduce(
      (maxSeq, r) => Math.max(maxSeq, r.eventSequence || state.eventSequence),
      state.eventSequence
    ),
    status: "PROCESSING" as const,
  }

  if (combinedUpdates._agentEvents) {
    combinedUpdates._agentEvents.sort((a, b) => a.sequence - b.sequence)
  }

  return combinedUpdates
}

function createWorkflow() {
  const graphArgs: StateGraphArgs<AgentState> = {
    channels: channelsConfig as any,
  }

  const workflow = new StateGraph<AgentState>(graphArgs)
    .addNode(
      NODE_NAMES.NORMALIZE_INPUT,
      async (state: AgentState, config?: RunnableConfig) =>
        normalizeInputNode(state)
    )
    .addNode(
      NODE_NAMES.GENERATE_METADATA_AND_TASKS,
      async (state: AgentState, config?: RunnableConfig) =>
        generateMetadataAndTasksNode(state)
    )
    .addNode(
      NODE_NAMES.SELECT_BATCH_FOR_PARALLEL_PROCESSING,
      selectBatchForParallelProcessingNode
    )
    .addNode(NODE_NAMES.PROCESS_SINGLE_TASK, processTaskBatch)
    .addNode(
      NODE_NAMES.FINALIZE_FORM,
      async (state: AgentState, config?: RunnableConfig) =>
        finalizeFormNode(state)
    )

  return workflow
}

function addWorkflowEdges(workflow: any): void {
  workflow.addEdge(START, NODE_NAMES.NORMALIZE_INPUT)
  workflow.addEdge(
    NODE_NAMES.NORMALIZE_INPUT,
    NODE_NAMES.GENERATE_METADATA_AND_TASKS
  )

  workflow.addConditionalEdges(
    NODE_NAMES.GENERATE_METADATA_AND_TASKS,
    didMetadataGenerationFail,
    {
      [NODE_NAMES.SELECT_BATCH_FOR_PARALLEL_PROCESSING]:
        NODE_NAMES.SELECT_BATCH_FOR_PARALLEL_PROCESSING,
      [NODE_NAMES.FINALIZE_FORM]: NODE_NAMES.FINALIZE_FORM,
    }
  )

  workflow.addConditionalEdges(
    NODE_NAMES.SELECT_BATCH_FOR_PARALLEL_PROCESSING,
    shouldProcessBatchOrFinalize,
    {
      [NODE_NAMES.PROCESS_SINGLE_TASK]: NODE_NAMES.PROCESS_SINGLE_TASK,
      [NODE_NAMES.FINALIZE_FORM]: NODE_NAMES.FINALIZE_FORM,
    }
  )

  workflow.addEdge(
    NODE_NAMES.PROCESS_SINGLE_TASK,
    NODE_NAMES.SELECT_BATCH_FOR_PARALLEL_PROCESSING
  )
  workflow.addEdge(NODE_NAMES.FINALIZE_FORM, END)
}

function buildAgentGraph() {
  const workflow = createWorkflow()
  addWorkflowEdges(workflow)
  return workflow.compile()
}

export const app = buildAgentGraph()
