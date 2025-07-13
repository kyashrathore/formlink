import { QuestionType } from "@formlink/schema"
import { AgentEvent } from "../types/agent-events" // Added import

export interface GenerateSchemaTaskDef {
  type: "generate_question_schema"
  question_title?: string // Keep for backward compatibility
  question_specs?: string // New field for rich markdown specs
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
  output?: any
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

  originalInput: any
  inputType: "prompt" | "url" | "html"
  normalizedInputContent?: string

  formMetadata?: FormMetadata
  questionTitlesFromAI?: string[]

  tasksToPersist: AgentTask[]
  currentTaskBeingProcessed?: AgentTask
  current_processing_batch?: AgentTask[]

  generatedQuestionSchemas: any[]
  settings?: Record<string, any>
  resultPageGenerationPrompt?: string
  journeyScript?: string

  errorDetails?: {
    node: string
    message: string
    originalError?: any
  }
  agentMessages: any[]

  iteration: number
  eventSequence: number // Added for managing event order
  _agentEvents?: AgentEvent[] // Added to carry events through state

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
  input: any,
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
    eventSequence: 0, // Initialize sequence
    _agentEvents: [], // Initialize as empty array
    resultPageGenerationPrompt: "",
  }
}
