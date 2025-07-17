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
  currentForm: Form | null // Stores the latest complete form snapshot
  agentState: AgentState | null // Stores the latest complete agent state snapshot
  eventsLog: AgentEvent[] // Log of all structured events for UI or debugging

  progress: ProgressEvent["data"] | null // Current progress details
  errorDetails: ErrorEvent["data"] | null // Structured error details
  lastSystemEvent: SystemEvent | null // Last system event received
  totalTaskCount: number | null // To store the total number of tasks
  completedTaskCount: number // To store the count of completed tasks
  questionTaskCount: number | null // New property
  initialPrompt: string | null // Initial prompt to send to agent
}

interface FormAgentActions {
  initializeConnection: (formId: string) => void
  processEvent: (event: AgentEvent) => void // Changed signature
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
  questionTaskCount: null, // New initialization
  initialPrompt: null,
}

export const useFormAgentStore = create<FormAgentState & FormAgentActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      initializeConnection: (formId) => {
        set(
          (state) => {
            console.log("[AgentStore] initializeConnection called", {
              newFormId: formId,
              currentFormId: state.formId,
              hasCurrentForm: !!state.currentForm,
              currentFormHasJourneyScript:
                !!state.currentForm?.settings?.journeyScript,
              willReset: state.formId && state.formId !== formId,
            })

            // If we're initializing for a different form OR if we have stale form data, clear everything
            if (
              (state.formId && state.formId !== formId) ||
              (state.currentForm && state.currentForm.id !== formId)
            ) {
              console.log(
                "[AgentStore] Resetting store for new form or clearing stale data"
              )
              const newState = {
                ...initialState,
                formId,
                connectionStatus: "connecting",
                agentStreamConnectionStatus: "requested", // Or "connecting"
              }
              console.log("[AgentStore] New state after reset:", {
                formId: newState.formId,
                hasCurrentForm: !!newState.currentForm,
                currentFormIsNull: newState.currentForm === null,
              })
              return newState
            }
            // Same form, just update connection status
            console.log(
              "[AgentStore] Same form, updating connection status only"
            )
            return {
              ...state,
              formId,
              connectionStatus: "connecting",
              agentStreamConnectionStatus: "requested", // Or "connecting"
            }
          },
          false, // Changed from undefined to false for 'replace' behavior
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
            let newCompletedTaskCount = state.completedTaskCount // Initialize newCompletedTaskCount
            let newQuestionTaskCount = state.questionTaskCount // Add this

            // Processing event
            switch (event.category) {
              case "state":
                if (event.type === "state_snapshot") {
                  const snapshotEvent = event as StateSnapshotEvent
                  console.log("[AgentStore] State snapshot received:", {
                    eventFormId: snapshotEvent.formId,
                    stateFormId: state.formId,
                    formIdMatch: snapshotEvent.formId === state.formId,
                    hasJourneyScript:
                      !!snapshotEvent.data.form?.settings?.journeyScript,
                    journeyScriptPreview:
                      snapshotEvent.data.form?.settings?.journeyScript?.substring(
                        0,
                        50
                      ) + "...",
                  })

                  // Only update if this event is for the current form
                  if (snapshotEvent.formId === state.formId) {
                    newCurrentForm = snapshotEvent.data.form
                    newAgentState = snapshotEvent.data.agentState
                    console.log(
                      "[AgentStore] Applied state snapshot for current form"
                    )
                  } else {
                    console.log(
                      "[AgentStore] Ignoring state snapshot for different form"
                    )
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
                  newTotalTaskCount = null // Reset task count on new initialization
                  newCompletedTaskCount = 0 // Reset completed task count
                  newQuestionTaskCount = null // Reset question task count
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
                    // Add this for questionTaskCount
                    newQuestionTaskCount = event.data.details.questionTaskCount
                  }
                }
                break
            }

            return {
              ...state, // Preserve other parts of state like formId
              eventsLog: newEventsLog,
              currentForm: newCurrentForm,
              agentState: newAgentState,
              progress: newProgress,
              errorDetails: newErrorDetails,
              lastSystemEvent: newLastSystemEvent,
              totalTaskCount: newTotalTaskCount,
              completedTaskCount: newCompletedTaskCount, // Return updated completedTaskCount
              questionTaskCount: newQuestionTaskCount, // Add this
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

      // Removed chat-specific actions as per "no message event from agent anymore is needed"
      // setInitialChatMessages, addUserMessageToChat
    }),
    { name: "FormAgentStore" }
  )
)
