/**
 * Simplified form generation bridge - now directly uses the main store
 */

import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import type { AgentEvent } from "@/app/lib/types/agent-events"
import { useFormGenerationStore } from "@/app/stores/formGenerationStore"
import { useCallback, useEffect, useRef } from "react"
import { useFormGenerationEventBridge } from "./useFormGenerationEventBridge"

/**
 * Form generation state interface
 */
export interface FormGenerationState {
  // State
  isGenerating: boolean
  currentPhase: string
  formId: string

  // Data
  metadata: {
    title?: string
    description?: string
  } | null
  journeyScript: string | null
  questions: any[]
  questionProgress: {
    current: number
    total: number
  } | null

  // Status
  hasMetadata: boolean
  hasJourney: boolean
  hasQuestions: boolean
  error: string | null
}

/**
 * Simplified bridge hook that returns the form generation state
 */
export function useFormGenerationBridge() {
  const store = useFormGenerationStore()
  const { bridgeEvent } = useFormGenerationEventBridge()

  // Event handler
  const eventHandlerRef = useRef<FormGenerationEventHandler>()

  useEffect(() => {
    eventHandlerRef.current = new FormGenerationEventHandler(store)
  }, [store])

  // Handle events
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      if (eventHandlerRef.current) {
        eventHandlerRef.current.handleRawEvent(event)
      }
      bridgeEvent(event)
    },
    [bridgeEvent]
  )

  // Create state interface
  const state: FormGenerationState = {
    isGenerating: store.isGenerating(),
    currentPhase: store.overallStatus,
    formId: store.formId,

    metadata: store.metadata.data,
    journeyScript: store.journey.data,
    questions: store.questions.items,
    questionProgress: store.getProgress(),

    hasMetadata: store.metadata.status === "success",
    hasJourney: store.journey.status === "success",
    hasQuestions: store.questions.items.length > 0,
    error:
      store.metadata.error?.message ||
      store.journey.error?.message ||
      store.questions.error?.message ||
      null,
  }

  // Actions
  const actions = {
    handleEvent,
    reset: store.reset,
    retrySection: (section: "metadata" | "journey" | "questions") =>
      store.retrySection(section),
  }

  return {
    ...state,
    ...actions,
  }
}

/**
 * Hook to get loading states for each section
 */
export function useFormGenerationLoadingStates() {
  const store = useFormGenerationStore()

  return {
    metadata: {
      isLoading: store.metadata.status === "loading",
      isSuccess: store.metadata.status === "success",
      isError: store.metadata.status === "error",
    },
    journey: {
      isLoading: store.journey.status === "loading",
      isSuccess: store.journey.status === "success",
      isError: store.journey.status === "error",
    },
    questions: {
      isLoading: store.questions.status === "loading",
      isSuccess: store.questions.status === "success",
      isError: store.questions.status === "error",
    },
  }
}
