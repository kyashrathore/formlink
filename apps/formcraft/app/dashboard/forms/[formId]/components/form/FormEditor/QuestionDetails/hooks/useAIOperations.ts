import { useAI } from "@/app/hooks/use-ai"
import { Question } from "@formlink/schema"
import { toast } from "@formlink/ui"
import { useCallback } from "react"

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
          toast({
            title: "Validation Error",
            description: result.message || "Invalid validation rule statement.",
            status: "warning",
          })
        } else if (result.data) {
          addQuestionValidation(question.id, value, result.data)
          setVisibleInput(null)
        } else {
          toast({
            title: "Validation Error",
            description: "Validation successful, but no schema returned.",
            status: "warning",
          })
        }
      } catch (error) {
        toast({
          title: "Request Failed",
          description:
            error instanceof Error
              ? error.message
              : "Could not connect to AI service.",
          status: "warning",
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
          toast({
            title: "Validation Error",
            description:
              result.message || "Invalid conditional logic statement.",
            status: "warning",
          })
        } else if (result.data && result.data.jsonataExpression) {
          addQuestionCondition(
            question.id,
            value,
            result.data.jsonataExpression
          )
          setVisibleInput(null)
          toast({
            title: "Condition Added",
            description: "JSONata expression generated successfully.",
            status: "success",
          })
        } else {
          toast({
            title: "Validation Error",
            description:
              "Validation successful, but no JSONata expression returned.",
            status: "warning",
          })
        }
      } catch (error) {
        toast({
          title: "Request Failed",
          description:
            error instanceof Error
              ? error.message
              : "Could not connect to AI service.",
          status: "warning",
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
