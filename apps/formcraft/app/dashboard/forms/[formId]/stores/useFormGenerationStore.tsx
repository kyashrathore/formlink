import {
  AgentEvent,
  ErrorEvent,
  ProgressEvent,
  QuestionSchemaGeneratedEvent,
  StateSnapshotEvent,
  SystemEvent,
  type AgentState,
} from "@/app/lib/types/agent-events"
import { Form } from "@formlink/schema"
import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

interface FormGenerationState {
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
  generatedQuestions: any[]
  formMetadata: {
    title?: string
    description?: string
  } | null
  isFormGenerating: boolean
  questionProgress: {
    current: number
    total: number
  }
  hasFormMetadata: boolean
  hasFormJourney: boolean
  showQuestionsSection: boolean
  loadingPhase: "metadata" | "journey" | "questions" | "complete"
}

interface FormGenerationActions {
  initializeConnection: (formId: string) => void
  processEvent: (event: AgentEvent) => void
  resetStore: (keepFormId?: boolean) => void
  setInitialPrompt: (prompt: string | null) => void
  addGeneratedQuestion: (question: any) => void
  setFormMetadata: (metadata: { title?: string; description?: string }) => void
  setQuestionProgress: (current: number, total: number) => void
  setFormGenerating: (generating: boolean) => void
  resetGenerationState: () => void
}

const formGenerationStore: StateCreator<
  FormGenerationState & FormGenerationActions,
  [["zustand/immer", never]],
  [],
  FormGenerationState & FormGenerationActions
> = (set) => ({
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
  generatedQuestions: [],
  formMetadata: null,
  isFormGenerating: false,
  questionProgress: { current: 0, total: 0 },
  hasFormMetadata: false,
  hasFormJourney: false,
  showQuestionsSection: false,
  loadingPhase: "metadata",

  initializeConnection: (formId) => {
    set((state) => {
      if (
        (state.formId && state.formId !== formId) ||
        (state.currentForm && state.currentForm.id !== formId)
      ) {
        const newState = {
          ...state,
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
    })
  },

  processEvent: (event: AgentEvent) => {
    set((state) => {
      state.eventsLog.push(event)

      if (event.type === "question_schema_generated") {
        const questionEvent = event as QuestionSchemaGeneratedEvent
        const newQuestion = questionEvent.data.question
        const questionIndex = questionEvent.data.questionIndex

        // Initialize array with correct size if not already done
        if (
          state.generatedQuestions.length < questionEvent.data.totalQuestions
        ) {
          const newArray = new Array(questionEvent.data.totalQuestions).fill(
            null
          )
          // Copy existing questions to their correct positions
          state.generatedQuestions.forEach((q, idx) => {
            if (q) newArray[idx] = q
          })
          state.generatedQuestions = newArray
        }

        // Place question at correct index
        state.generatedQuestions[questionIndex] = newQuestion

        if (state.currentForm) {
          // Also maintain order in currentForm.questions
          if (
            state.currentForm.questions.length <
            questionEvent.data.totalQuestions
          ) {
            const newFormArray = new Array(
              questionEvent.data.totalQuestions
            ).fill(null)
            state.currentForm.questions.forEach((q, idx) => {
              if (q) newFormArray[idx] = q
            })
            state.currentForm.questions = newFormArray
          }
          state.currentForm.questions[questionIndex] = newQuestion
        }

        state.questionProgress = {
          current: questionEvent.data.questionIndex + 1,
          total: questionEvent.data.totalQuestions,
        }
        state.showQuestionsSection = true
        state.loadingPhase = "questions"
      }

      switch (event.category) {
        case "state":
          if (event.type === "state_snapshot") {
            const snapshotEvent = event as StateSnapshotEvent
            if (snapshotEvent.formId === state.formId) {
              state.currentForm = snapshotEvent.data.form
              state.agentState = snapshotEvent.data.agentState

              if (state.currentForm?.questions) {
                state.generatedQuestions = state.currentForm.questions
              }

              if (snapshotEvent.data.agentState.formMetadata) {
                state.formMetadata = snapshotEvent.data.agentState.formMetadata
                state.hasFormMetadata = true
                state.loadingPhase = "journey"
              }

              if (snapshotEvent.data.agentState.journeyScript) {
                state.hasFormJourney = true
                state.loadingPhase = "questions"
              }
            }
          }
          break
        case "progress":
          const progressEvent = event as ProgressEvent
          state.progress = progressEvent.data

          if (progressEvent.type === "task_completed") {
            state.completedTaskCount++

            if (
              progressEvent.data.taskType ===
              "metadata_and_task_list_generation"
            ) {
              state.hasFormMetadata = true
              state.loadingPhase = "journey"
            } else if (
              progressEvent.data.output &&
              typeof progressEvent.data.output === "object" &&
              (progressEvent.data.output as any)?.journeyScript
            ) {
              state.hasFormJourney = true
              state.loadingPhase = "questions"
            }
          }
          break
        case "error":
          state.errorDetails = (event as ErrorEvent).data
          break
        case "system":
          state.lastSystemEvent = event as SystemEvent

          if (event.type === "agent_initialized") {
            state.totalTaskCount = null
            state.completedTaskCount = 0
            state.questionTaskCount = null
            state.isFormGenerating = true
            state.generatedQuestions = []
            state.questionProgress = { current: 0, total: 0 }
            state.formMetadata = null
            state.hasFormMetadata = false
            state.hasFormJourney = false
            state.showQuestionsSection = false
            state.loadingPhase = "metadata"
          } else if (event.type === "agent_finalized") {
            state.isFormGenerating = false
            state.loadingPhase = "complete"
          } else if (
            event.type === "agent_warning" &&
            event.data.details &&
            typeof event.data.details === "object" &&
            (event.data.details as any)?.event_source ===
              "metadata_generator_task_list"
          ) {
            const details = event.data.details as any
            if (typeof details.taskCount === "number") {
              state.totalTaskCount = details.taskCount
            }
            if (typeof details.questionTaskCount === "number") {
              state.questionTaskCount = details.questionTaskCount
              state.questionProgress = {
                current: 0,
                total: details.questionTaskCount,
              }
            }
          }
          break
      }
    })
  },

  resetStore: (keepFormId = false) => {
    set((state) => ({
      ...state,
      formId: keepFormId ? state.formId : null,
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
      generatedQuestions: [],
      formMetadata: null,
      isFormGenerating: false,
      questionProgress: { current: 0, total: 0 },
      hasFormMetadata: false,
      hasFormJourney: false,
      showQuestionsSection: false,
      loadingPhase: "metadata",
    }))
  },

  setInitialPrompt: (prompt: string | null) => {
    set({ initialPrompt: prompt })
  },

  addGeneratedQuestion: (question: any) => {
    set((state) => ({
      ...state,
      generatedQuestions: [...state.generatedQuestions, question],
    }))
  },

  setFormMetadata: (metadata: { title?: string; description?: string }) => {
    set((state) => ({
      ...state,
      formMetadata: metadata,
      hasFormMetadata: true,
      loadingPhase: "journey",
    }))
  },

  setQuestionProgress: (current: number, total: number) => {
    set((state) => ({
      ...state,
      questionProgress: { current, total },
    }))
  },

  setFormGenerating: (generating: boolean) => {
    set((state) => ({
      ...state,
      isFormGenerating: generating,
    }))
  },

  resetGenerationState: () => {
    set((state) => ({
      ...state,
      generatedQuestions: [],
      formMetadata: null,
      isFormGenerating: false,
      questionProgress: { current: 0, total: 0 },
      hasFormMetadata: false,
      hasFormJourney: false,
      showQuestionsSection: false,
      loadingPhase: "metadata",
    }))
  },
})

export const useFormGenerationStore = create<
  FormGenerationState & FormGenerationActions
>()(
  persist(immer(formGenerationStore), {
    name: "form-generation-store",
    partialize: (state) => ({
      initialPrompt: state.initialPrompt,
      formId: state.formId,
    }),
  })
)
