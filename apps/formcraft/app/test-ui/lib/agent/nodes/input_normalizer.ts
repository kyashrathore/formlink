import { BaseMessage } from "@langchain/core/messages"
import { RunnableConfig } from "@langchain/core/runnables"
import { AgentEvent, createAgentEvent } from "../../types/agent-events"
import { AgentState } from "../state"
import { buildFormFromState } from "../utils/form-builder"

const NODE_NAME = "normalizeInputNode"

interface InputNormalizationResult {
  normalizedContent: string
  errorDetails?: {
    node: string
    message: string
    originalError?: any
  }
  status: AgentState["status"]
}

function normalizePromptInput(originalInput: any): InputNormalizationResult {
  if (typeof originalInput === "string") {
    return {
      normalizedContent: originalInput,
      status: "PROCESSING",
    }
  }

  const errorMessage = "Original input for prompt type is not a string."
  return {
    normalizedContent: "",
    errorDetails: {
      node: NODE_NAME,
      message: errorMessage,
    },
    status: "FAILED",
  }
}

function normalizeUrlInput(originalInput: any): InputNormalizationResult {
  const errorMessage = "URL input processing is not yet implemented."
  return {
    normalizedContent: "",
    errorDetails: {
      node: NODE_NAME,
      message: errorMessage,
    },
    status: "FAILED",
  }
}

function normalizeHtmlInput(originalInput: any): InputNormalizationResult {
  const errorMessage = "HTML input processing is not yet implemented."
  return {
    normalizedContent: "",
    errorDetails: {
      node: NODE_NAME,
      message: errorMessage,
    },
    status: "FAILED",
  }
}

function normalizeInput(
  inputType: AgentState["inputType"],
  originalInput: any
): InputNormalizationResult {
  switch (inputType) {
    case "prompt":
      return normalizePromptInput(originalInput)
    case "url":
      return normalizeUrlInput(originalInput)
    case "html":
      return normalizeHtmlInput(originalInput)
    default:
      const errorMessage = `Unknown input type: ${inputType}`
      return {
        normalizedContent: "",
        errorDetails: {
          node: NODE_NAME,
          message: errorMessage,
        },
        status: "FAILED",
      }
  }
}

function createNormalizationEvents(
  result: InputNormalizationResult,
  inputType: AgentState["inputType"],
  formId: string,
  userId: string,
  currentSequence: number
): AgentEvent[] {
  const events: AgentEvent[] = []

  if (result.errorDetails) {
    events.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: `Input normalization failed: ${result.errorDetails.message}`,
          details: result.errorDetails.originalError,
          recoverable: false,
        },
        formId,
        userId,
        currentSequence++
      )
    )
  } else {
    events.push(
      createAgentEvent(
        "agent_warning",
        "system",
        {
          message: `Input successfully normalized. Type: ${inputType}`,
          details: {
            inputType,
            normalizedContentPreview: result.normalizedContent?.substring(
              0,
              100
            ),
          },
        },
        formId,
        userId,
        currentSequence++
      )
    )
  }

  return events
}

function createStateSnapshot(
  state: AgentState,
  result: InputNormalizationResult,
  messages: BaseMessage[],
  formId: string,
  userId: string,
  currentSequence: number
): AgentEvent {
  const updatedState = {
    ...state,
    agentMessages: messages,
    normalizedInputContent: result.normalizedContent,
    errorDetails: result.errorDetails ?? state.errorDetails,
    status: result.status,
  }

  const { _agentEvents, ...stateForSnapshot } = updatedState

  return createAgentEvent(
    "state_snapshot",
    "state",
    {
      form: buildFormFromState(stateForSnapshot),
      agentState: stateForSnapshot,
      isComplete: result.status === "FAILED",
    },
    formId,
    userId,
    currentSequence
  )
}

export async function normalizeInputNode(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  const _agentEvents: AgentEvent[] = []
  let currentEventSequence = state.eventSequence
  const messages: BaseMessage[] = [...(state.agentMessages ?? [])]

  const result = normalizeInput(state.inputType, state.originalInput)

  const normalizationEvents = createNormalizationEvents(
    result,
    state.inputType,
    state.formId,
    state.userId,
    currentEventSequence
  )
  _agentEvents.push(...normalizationEvents)
  currentEventSequence += normalizationEvents.length

  const stateSnapshot = createStateSnapshot(
    state,
    result,
    messages,
    state.formId,
    state.userId,
    currentEventSequence++
  )
  _agentEvents.push(stateSnapshot)

  return {
    agentMessages: messages,
    normalizedInputContent: result.normalizedContent,
    errorDetails: result.errorDetails ?? state.errorDetails,
    status: result.status,
    _agentEvents,
    eventSequence: currentEventSequence,
  }
}
