import { useMutation } from "@tanstack/react-query"

interface AIRequestParams {
  operationType:
    | "validation"
    | "conditional"
    | "generate-compute-field-expression"
    | "sanitize_result_generation"
  prompt: string
  userId: string
  isAuthenticated: boolean
  questions: any
  currentQuestionId?: string
}

interface AIResponse {
  data?: any
  error?: boolean
  message?: string
}

export function useAI() {
  return useMutation<AIResponse, Error, AIRequestParams>({
    mutationFn: async (params: AIRequestParams) => {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })
      const result: AIResponse = await response.json()
      if (!response.ok) {
        throw new Error(
          result.message || "An unexpected error occurred during validation."
        )
      }
      return result
    },
  })
}
