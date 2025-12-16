import { arrayMove } from "@dnd-kit/sortable"
import {
  EditableQuestionField,
  Form,
  Option,
  Question,
  QuestionValidations,
  Settings,
} from "@formlink/schema"
import isEqual from "fast-deep-equal"
import { produce } from "immer"
import { v4 as uuidv4 } from "uuid"
import { create, StateCreator } from "zustand"
import { immer } from "zustand/middleware/immer"

export type FormWithVersionIds = {
  current_published_version_id?: string | null
  current_draft_version_id?: string | null
  branch_name?: string | null
  preview_url?: string | null
  live_url?: string | null
  last_deployed_at?: string | null
  published_at?: string | null
  sandbox_id?: string | null
} & Form

type QuestionWithLists = Question & {
  readableValidations?: string[]
  readableConditionalLogic?: string[]
}

interface FormEditorState {
  form: FormWithVersionIds | null
  initialFormSnapshot: FormWithVersionIds | null
  isLoading: boolean
  error: string | null
  selectedQuestionId: string | null
  isCodeMode: boolean
}

interface FormEditorActions {
  resetForm: () => void
  setForm: (form: FormWithVersionIds) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSelectedQuestionId: (id: string | null) => void
  updateSnapshot: () => void
  updateSettingField: <K extends keyof Settings>(
    field: K,
    value: Settings[K]
  ) => void
  // Accept extended editor fields (title/description + runtime/deploy metadata)
  updateFormField: <K extends keyof FormWithVersionIds>(
    field: K,
    value: FormWithVersionIds[K]
  ) => void
  updateQuestionField: (
    questionId: string,
    field: EditableQuestionField,
    value: string | undefined
  ) => void
  addQuestionOption: (questionId: string, newOption: Option) => void
  deleteQuestionOption: (questionId: string, optionIndex: number) => void
  addQuestionValidation: (
    questionId: string,
    newValidation: string,
    schemas: Record<
      keyof QuestionValidations,
      QuestionValidations[keyof QuestionValidations]
    >[]
  ) => void
  deleteQuestionValidation: (
    questionId: string,
    validationIndex: number
  ) => void
  addQuestionCondition: (
    questionId: string,
    newCondition: string,
    jsonata: string
  ) => void
  deleteQuestionCondition: (questionId: string, conditionIndex: number) => void
  addQuestion: (object?: {
    questionToClone?: Question
    insertIndex?: number
    isNewQuestion?: boolean
  }) => void
  reorderQuestions: (oldIndex: number, newIndex: number) => void
  deleteQuestion: (questionId: string) => void
  setIsCodeMode: (isCodeMode: boolean) => void
}

export const getDefaultSettings = (): Settings => ({
  defaultMode: "ai",
  redirectOnSubmissionUrl: "",
  creatorMailAddressOnSubmission: "",
  submissionNotificationEmail: "",
  integrations: { webhookUrl: "" },
  additionalFields: {
    queryParamater: [],
    computedFromResponses: [],
  },
})

const formEditorStore: StateCreator<
  FormEditorState & FormEditorActions,
  [["zustand/immer", never]],
  [],
  FormEditorState & FormEditorActions
> = (set, get) => ({
  form: null,
  initialFormSnapshot: null,
  isLoading: true,
  error: null,
  selectedQuestionId: null,
  isCodeMode: false,

  resetForm: () => {
    set((state) => {
      state.form = null
      state.initialFormSnapshot = null
      state.isLoading = false
      state.error = null
      state.selectedQuestionId = null
    })
  },

  setForm: (form: FormWithVersionIds) => {
    // Filter out null questions that might exist during generation
    const validQuestions = form.questions.filter((q: Question) => q !== null)
    const firstQuestionId = validQuestions?.[0]?.id ?? null

    const questionsWithLists: QuestionWithLists[] = validQuestions.map(
      (q: Question) => {
        const baseQuestion = q as QuestionWithLists

        const defaultEmptyConditionalLogic = { jsonata: "", prompt: "" }
        return {
          ...baseQuestion,
          readableValidations: baseQuestion.readableValidations || [],
          readableConditionalLogic: baseQuestion.readableConditionalLogic || [],
          conditionalLogic:
            baseQuestion.conditionalLogic &&
            (baseQuestion.conditionalLogic.jsonata ||
              baseQuestion.conditionalLogic.prompt)
              ? baseQuestion.conditionalLogic
              : defaultEmptyConditionalLogic,
        }
      }
    )

    const effectiveSettings = form.settings || getDefaultSettings()

    const processedForm = {
      ...form,
      settings: effectiveSettings,
      questions: questionsWithLists,
    }

    set((state) => {
      state.form = processedForm
      state.initialFormSnapshot = JSON.parse(JSON.stringify(processedForm))
      state.isLoading = false
      state.error = null
      state.selectedQuestionId = firstQuestionId
    })
  },

  setLoading: (loading: boolean) =>
    set((state) => {
      state.isLoading = loading
    }),

  setError: (error: string | null) =>
    set((state) => {
      state.error = error
      state.isLoading = false
    }),

  setSelectedQuestionId: (id: string | null) =>
    set((state) => {
      state.selectedQuestionId = id
    }),

  updateSnapshot: () =>
    set((state) => {
      if (state.form) {
        state.initialFormSnapshot = JSON.parse(JSON.stringify(state.form))
      }
    }),

  updateSettingField: (field, value) =>
    set((state) => {
      if (state.form) {
        if (!state.form.settings) {
          state.form.settings = getDefaultSettings()
        }

        state.form.settings = {
          ...getDefaultSettings(),
          ...state.form.settings,
        }
        ;(state.form.settings as any)[field] = value
      }
    }),

  updateFormField: <K extends keyof FormWithVersionIds>(
    field: K,
    value: FormWithVersionIds[K]
  ) =>
    set((state) => {
      if (state.form) {
        state.form[field] = value
      }
    }),

  updateQuestionField: (
    questionId: string,
    field: EditableQuestionField,
    value: string | undefined
  ) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined
      if (question) {
        if (field in question) {
          ;(question as any)[field] = value
        } else {
          console.warn(
            `Field '${field}' does not exist on question with id ${questionId}.`
          )
        }
      } else {
        console.warn(`Question with id ${questionId} not found for update.`)
      }
    }),

  addQuestionOption: (questionId: string, newOption: Option) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined
      if (question && question.type && "options" in question.type) {
        if (!question.type.options) question.type.options = []

        question.type.options.push(newOption as any)
      }
    }),

  deleteQuestionOption: (questionId: string, optionIndex: number) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined
      if (
        question &&
        question.type &&
        "options" in question.type &&
        question.type.options &&
        optionIndex >= 0 &&
        optionIndex < question.type.options.length
      ) {
        question.type.options.splice(optionIndex, 1)
      }
    }),

  addQuestionValidation: (
    questionId: string,
    newValidation: string,
    schemas: Record<
      keyof QuestionValidations,
      QuestionValidations[keyof QuestionValidations]
    >[]
  ) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined
      if (question) {
        if (!question.readableValidations) question.readableValidations = []
        if (!question.validations) question.validations = {}

        for (const schemaObj of schemas) {
          for (const key in schemaObj) {
            if (Object.prototype.hasOwnProperty.call(schemaObj, key)) {
              const validation = schemaObj[
                key as keyof QuestionValidations
              ] as { originalText: string }
              question.readableValidations.push(validation.originalText)
              question.validations[key as keyof QuestionValidations] =
                validation
            }
          }
        }
      }
    }),

  deleteQuestionValidation: (questionId: string, validationIndex: number) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined

      if (
        question?.readableValidations &&
        validationIndex >= 0 &&
        validationIndex < question.readableValidations.length &&
        question.validations
      ) {
        const readableValidationToDelete =
          question.readableValidations[validationIndex]

        let validationKeyToDelete: keyof QuestionValidations | undefined
        for (const key in question.validations) {
          if (
            typeof question.validations[key] === "object" &&
            question.validations[key] !== null &&
            (question.validations[key] as any).originalText ===
              readableValidationToDelete
          ) {
            validationKeyToDelete = key as keyof QuestionValidations
            break
          }
        }

        question.readableValidations.splice(validationIndex, 1)

        if (validationKeyToDelete && question.validations) {
          delete question.validations[validationKeyToDelete]
        }
      }
    }),

  addQuestionCondition: (
    questionId: string,
    newCondition: string,
    jsonata: string
  ) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined
      if (question) {
        if (!question.readableConditionalLogic)
          question.readableConditionalLogic = []
        question.readableConditionalLogic = [newCondition]
        question.conditionalLogic = { prompt: newCondition, jsonata }
      }
    }),

  deleteQuestionCondition: (questionId: string) =>
    set((state) => {
      const question = state.form?.questions.find(
        (q: Question) => q.id === questionId
      ) as QuestionWithLists | undefined
      if (question) {
        question.readableConditionalLogic = []
        question.conditionalLogic = { jsonata: "", prompt: "" }
      }
    }),

  addQuestion: ({
    questionToClone,
    insertIndex,
    isNewQuestion,
  }: {
    questionToClone?: Question
    insertIndex?: number
    isNewQuestion?: boolean
  } = {}) =>
    set((state) => {
      if (!state.form) return

      const questions = state.form.questions as QuestionWithLists[]
      const insertionIndex =
        insertIndex !== undefined ? insertIndex : questions.length

      let baseQuestion: QuestionWithLists

      if (questionToClone) {
        baseQuestion = questionToClone as QuestionWithLists
      } else {
        const lastQuestion = questions[questions.length - 1]
        if (lastQuestion) {
          baseQuestion = lastQuestion
        } else {
          baseQuestion = {
            id: uuidv4(),
            questionNo: 1,
            title: "New Question",
            description: "This is a text input question.",
            type: {
              name: "text",
              format: "text",
            },
            styling: { colSpan: 12 },
            validations: { required: { value: true } },
            readableValidations: ["This question is required."],
            readableConditionalLogic: [],
            submissionBehavior: "manualUnclear",
          } as QuestionWithLists
        }
      }

      const newQuestion = produce(baseQuestion, (draft: QuestionWithLists) => {
        draft.id = uuidv4()

        if (questionToClone) {
          draft.title = `${draft.title} ${isNewQuestion ? "" : "(Copy)"}`

          if ("responses" in draft) {
            ;(draft as any).responses = []
          }
        }

        if (draft.readableValidations === undefined)
          draft.readableValidations = []
        if (draft.readableConditionalLogic === undefined)
          draft.readableConditionalLogic = []
        if (
          draft.type &&
          "options" in draft.type &&
          draft.type.options === undefined
        )
          draft.type.options = []
        if (draft.conditionalLogic === undefined)
          draft.conditionalLogic = {
            jsonata: "",
            prompt: "",
          }
        if (draft.validations === undefined) draft.validations = {}
      })

      questions.splice(insertionIndex, 0, newQuestion)

      state.form.questions = questions.map(
        (q: QuestionWithLists, index: number) => ({
          ...q,
          questionNo: index + 1,
        })
      )

      state.selectedQuestionId = newQuestion.id
    }),

  reorderQuestions: (oldIndex: number, newIndex: number) =>
    set((state) => {
      if (!state.form || oldIndex === newIndex) return

      const reorderedQuestions = arrayMove(
        state.form.questions,
        oldIndex,
        newIndex
      ) as QuestionWithLists[]

      state.form.questions = reorderedQuestions.map(
        (q: QuestionWithLists, index: number) => ({
          ...q,
          questionNo: index + 1,
        })
      )
    }),

  deleteQuestion: (questionId: string) =>
    set((state) => {
      if (!state.form) return
      const initialLength = state.form.questions.length
      state.form.questions = state.form.questions.filter(
        (q: Question) => q.id !== questionId
      ) as QuestionWithLists[]

      if (state.form.questions.length < initialLength) {
        state.form.questions = state.form.questions.map(
          (q: QuestionWithLists, index: number) => ({
            ...q,
            questionNo: index + 1,
          })
        )

        if (state.selectedQuestionId === questionId) {
          const originalIndex =
            get().form?.questions.findIndex(
              (q: Question) => q.id === questionId
            ) ?? -1
          if (originalIndex !== -1) {
            const newSelectionIndex = Math.max(0, originalIndex - 1)
            state.selectedQuestionId =
              state.form.questions[newSelectionIndex]?.id ??
              state.form.questions[0]?.id ??
              null
          } else {
            state.selectedQuestionId = state.form.questions[0]?.id ?? null
          }
        }
      }
    }),

  setIsCodeMode: (isCodeMode: boolean) =>
    set((state) => {
      state.isCodeMode = isCodeMode
    }),
})

export const useFormEditorStore = create<FormEditorState & FormEditorActions>()(
  immer(formEditorStore)
)

export const selectIsDirty = (
  state: FormEditorState & FormEditorActions
): boolean => {
  if (!state.form || !state.initialFormSnapshot) {
    return false
  }
  return !isEqual(state.form, state.initialFormSnapshot)
}
