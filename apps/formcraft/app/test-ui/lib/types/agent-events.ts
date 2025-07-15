import { Form } from "@formlink/schema"
import { nanoid } from "nanoid" // Added nanoid import
import { AgentState } from "../agent/state"

// Base event structure
export interface BaseAgentEvent {
  id: string
  type: string
  category: "progress" | "state" | "error" | "system"
  timestamp: string
  formId: string
  userId: string
  sequence: number
}

// Specific event types
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
    output?: any
  }
}

// Utility to create a specific event type with base properties
// Needs nanoid for ID generation. Ensure it's imported if not already.
// For now, assuming nanoid is available in the scope where this is used, or will be added.
// import { nanoid } from 'nanoid'; // Placeholder if direct import needed here

export function createAgentEvent<
  T extends AgentEvent["type"],
  C extends AgentEvent["category"],
  D extends AgentEvent["data"], // Ensure D matches the data structure for the given T and C
>(
  type: T,
  category: C,
  data: D,
  formId: string,
  userId: string,
  sequence: number,
  idGenerator: () => string = nanoid // Use nanoid as the default ID generator
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
  } as BaseAgentEvent & { type: T; category: C; data: D } // Cast to ensure type correctness
}

export interface StateSnapshotEvent extends BaseAgentEvent {
  category: "state"
  type: "state_snapshot"
  data: {
    form: Form // Complete form state from @formlink/schema
    agentState: AgentState // Complete agent state from ../agent/state
    isComplete: boolean
  }
}

export interface ErrorEvent extends BaseAgentEvent {
  category: "error"
  type: "agent_error"
  data: {
    message: string
    details?: any // For stack trace or other info
    recoverable: boolean
  }
}

export interface SystemEvent extends BaseAgentEvent {
  category: "system"
  type: "agent_initialized" | "agent_finalized" | "agent_warning"
  data: {
    message: string
    details?: any
  }
}

// Event for when a single question's schema is generated
export interface QuestionSchemaGeneratedEvent extends BaseAgentEvent {
  category: "progress"
  type: "question_schema_generated"
  data: {
    questionTitle: string
    questionIndex: number // 0-based index of the question
    totalQuestions: number // Total number of questions planned for generation
    message: string // e.g., "Generated schema for question 1/4: 'Overall Satisfaction'"
  }
}
