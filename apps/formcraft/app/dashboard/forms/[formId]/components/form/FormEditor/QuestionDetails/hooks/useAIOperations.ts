import { useAI } from "@/app/hooks/use-ai"
import { Question } from "@formlink/schema"
import { useCallback } from "react"
import { toast } from "sonner"

interface FormData {
  questions: Question[]
  [key: string]: unknown
}

interface ValidationSchema {
  [key: string]: unknown
}

interface UseAIOperationsProps {
  question: Question | null
  userId: string
  form: FormData | null
  addQuestionValidation: (
    questionId: string,
    newValidation: string,
    schemas: ValidationSchema[]
  ) => void
  addQuestionCondition: (
    questionId: string,
    newCondition: string,
    jsonata: string
  ) => void
  setVisibleInput: (value: null) => void
}

export const useAIOperations = ({
  question,
  userId,
  form,
  addQuestionValidation,
  addQuestionCondition,
  setVisibleInput,
}: UseAIOperationsProps) => {
  const aiValidation = useAI()
  const aiCondition = useAI()

  const handleAddValidation = useCallback(
    async (value: string) => {
      if (!form || !question) return

      const isAuthenticated = true

      try {
        const result = await aiValidation.mutateAsync({
          operationType: "validation",
          prompt: value,
          userId: userId,
          isAuthenticated,
          questions: form.questions,
          currentQuestionId: question.id,
        })

        if (result.error) {
          toast.warning("Validation Error", {
            description: result.message || "Invalid validation rule statement.",
          })
        } else if (result.data) {
          addQuestionValidation(
            question.id,
            value,
            (result.data as ValidationSchema[]) || []
          )
          setVisibleInput(null)
        } else {
          toast.warning("Validation Error", {
            description: "Validation successful, but no schema returned.",
          })
        }
      } catch (error) {
        toast.warning("Request Failed", {
          description:
            error instanceof Error
              ? error.message
              : "Could not connect to AI service.",
        })
      }
    },
    [
      form,
      question,
      userId,
      aiValidation,
      addQuestionValidation,
      setVisibleInput,
    ]
  )

  const handleAddCondition = useCallback(
    async (value: string) => {
      if (!form || !question) return

      const isAuthenticated = true

      try {
        const result = await aiCondition.mutateAsync({
          operationType: "conditional",
          prompt: value,
          userId: userId,
          isAuthenticated,
          questions: form.questions,
          currentQuestionId: question.id,
        })

        if (result.error) {
          toast.warning("Validation Error", {
            description:
              result.message || "Invalid conditional logic statement.",
          })
        } else if (result.data && (result.data as any).jsonataExpression) {
          addQuestionCondition(
            question.id,
            value,
            (result.data as any).jsonataExpression
          )
          setVisibleInput(null)
          toast.success("Condition Added", {
            description: "JSONata expression generated successfully.",
          })
        } else {
          toast.warning("Validation Error", {
            description:
              "Validation successful, but no JSONata expression returned.",
          })
        }
      } catch (error) {
        toast.warning("Request Failed", {
          description:
            error instanceof Error
              ? error.message
              : "Could not connect to AI service.",
        })
      }
    },
    [form, question, userId, aiCondition, addQuestionCondition, setVisibleInput]
  )

  return {
    handleAddValidation,
    handleAddCondition,
    aiValidationLoading: aiValidation.status === "pending",
    aiConditionLoading: aiCondition.status === "pending",
  }
}
