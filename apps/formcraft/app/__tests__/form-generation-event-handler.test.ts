/**
 * Tests for Form Generation Event Handler
 */

import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import { useFormGenerationStore } from "@/app/stores/formGenerationStore"
import { act, renderHook } from "@testing-library/react"
import { isFeatureEnabled } from "../lib/feature-flags"

// Mock feature flags
jest.mock("@/app/lib/feature-flags", () => ({
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}))

// Mock analytics
global.window = {
  analytics: {
    track: jest.fn(),
  },
} as any

describe("FormGenerationEventHandler", () => {
  let handler: FormGenerationEventHandler
  let store: any

  beforeEach(() => {
    const { result } = renderHook(() => useFormGenerationStore())
    store = result.current
    handler = new FormGenerationEventHandler(store)

    act(() => {
      store.reset()
    })
  })

  describe("Event Validation", () => {
    it("should reject invalid events", async () => {
      const invalidEvent = {
        type: "unknown_event",
        data: {},
      }

      await handler.handleRawEvent(invalidEvent)

      // Store should remain in initial state
      expect(store.overallStatus).toBe("idle")
    })

    it("should process valid events", async () => {
      const validEvent = {
        type: "agent_initialized",
        formId: "test-123",
      }

      await handler.handleRawEvent(validEvent)

      expect(store.formId).toBe("test-123")
      expect(store.overallStatus).toBe("generating")
    })
  })

  describe("Agent Initialized", () => {
    it("should start generation on agent_initialized", async () => {
      await handler.handleRawEvent({
        type: "agent_initialized",
        formId: "form-123",
      })

      expect(store.formId).toBe("form-123")
      expect(store.metadata.status).toBe("loading")
      expect(store.journey.status).toBe("loading")
      expect(store.questions.status).toBe("loading")
    })
  })

  describe("State Snapshot", () => {
    it("should extract metadata from state snapshot", async () => {
      await handler.handleRawEvent({
        type: "state_snapshot",
        formId: "form-123",
        data: {
          agentState: {
            formMetadata: {
              title: "Test Form",
              description: "Test Description",
            },
          },
        },
      })

      expect(store.metadata.status).toBe("success")
      expect(store.metadata.data).toEqual({
        title: "Test Form",
        description: "Test Description",
      })
    })

    it("should extract journey from root location", async () => {
      await handler.handleRawEvent({
        type: "state_snapshot",
        formId: "form-123",
        data: {
          agentState: {
            journeyScript: "Root journey script",
          },
        },
      })

      expect(store.journey.status).toBe("success")
      expect(store.journey.data).toBe("Root journey script")
    })

    it("should extract journey from settings location", async () => {
      await handler.handleRawEvent({
        type: "state_snapshot",
        formId: "form-123",
        data: {
          agentState: {
            settings: {
              journeyScript: "Settings journey script",
            },
          },
        },
      })

      expect(store.journey.status).toBe("success")
      expect(store.journey.data).toBe("Settings journey script")
    })

    it("should validate metadata before updating", async () => {
      await handler.handleRawEvent({
        type: "state_snapshot",
        formId: "form-123",
        data: {
          agentState: {
            formMetadata: {
              title: "", // Invalid - empty title
              description: "Test",
            },
          },
        },
      })

      // Should not update with invalid data
      expect(store.metadata.status).toBe("idle")
    })
  })

  describe("Question Generation", () => {
    it("should add validated questions", async () => {
      const question = {
        id: "q1",
        title: "What is your name?",
        type: "text",
        required: true,
        order: 0,
      }

      await handler.handleRawEvent({
        type: "question_schema_generated",
        data: {
          question,
          questionIndex: 0,
          totalQuestions: 3,
        },
      })

      expect(store.questions.items).toHaveLength(1)
      expect(store.questions.items[0]).toMatchObject(question)
      expect(store.questions.total).toBe(3)
    })

    it("should validate questions before adding", async () => {
      await handler.handleRawEvent({
        type: "question_schema_generated",
        data: {
          question: {
            // Missing required fields
            title: "Invalid Question",
          },
          questionIndex: 0,
        },
      })

      expect(store.questions.items).toHaveLength(0)
    })
  })

  describe("Agent Warning", () => {
    it("should extract question count from warnings", async () => {
      await handler.handleRawEvent({
        type: "agent_warning",
        data: {
          message: "Starting generation",
          details: {
            event_source: "metadata_generator_task_list",
            questionTaskCount: 5,
          },
        },
      })

      expect(store.questions.total).toBe(5)
    })
  })

  describe("Error Handling", () => {
    it("should set error on metadata section", async () => {
      await handler.handleRawEvent({
        type: "agent_error",
        data: {
          message: "Failed to generate metadata",
          section: "metadata",
        },
      })

      expect(store.metadata.status).toBe("error")
      expect(store.metadata.error?.message).toBe("Failed to generate metadata")
    })

    it("should infer section from error message", async () => {
      await handler.handleRawEvent({
        type: "agent_error",
        data: {
          message: "Journey generation failed",
        },
      })

      expect(store.journey.status).toBe("error")
    })
  })

  describe("Agent Finalized", () => {
    it("should mark generation as complete", async () => {
      // Set up some initial state
      act(() => {
        store.startGeneration("form-123")
      })

      await handler.handleRawEvent({
        type: "agent_finalized",
        formId: "form-123",
      })

      expect(store.overallStatus).toBe("complete")
      expect(store.completedAt).toBeInstanceOf(Date)
    })
  })

  describe("Event Buffering", () => {
    it("should buffer events", async () => {
      await handler.handleRawEvent({
        type: "agent_initialized",
        formId: "test-1",
      })

      await handler.handleRawEvent({
        type: "agent_initialized",
        formId: "test-2",
      })

      const buffer = handler.getEventBuffer()
      expect(buffer).toHaveLength(2)
    })

    it("should limit buffer size", async () => {
      // Add 101 events
      for (let i = 0; i < 101; i++) {
        await handler.handleRawEvent({
          type: "agent_initialized",
          formId: `test-${i}`,
        })
      }

      const buffer = handler.getEventBuffer()
      expect(buffer).toHaveLength(100)
      expect(buffer[0].formId).toBe("test-1") // First event should be removed
    })

    it("should clear buffer", async () => {
      await handler.handleRawEvent({
        type: "agent_initialized",
        formId: "test",
      })

      expect(handler.getEventBuffer()).toHaveLength(1)

      handler.clearEventBuffer()
      expect(handler.getEventBuffer()).toHaveLength(0)
    })
  })

  describe("Analytics Tracking", () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("should track generation started", async () => {
      // Enable analytics for this test
      isFeatureEnabled.mockReturnValue(true)

      await handler.handleRawEvent({
        type: "agent_initialized",
        formId: "form-123",
      })

      expect(window.analytics.track).toHaveBeenCalledWith(
        "form_generation_generation_started",
        expect.objectContaining({
          formId: "form-123",
        })
      )
    })
  })
})
