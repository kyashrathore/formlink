import { Form } from "@formlink/schema"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { type AgentState } from "../lib/agent/state"
import {
  AgentEvent,
  ErrorEvent,
  ProgressEvent,
  StateSnapshotEvent,
  SystemEvent,
} from "../lib/types/agent-events"

interface FormAgentState {
  formId: string | null
  currentForm: Form | null
  agentState: AgentState | null
  eventsLog: AgentEvent[]

  progress: ProgressEvent["data"] | null
  errorDetails: ErrorEvent["data"] | null
  lastSystemEvent: SystemEvent | null
  totalTaskCount: number | null
  completedTaskCount: number
  questionTaskCount: number | null
  initialPrompt: string | null
}

interface FormAgentActions {
  initializeConnection: (formId: string) => void
  processEvent: (event: AgentEvent) => void
  resetStore: (keepFormId?: boolean) => void
  setInitialPrompt: (prompt: string | null) => void
}

const initialState: FormAgentState = {
  formId: null,
  currentForm: null,
  agentState: null,
  eventsLog: [],
  progress: null,
  errorDetails: null,
  lastSystemEvent: null,
  totalTaskCount: null,
  completedTaskCount: 0,
  questionTaskCount: null,
  initialPrompt: null,
}

export const useFormAgentStore = create<FormAgentState & FormAgentActions>()(
  devtools(
    (set) => ({
      ...initialState,

      initializeConnection: (formId) => {
        set(
          (state) => {
            if (
              (state.formId && state.formId !== formId) ||
              (state.currentForm && state.currentForm.id !== formId)
            ) {
              const newState = {
                ...initialState,
                formId,
                connectionStatus: "connecting",
                agentStreamConnectionStatus: "requested",
              }
              return newState
            }

            return {
              ...state,
              formId,
              connectionStatus: "connecting",
              agentStreamConnectionStatus: "requested",
            }
          },
          false,
          "initializeConnection"
        )
      },

      processEvent: (event: AgentEvent) => {
        set(
          (state) => {
            const newEventsLog = [...state.eventsLog, event]
            let newCurrentForm = state.currentForm
            let newAgentState = state.agentState
            let newProgress = state.progress
            let newErrorDetails = state.errorDetails
            let newLastSystemEvent = state.lastSystemEvent
            let newTotalTaskCount = state.totalTaskCount
            let newCompletedTaskCount = state.completedTaskCount
            let newQuestionTaskCount = state.questionTaskCount

            switch (event.category) {
              case "state":
                if (event.type === "state_snapshot") {
                  const snapshotEvent = event as StateSnapshotEvent

                  if (snapshotEvent.formId === state.formId) {
                    newCurrentForm = snapshotEvent.data.form
                    newAgentState = snapshotEvent.data.agentState
                  }
                }
                break
              case "progress":
                const progressEvent = event as ProgressEvent
                newProgress = progressEvent.data
                if (progressEvent.type === "task_completed") {
                  newCompletedTaskCount = state.completedTaskCount + 1
                }
                break
              case "error":
                newErrorDetails = (event as ErrorEvent).data
                break
              case "system":
                newLastSystemEvent = event as SystemEvent
                if (event.type === "agent_initialized") {
                  newTotalTaskCount = null
                  newCompletedTaskCount = 0
                  newQuestionTaskCount = null
                } else if (event.type === "agent_finalized") {
                } else if (
                  event.type === "agent_warning" &&
                  event.data.details?.event_source ===
                    "metadata_generator_task_list"
                ) {
                  if (typeof event.data.details.taskCount === "number") {
                    newTotalTaskCount = event.data.details.taskCount
                  }
                  if (
                    typeof event.data.details.questionTaskCount === "number"
                  ) {
                    newQuestionTaskCount = event.data.details.questionTaskCount
                  }
                }
                break
            }

            return {
              ...state,
              eventsLog: newEventsLog,
              currentForm: newCurrentForm,
              agentState: newAgentState,
              progress: newProgress,
              errorDetails: newErrorDetails,
              lastSystemEvent: newLastSystemEvent,
              totalTaskCount: newTotalTaskCount,
              completedTaskCount: newCompletedTaskCount,
              questionTaskCount: newQuestionTaskCount,
            }
          },
          false,
          `processEvent/${event.category}/${event.type}`
        )
      },

      resetStore: (keepFormId = false) => {
        set(
          (state) => ({
            ...initialState,
            formId: keepFormId ? state.formId : null,
          }),
          false,
          "resetStore"
        )
      },

      setInitialPrompt: (prompt: string | null) => {
        set({ initialPrompt: prompt }, false, "setInitialPrompt")
      },
    }),
    { name: "FormAgentStore" }
  )
)
