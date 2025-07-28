/**
 * Tests for the new Form Generation Store
 */

import { useFormGenerationStore } from "@/app/stores/formGenerationStore"
import { act, renderHook } from "@testing-library/react"

// Mock feature flags
jest.mock("@/app/lib/feature-flags", () => ({
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}))

describe("FormGenerationStore", () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useFormGenerationStore())
    act(() => {
      result.current.reset()
    })
  })

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      expect(result.current.formId).toBe("")
      expect(result.current.startedAt).toBeNull()
      expect(result.current.completedAt).toBeNull()
      expect(result.current.metadata.status).toBe("idle")
      expect(result.current.journey.status).toBe("idle")
      expect(result.current.questions.status).toBe("idle")
      expect(result.current.overallStatus).toBe("idle")
    })
  })

  describe("Start Generation", () => {
    it("should initialize all sections to loading", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      act(() => {
        result.current.startGeneration("test-form-123")
      })

      expect(result.current.formId).toBe("test-form-123")
      expect(result.current.startedAt).toBeInstanceOf(Date)
      expect(result.current.metadata.status).toBe("loading")
      expect(result.current.journey.status).toBe("loading")
      expect(result.current.questions.status).toBe("loading")
      expect(result.current.overallStatus).toBe("generating")
    })
  })

  describe("Update Metadata", () => {
    it("should update metadata and set status to success", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      act(() => {
        result.current.startGeneration("test-form")
        result.current.updateMetadata({
          title: "Test Form",
          description: "Test Description",
        })
      })

      expect(result.current.metadata.status).toBe("success")
      expect(result.current.metadata.data).toEqual({
        title: "Test Form",
        description: "Test Description",
      })
      expect(result.current.metadata.lastUpdated).toBeInstanceOf(Date)
    })

    it("should merge partial metadata updates", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      act(() => {
        result.current.updateMetadata({ title: "Initial Title" })
      })

      act(() => {
        result.current.updateMetadata({ description: "Added Description" })
      })

      expect(result.current.metadata.data).toEqual({
        title: "Initial Title",
        description: "Added Description",
      })
    })
  })

  describe("Journey Script", () => {
    it("should set journey script and status", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      act(() => {
        result.current.setJourneyScript("Test journey script content")
      })

      expect(result.current.journey.status).toBe("success")
      expect(result.current.journey.data).toBe("Test journey script content")
    })
  })

  describe("Questions Management", () => {
    it("should add questions in correct order", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      const question1 = {
        id: "q1",
        title: "Question 1",
        type: "text" as const,
        required: true,
        order: 0,
      }

      const question2 = {
        id: "q2",
        title: "Question 2",
        type: "radio" as const,
        required: false,
        order: 1,
      }

      act(() => {
        result.current.addQuestion(question2, 1)
        result.current.addQuestion(question1, 0)
      })

      expect(result.current.questions.items).toHaveLength(2)
      expect(result.current.questions.items[0]).toEqual(question1)
      expect(result.current.questions.items[1]).toEqual(question2)
      expect(result.current.questions.generatedCount).toBe(2)
    })

    it("should handle out-of-order question additions", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      const question = {
        id: "q5",
        title: "Question at index 5",
        type: "text" as const,
        required: true,
        order: 5,
      }

      act(() => {
        result.current.addQuestion(question, 5)
      })

      // Should only have one question in the array (nulls removed)
      expect(result.current.questions.items).toHaveLength(1)
      expect(result.current.questions.items[0]).toEqual(question)
    })

    it("should track question progress", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      act(() => {
        result.current.setQuestionTotal(5)
      })

      expect(result.current.questions.total).toBe(5)
      expect(result.current.questions.progressStatus).toBe("success")
    })
  })

  describe("Error Handling", () => {
    it("should set error state with retry count", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      const error = new Error("Test error")

      act(() => {
        result.current.setError("metadata", error)
      })

      expect(result.current.metadata.status).toBe("error")
      expect(result.current.metadata.error).toBe(error)
      expect(result.current.metadata.retryCount).toBe(1)
      expect(result.current.metadata.canRetry).toBe(true)
      expect(result.current.overallStatus).toBe("error")
    })

    it("should limit retry attempts", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      const error = new Error("Test error")

      // Fail 3 times
      act(() => {
        result.current.setError("journey", error)
        result.current.setError("journey", error)
        result.current.setError("journey", error)
      })

      expect(result.current.journey.retryCount).toBe(3)
      expect(result.current.journey.canRetry).toBe(false)
    })
  })

  describe("Retry Functionality", () => {
    it("should retry section if allowed", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      act(() => {
        result.current.setError("questions", new Error("Test"))
      })

      expect(result.current.questions.status).toBe("error")

      act(() => {
        result.current.retrySection("questions")
      })

      expect(result.current.questions.status).toBe("loading")
      expect(result.current.questions.error).toBeNull()
      expect(result.current.overallStatus).toBe("generating")
    })

    it("should not retry if max attempts reached", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      // Max out retries
      act(() => {
        result.current.setError("metadata", new Error("Test"))
        result.current.setError("metadata", new Error("Test"))
        result.current.setError("metadata", new Error("Test"))
      })

      expect(result.current.metadata.canRetry).toBe(false)

      act(() => {
        result.current.retrySection("metadata")
      })

      // Status should remain error
      expect(result.current.metadata.status).toBe("error")
    })
  })

  describe("Computed Values", () => {
    it("should compute isGenerating correctly", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      expect(result.current.isGenerating()).toBe(false)

      act(() => {
        result.current.startGeneration("test")
      })

      expect(result.current.isGenerating()).toBe(true)
    })

    it("should compute hasAllData correctly", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      expect(result.current.hasAllData()).toBe(false)

      act(() => {
        result.current.updateMetadata({ title: "Test" })
        result.current.setJourneyScript("Journey")
        result.current.questions.status = "success"
      })

      expect(result.current.hasAllData()).toBe(true)
    })

    it("should compute progress correctly", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      expect(result.current.getProgress()).toBeNull()

      act(() => {
        result.current.setQuestionTotal(5)
        result.current.addQuestion(
          { id: "q1", title: "Q1", type: "text", required: true, order: 0 },
          0
        )
      })

      expect(result.current.getProgress()).toEqual({
        current: 1,
        total: 5,
      })
    })
  })

  describe("Event Order Resilience", () => {
    it("should handle events in any order", () => {
      const { result } = renderHook(() => useFormGenerationStore())

      // Add question before setting total
      act(() => {
        result.current.addQuestion(
          { id: "q1", title: "Q1", type: "text", required: true, order: 0 },
          0
        )
      })

      expect(result.current.questions.items).toHaveLength(1)
      expect(result.current.questions.total).toBeNull()

      // Set total after question
      act(() => {
        result.current.setQuestionTotal(5)
      })

      expect(result.current.questions.total).toBe(5)
      expect(result.current.questions.items).toHaveLength(1)
    })
  })
})
