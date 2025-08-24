/**
 * Event handler for form generation with validation and error handling
 */

import {
  AgentEvent,
  validateEvent,
  validateFormMetadata,
  validateQuestion,
} from "@/app/lib/validation/form-generation-schemas"
import { useFormGenerationStore } from "@/app/stores/formGenerationStore"
import { Question } from "@formlink/schema"

// Logger class for structured logging
class Logger {
  private isDev = process.env.NODE_ENV === "development"

  log(level: "info" | "warn" | "error", message: string, data?: any) {
    if (this.isDev) {
      // eslint-disable-next-line no-console
      console[level](`[FormGen] ${message}`, data)
    } else {
      // Send to telemetry service in production
      if (typeof window !== "undefined" && (window as any).analytics) {
        ;(window as any).analytics.track("form_generation_event", {
          level,
          message,
          timestamp: new Date().toISOString(),
          ...data,
        })
      }
    }
  }
}

export class FormGenerationEventHandler {
  private logger: Logger
  private eventBuffer: AgentEvent[] = []
  private isProcessing = false

  constructor() {
    this.logger = new Logger()
  }

  /**
   * Handle raw event from SSE stream
   */
  async handleRawEvent(rawEvent: unknown) {
    // Validate event
    const event = validateEvent(rawEvent)
    if (!event) {
      this.logger.log("warn", "Invalid event received", { rawEvent })
      return
    }

    // Add to buffer for potential offline/retry scenarios
    this.eventBuffer.push(event)
    if (this.eventBuffer.length > 100) {
      // Keep buffer size reasonable
      this.eventBuffer.shift()
    }

    // Process event
    await this.processEvent(event)
  }

  /**
   * Process validated event
   */
  private async processEvent(event: AgentEvent) {
    if (this.isProcessing) {
      // Queue event if already processing
      setTimeout(() => this.processEvent(event), 100)
      return
    }

    this.isProcessing = true
    this.logger.log("info", `Processing event: ${event.type}`, { event })

    try {
      switch (event.type) {
        case "agent_initialized":
          this.handleAgentInitialized(
            event as Extract<AgentEvent, { type: "agent_initialized" }>
          )
          break

        case "state_snapshot":
          this.handleStateSnapshot(
            event as Extract<AgentEvent, { type: "state_snapshot" }>
          )
          break

        case "question_schema_generated":
          this.handleQuestionGenerated(
            event as Extract<AgentEvent, { type: "question_schema_generated" }>
          )
          break

        case "agent_warning":
          this.handleAgentWarning(
            event as Extract<AgentEvent, { type: "agent_warning" }>
          )
          break

        case "agent_error":
          this.handleAgentError(
            event as Extract<AgentEvent, { type: "agent_error" }>
          )
          break

        case "agent_finalized":
          this.handleAgentFinalized(
            event as Extract<AgentEvent, { type: "agent_finalized" }>
          )
          break
      }
    } catch (error) {
      this.logger.log("error", `Error processing event ${event.type}`, {
        error,
        event,
      })
      useFormGenerationStore
        .getState()
        .setError("metadata", new Error(`Failed to process ${event.type}`))
    } finally {
      this.isProcessing = false
    }
  }

  private handleAgentInitialized(
    event: Extract<AgentEvent, { type: "agent_initialized" }>
  ) {
    useFormGenerationStore.getState().startGeneration(event.formId)
    this.trackAnalytics("generation_started", { formId: event.formId })
  }

  private handleStateSnapshot(
    event: Extract<AgentEvent, { type: "state_snapshot" }>
  ) {
    const { agentState } = event.data

    // Extract and validate metadata
    if (agentState?.formMetadata) {
      const metadata = validateFormMetadata(agentState.formMetadata)
      if (metadata) {
        useFormGenerationStore.getState().updateMetadata(metadata)
        this.trackAnalytics("metadata_received", {
          hasTitle: !!metadata.title,
          hasDescription: !!metadata.description,
        })
      }
    }

    // Extract journey script from either location
    const journeyScript =
      agentState?.journeyScript || agentState?.settings?.journeyScript
    if (
      journeyScript &&
      typeof journeyScript === "string" &&
      journeyScript.trim()
    ) {
      useFormGenerationStore.getState().setJourneyScript(journeyScript)
      this.trackAnalytics("journey_received", {
        length: journeyScript.length,
      })
    }
  }

  private handleQuestionGenerated(
    event: Extract<AgentEvent, { type: "question_schema_generated" }>
  ) {
    const { question, questionIndex } = event.data

    const validatedQuestion = validateQuestion(question)
    if (validatedQuestion) {
      useFormGenerationStore
        .getState()
        .addQuestion(
          validatedQuestion as unknown as Question,
          questionIndex as number
        )

      // Update total if provided
      if (event.data.totalQuestions) {
        useFormGenerationStore
          .getState()
          .setQuestionTotal(event.data.totalQuestions as number)
      }

      this.trackAnalytics("question_generated", {
        index: questionIndex,
        type: validatedQuestion.type,
        required: validatedQuestion.required,
      })
    }
  }

  private handleAgentWarning(
    event: Extract<AgentEvent, { type: "agent_warning" }>
  ) {
    const { details } = event.data

    // Check for question count in metadata generator
    if (
      details &&
      typeof details === "object" &&
      (details as any).event_source === "metadata_generator_task_list"
    ) {
      const count = (details as any).questionTaskCount
      if (typeof count === "number") {
        useFormGenerationStore.getState().setQuestionTotal(count)
        this.trackAnalytics("question_count_received", { count })
      }
    }

    this.logger.log("warn", "Agent warning", event.data)
  }

  private handleAgentError(
    event: Extract<AgentEvent, { type: "agent_error" }>
  ) {
    const { message, section } = event.data
    const error = new Error(message)

    // Determine affected section
    let targetSection: "metadata" | "journey" | "questions" = "metadata"

    if (section) {
      targetSection = section
    } else if (message.toLowerCase().includes("journey")) {
      targetSection = "journey"
    } else if (message.toLowerCase().includes("question")) {
      targetSection = "questions"
    }

    useFormGenerationStore.getState().setError(targetSection, error)
    this.trackAnalytics("generation_error", {
      section: targetSection,
      message,
    })
  }

  private handleAgentFinalized(
    event: Extract<AgentEvent, { type: "agent_finalized" }>
  ) {
    // Mark generation as complete
    useFormGenerationStore.getState().completeGeneration()

    const state = useFormGenerationStore.getState()
    this.trackAnalytics("generation_completed", {
      formId: event.formId,
      duration: state.startedAt ? Date.now() - state.startedAt.getTime() : null,
      questionCount: state.questions.items.length,
    })
  }

  /**
   * Retry a specific section
   */
  async retrySection(section: "metadata" | "journey" | "questions") {
    this.logger.log("info", `Retrying section: ${section}`)

    // This would trigger the appropriate backend call
    // For now, just log the retry attempt
    this.trackAnalytics("section_retry", { section })
  }

  /**
   * Track analytics events
   */
  private trackAnalytics(eventName: string, data?: Record<string, any>) {
    if (typeof window !== "undefined" && (window as any).analytics) {
      const state = useFormGenerationStore.getState()
      ;(window as any).analytics.track(`form_generation_${eventName}`, {
        formId: state.formId,
        timestamp: new Date().toISOString(),
        ...data,
      })
    }
  }

  /**
   * Get buffered events (useful for debugging)
   */
  getEventBuffer(): AgentEvent[] {
    return [...this.eventBuffer]
  }

  /**
   * Clear event buffer
   */
  clearEventBuffer() {
    this.eventBuffer = []
  }
}
