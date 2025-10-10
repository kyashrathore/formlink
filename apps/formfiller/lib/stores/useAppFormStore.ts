"use client";

import { Form, Question } from "@formlink/schema";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { apiServices } from "../api-config";
import { AppFormActions, AppFormState, QuestionResponse } from "../types";

// Helper function to get all questions from the form schema
const getAllQuestions = (formSchema: Form): Question[] => {
  return formSchema.questions || [];
};

// Note: AppFormState and AppFormActions are now imported from types.ts

const initialAppState: AppFormState = {
  formSchema: null,
  formId: undefined,
  submissionId: undefined,
  questions: [],
  questionResponses: {},
  isCompleted: false,
};

export const useAppFormStore = create<AppFormState & AppFormActions>()(
  (set, get) => ({
    ...initialAppState,

    initialize: async (
      schema: Form,
      id?: string,
      initialData?: Record<string, QuestionResponse>,
      isTestSubmission?: boolean,
    ) => {
      const storageKey = id ? `formlink:typeform:${id}` : undefined;
      let persisted: {
        submissionId?: string;
        questionResponses?: Record<string, QuestionResponse>;
      } | null = null;
      try {
        if (storageKey && typeof window !== "undefined") {
          const raw = localStorage.getItem(storageKey);
          if (raw) persisted = JSON.parse(raw);
        }
      } catch {}

      const submissionId =
        (persisted?.submissionId as string | undefined) || uuidv4();
      const allQuestions = getAllQuestions(schema);

      set({
        formSchema: schema,
        formId: id,
        submissionId: submissionId,
        questions: allQuestions,
        questionResponses: {
          ...(initialData || {}),
          ...(persisted?.questionResponses || {}),
        },
        isCompleted: false,
      });

      // Create or upsert the submission record in the database
      if (id) {
        try {
          await apiServices.saveAnswers(id, {
            submissionId: submissionId,
            answers: [],
            formVersionId: schema.version_id,
            isTestSubmission: !!isTestSubmission,
            status: "in_progress",
          });
        } catch (error) {
          // previously logged initial submission creation error; logs removed.
        }
      }

      // Persist to localStorage for refresh resume
      try {
        if (storageKey && typeof window !== "undefined") {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              submissionId,
              questionResponses: {
                ...(initialData || {}),
                ...(persisted?.questionResponses || {}),
              },
            }),
          );
        }
      } catch {}
    },

    restart: async () => {
      const currentState = get();
      const { formSchema, formId } = currentState;

      // Reset state
      set({
        ...initialAppState,
      });

      // Re-initialize with fresh data
      if (formSchema && formId) {
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem(`formlink:typeform:${formId}`);
          }
        } catch {}
        await get().initialize(formSchema, formId);
      }
    },

    setQuestionResponse: (questionId: string, value: QuestionResponse) => {
      set((state) => {
        const updatedResponses = {
          ...state.questionResponses,
          [questionId]: value,
        };

        // Persist updated responses to localStorage
        try {
          const storageKey = state.formId
            ? `formlink:typeform:${state.formId}`
            : undefined;
          if (storageKey && typeof window !== "undefined") {
            const raw = localStorage.getItem(storageKey);
            const persisted = raw ? JSON.parse(raw) : {};
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                submissionId: state.submissionId,
                questionResponses: {
                  ...(persisted?.questionResponses || {}),
                  [questionId]: value,
                },
              }),
            );
          }
        } catch {}

        // Fire-and-forget partial save
        try {
          const formId = state.formId as string | undefined;
          const submissionId = state.submissionId as string | undefined;
          const versionId = state.formSchema?.version_id as string | undefined;
          if (formId && submissionId && versionId) {
            apiServices
              .savePartialAnswer(formId, {
                submissionId,
                formVersionId: versionId,
                questionId,
                answerValue: value,
                submissionStatus: "in_progress",
                testmode: false,
              })
              .catch(() => {});
          }
        } catch {}

        return { questionResponses: updatedResponses } as Partial<AppFormState>;
      });
    },

    handleSingleChoiceChange: (questionId, value) => {
      get().setQuestionResponse(questionId, value);
    },

    handleMultipleChoiceChange: (questionId, value, checked) => {
      const currentResponse = get().questionResponses[questionId] || [];
      const responseArray = Array.isArray(currentResponse)
        ? (currentResponse as string[])
        : [];
      const newResponse = checked
        ? [...responseArray, value]
        : responseArray.filter((item: string) => item !== value);

      get().setQuestionResponse(questionId, newResponse);
    },

    handleTextChange: (questionId, value) => {
      get().setQuestionResponse(questionId, value);
    },

    shouldShowQuestion: () => {
      // Basic implementation: always show.
      // TODO: Implement actual conditional logic based on question.conditionalLogic
      // and current questionResponses
      return true;
    },

    getNextValidQuestionIndex: (currentIndex: number) => {
      const { questions } = get();
      let nextIndex = currentIndex + 1;

      while (nextIndex < questions.length) {
        const nextQuestion = questions[nextIndex];
        if (nextQuestion && get().shouldShowQuestion(nextQuestion)) {
          return nextIndex;
        }
        nextIndex++;
      }

      return null; // No more valid questions
    },

    markAsCompleted: () => {
      set({ isCompleted: true });
    },

    submitForm: async () => {
      const { formId, submissionId, questionResponses, formSchema } = get();

      if (!formId || !submissionId) {
        return false;
      }

      try {
        // Transform questionResponses to the format expected by the API
        const answers = Object.entries(questionResponses).map(
          ([questionId, value]) => ({
            questionId,
            value: value,
          }),
        );

        await apiServices.saveAnswers(formId, {
          submissionId,
          answers,
          formVersionId: formSchema?.version_id || "",
          isTestSubmission: false,
          status: "completed",
        });

        set({ isCompleted: true });

        // Clear persisted cache after completion
        try {
          if (typeof window !== "undefined" && formId) {
            localStorage.removeItem(`formlink:typeform:${formId}`);
          }
        } catch {}
        return true;
      } catch (error) {
        return false;
      }
    },

    handleFileUpload: async (
      questionId: string,
      file: File,
    ): Promise<string | null> => {
      const { formId, submissionId } = get();
      if (!formId || !submissionId) {
        return null;
      }

      const inferredExt = file.type?.split("/")?.[1] || "bin";
      const safeFile =
        !file || !file.name
          ? new File([file], `upload-${Date.now()}.${inferredExt}`, {
              type: file.type || "application/octet-stream",
              lastModified: Date.now(),
            })
          : file;

      const formData = new FormData();
      formData.append("file", safeFile);
      formData.append("formId", formId);
      formData.append("submissionId", submissionId);
      formData.append("questionId", questionId);

      try {
        const result = await apiServices.uploadFile(formData);

        // Save the file data as an object that matches what FileUploadInput expects
        get().setQuestionResponse(questionId, {
          url: result.url,
          name: safeFile.name,
          size: safeFile.size,
        });

        return result.url;
      } catch (error) {
        // Throw the error so the UI can handle it properly
        throw error;
      }
    },

    getCurrentQuestion: (activeIndex: number): Question | null => {
      const { questions } = get();
      return activeIndex >= 0 && activeIndex < questions.length
        ? (questions[activeIndex] as Question)
        : null;
    },

    getProgress: (activeIndex: number) => {
      const { questions } = get();
      return activeIndex >= 0
        ? ((activeIndex + 1) / questions.length) * 100
        : 0;
    },

    reset: () => {
      set(initialAppState);
    },
  }),
);
