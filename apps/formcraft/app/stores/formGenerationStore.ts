/**
 * New Form Generation Store with async data handling
 * Implements the architecture from FORM_GENERATION_ARCHITECTURE_REWRITE_v1.md
 */

import {
  AsyncCollection,
  AsyncData,
  createAsyncCollection,
  createAsyncData,
} from "@/app/lib/types/async-data"
import { Question } from "@formlink/schema"
import { create, StateCreator } from "zustand"
import {
  createJSONStorage,
  devtools,
  persist,
  PersistOptions,
} from "zustand/middleware"

// Form metadata type
export interface FormMetadata {
  title: string
  description: string
  category?: string
  tags?: string[]
}

// Main state structure
export interface FormGenerationState {
  formId: string
  startedAt: Date | null
  completedAt: Date | null

  // Each section manages its own state
  metadata: AsyncData<FormMetadata>
  journey: AsyncData<string>
  questions: AsyncCollection<Question> & {
    generatedCount: number
    progressStatus: "idle" | "loading" | "success" | "error"
  }

  // Overall status derived from individual sections
  overallStatus: "idle" | "generating" | "complete" | "error"
}

// Store actions
export interface FormGenerationActions {
  // Core actions
  startGeneration: (formId: string) => void
  updateMetadata: (metadata: Partial<FormMetadata>) => void
  setJourneyScript: (script: string) => void
  addQuestion: (question: Question, index: number) => void
  setQuestionTotal: (total: number) => void
  setError: (
    section: "metadata" | "journey" | "questions",
    error: Error
  ) => void
  reset: () => void
  completeGeneration: () => void

  // Retry actions
  retrySection: (section: "metadata" | "journey" | "questions") => void

  // Computed values
  isGenerating: () => boolean
  hasAllData: () => boolean
  getProgress: () => { current: number; total: number } | null
}

// Combined store type
export type FormGenerationStore = FormGenerationState & FormGenerationActions

// Initial state
const initialState: FormGenerationState = {
  formId: "",
  startedAt: null,
  completedAt: null,
  metadata: createAsyncData<FormMetadata>(),
  journey: createAsyncData<string>(),
  questions: {
    ...createAsyncCollection<Question>(),
    generatedCount: 0,
    progressStatus: "idle",
  },
  overallStatus: "idle",
}

// Environment-aware logging
const isDevelopment = process.env.NODE_ENV === "development"

const storeCreator: StateCreator<FormGenerationStore> = (set, get) => ({
  ...initialState,

  // Core actions
  startGeneration: (formId) => {
    set({
      formId,
      startedAt: new Date(),
      completedAt: null,
      overallStatus: "generating",
      metadata: { ...createAsyncData<FormMetadata>(), status: "loading" },
      journey: { ...createAsyncData<string>(), status: "loading" },
      questions: {
        ...createAsyncCollection<Question>(),
        status: "loading",
        progressStatus: "loading",
        generatedCount: 0,
      },
    })
  },

  updateMetadata: (metadata) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        status: "success",
        data: { ...state.metadata.data, ...metadata } as FormMetadata,
        error: null,
        lastUpdated: new Date(),
        retryCount: 0,
        canRetry: true,
      },
    }))
  },

  setJourneyScript: (script) => {
    set({
      journey: {
        status: "success",
        data: script,
        error: null,
        lastUpdated: new Date(),
        retryCount: 0,
        canRetry: true,
      },
    })
  },

  addQuestion: (question, index) => {
    set((state) => {
      const newItems = [...state.questions.items]

      // Ensure array is large enough
      while (newItems.length <= index) {
        newItems.push(null as any)
      }

      newItems[index] = question

      // Count non-null questions
      const generatedCount = newItems.filter((q) => q !== null).length

      return {
        questions: {
          ...state.questions,
          items: newItems,
          generatedCount,
        },
      }
    })
  },

  setQuestionTotal: (total) => {
    set((state) => ({
      questions: {
        ...state.questions,
        total,
        progressStatus: "success",
      },
    }))
  },

  setError: (section, error) => {
    const currentSection = get()[section]
    const retryCount = (currentSection as any).retryCount || 0

    set({
      [section]: {
        ...currentSection,
        status: "error" as const,
        error,
        retryCount: retryCount + 1,
        canRetry: retryCount < 3,
      },
      overallStatus: "error",
    })
  },

  reset: () => {
    set(initialState)
  },

  // Retry actions
  retrySection: (section) => {
    const currentSection = get()[section]
    if ((currentSection as any).canRetry) {
      set({
        [section]: {
          ...currentSection,
          status: "loading" as const,
          error: null,
        },
        overallStatus: "generating",
      })
    }
  },

  // Computed values
  isGenerating: () => {
    const state = get()
    return state.overallStatus === "generating"
  },

  hasAllData: () => {
    const state = get()
    return (
      state.metadata.status === "success" &&
      state.journey.status === "success" &&
      state.questions.status === "success"
    )
  },

  getProgress: () => {
    const state = get()
    if (state.questions.progressStatus === "success" && state.questions.total) {
      return {
        current: state.questions.generatedCount,
        total: state.questions.total,
      }
    }
    return null
  },

  completeGeneration: () => {
    set((state) => ({
      ...state,
      questions: {
        ...state.questions,
        status: "success",
      },
      overallStatus: "complete",
      completedAt: new Date(),
    }))
  },
})

const persistOptions: PersistOptions<FormGenerationStore> = {
  name: "form-generation-storage",
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => {
    const { ...rest } = state
    return rest as FormGenerationStore
  },
  version: 1,
  migrate: (persistedState: any) => {
    // Handle future schema migrations
    return persistedState
  },
}

// Create the store
export const useFormGenerationStore = create<FormGenerationStore>()(
  devtools(persist(storeCreator, persistOptions), {
    name: "FormGenerationStore",
    enabled: isDevelopment,
  })
)

// Selector hooks for optimized subscriptions
export const useFormGenerationMetadata = () =>
  useFormGenerationStore((state) => state.metadata)
export const useFormGenerationJourney = () =>
  useFormGenerationStore((state) => state.journey)
export const useFormGenerationQuestions = () =>
  useFormGenerationStore((state) => state.questions)
export const useFormGenerationProgress = () =>
  useFormGenerationStore((state) => state.getProgress())
export const useIsGenerating = () =>
  useFormGenerationStore((state) => state.isGenerating())
