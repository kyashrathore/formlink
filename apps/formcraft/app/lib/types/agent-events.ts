import {
  Form,
  Question as QuestionSchema,
} from "@formlink/schema"

// Define QuestionType locally since it's not exported from schema
type QuestionType = 
  | "text"
  | "singleChoice" 
  | "multipleChoice"
  | "rating"
  | "date"
  | "ranking"
  | "fileUpload"
  | "address"
  | "linearScale"
  | "likertScale"
import { nanoid } from "nanoid"

export interface AgentMessage {
  role: "system" | "user" | "assistant"
  content: string
  timestamp?: string
}

export interface GenerateSchemaTaskDef {
  type: "generate_question_schema"
  question_title?: string
  question_specs?: string
  question_type: QuestionType
  order: number
}

export interface GenerateResultPromptTaskDef {
  type: "generate_result_prompt"
}

export interface InputNormalizationTaskDef {
  type: "input_normalization"
}

export interface MetadataAndTaskListGenerationTaskDef {
  type: "metadata_and_task_list_generation"
}

export type TaskDefinition =
  | GenerateSchemaTaskDef
  | GenerateResultPromptTaskDef
  | InputNormalizationTaskDef
  | MetadataAndTaskListGenerationTaskDef

export interface AgentTask {
  id?: string
  form_id: string
  task_definition: TaskDefinition
  status: "pending" | "in_progress" | "completed" | "failed"
  order?: number
  output?: unknown
  error?: string
  retries?: number
  started_at?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
}

export interface FormMetadata {
  title: string
  description: string
}

export interface AgentState {
  formId: string
  shortId: string
  userId: string

  selectedModel?: string

  originalInput: string | Record<string, unknown>
  inputType: "prompt" | "url" | "html"
  normalizedInputContent?: string

  formMetadata?: FormMetadata
  questionTitlesFromAI?: string[]

  tasksToPersist: AgentTask[]
  currentTaskBeingProcessed?: AgentTask
  current_processing_batch?: AgentTask[]

  generatedQuestionSchemas: QuestionSchema[]
  settings?: Record<string, unknown>
  resultPageGenerationPrompt?: string
  journeyScript?: string

  errorDetails?: {
    node: string
    message: string
    originalError?: unknown
  }
  agentMessages: AgentMessage[]

  iteration: number
  eventSequence: number
  _agentEvents?: AgentEvent[]

  status?:
    | "INITIALIZING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "PARTIAL"
    | "COMPLETED_IMPLICITLY"
  updated_at?: string
}

export function createInitialAgentState(
  formId: string,
  shortId: string,
  userId: string,
  input: string | Record<string, unknown>,
  inputType: "prompt" | "url" | "html",
  selectedModel?: string
): AgentState {
  return {
    formId,
    shortId,
    userId,
    originalInput: input,
    inputType,
    selectedModel,
    tasksToPersist: [],
    generatedQuestionSchemas: [],
    agentMessages: [],
    iteration: 0,
    eventSequence: 0,
    _agentEvents: [],
    resultPageGenerationPrompt: "",
  }
}

export interface BaseAgentEvent {
  id: string
  type: string
  category: "progress" | "state" | "error" | "system"
  timestamp: string
  formId: string
  userId: string
  sequence: number
}

export type AgentEvent =
  | ProgressEvent
  | StateSnapshotEvent
  | ErrorEvent
  | SystemEvent
  | QuestionSchemaGeneratedEvent

export interface ProgressEvent extends BaseAgentEvent {
  category: "progress"
  type: "task_started" | "task_completed" | "task_failed"
  data: {
    taskId: string
    taskType: string
    current: number
    total: number
    message: string
    output?: unknown
  }
}

export function createAgentEvent<
  T extends AgentEvent["type"],
  C extends AgentEvent["category"],
  D extends AgentEvent["data"],
>(
  type: T,
  category: C,
  data: D,
  formId: string,
  userId: string,
  sequence: number,
  idGenerator: () => string = nanoid
): BaseAgentEvent & { type: T; category: C; data: D } {
  return {
    id: idGenerator(),
    type,
    category,
    data,
    timestamp: new Date().toISOString(),
    formId,
    userId,
    sequence,
  } as BaseAgentEvent & { type: T; category: C; data: D }
}

export interface StateSnapshotEvent extends BaseAgentEvent {
  category: "state"
  type: "state_snapshot"
  data: {
    form: Form
    agentState: AgentState
    isComplete: boolean
  }
}

export interface ErrorEvent extends BaseAgentEvent {
  category: "error"
  type: "agent_error"
  data: {
    message: string
    details?: unknown
    recoverable: boolean
  }
}

export interface SystemEvent extends BaseAgentEvent {
  category: "system"
  type: "agent_initialized" | "agent_finalized" | "agent_warning"
  data: {
    message: string
    details?: unknown
  }
}

export interface QuestionSchemaGeneratedEvent extends BaseAgentEvent {
  category: "progress"
  type: "question_schema_generated"
  data: {
    questionTitle: string
    questionIndex: number
    totalQuestions: number
    question: any // The actual generated question object
    message: string
  }
}
