import { EditableQuestionField, Option, Question } from "@formlink/schema"
import { useCallback } from "react"
import { useFormEditorStore } from "../../../../../stores/useFormEditorStore"

export const useQuestionHandlers = (question: Question | null) => {
  const {
    form,
    updateQuestionField,
    addQuestionOption,
    deleteQuestionOption,
    addQuestionValidation,
    deleteQuestionValidation,
    addQuestionCondition,
    deleteQuestionCondition,
    deleteQuestion,
    addQuestion,
  } = useFormEditorStore()

  const handleFieldUpdate = useCallback(
    (field: EditableQuestionField, value: string) => {
      if (!question) return

      if (field in question && (question as any)[field] !== value) {
        const valueToSave =
          value.trim() === "" && field === "description" ? undefined : value
        updateQuestionField(question.id, field, valueToSave)
      }
    },
    [question, updateQuestionField]
  )

  const handleAddOption = useCallback(
    (option: { label: string; value: string; score?: number }) => {
      if (!question) return
      const withScore: Option = {
        label: option.label,
        value: option.value,
        score: option.score ?? 0,
      }
      addQuestionOption(question.id, withScore)
    },
    [question, addQuestionOption]
  )

  const handleDeleteOption = useCallback(
    (index: number) => {
      if (!question) return
      deleteQuestionOption(question.id, index)
    },
    [question, deleteQuestionOption]
  )

  const handleDeleteValidation = useCallback(
    (index: number) => {
      if (!question) return
      deleteQuestionValidation(question.id, index)
    },
    [question, deleteQuestionValidation]
  )

  const handleDeleteCondition = useCallback(
    (index: number) => {
      if (!question) return
      deleteQuestionCondition(question.id, index)
    },
    [question, deleteQuestionCondition]
  )

  const handleDuplicateQuestion = useCallback(() => {
    if (!form || !question) return

    const currentQuestionIndex = form.questions.findIndex(
      (q) => q.id === question.id
    )
    if (currentQuestionIndex === -1) return

    addQuestion({
      questionToClone: question,
      insertIndex: currentQuestionIndex + 1,
    })
  }, [form, question, addQuestion])

  const handleDeleteQuestion = useCallback(() => {
    if (!question) return

    if (
      window.confirm(
        `Are you sure you want to delete question ${question.questionNo}: "${question.title}"?`
      )
    ) {
      deleteQuestion(question.id)
    }
  }, [question, deleteQuestion])

  return {
    form,
    handleFieldUpdate,
    handleAddOption,
    handleDeleteOption,
    handleDeleteValidation,
    handleDeleteCondition,
    handleDuplicateQuestion,
    handleDeleteQuestion,
    addQuestionValidation,
    addQuestionCondition,
  }
}
