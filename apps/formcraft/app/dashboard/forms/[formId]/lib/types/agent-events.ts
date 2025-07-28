import { Form } from "@formlink/schema"
import { nanoid } from "nanoid"
import { AgentState } from "../../../../../lib/types/agent-events"

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
