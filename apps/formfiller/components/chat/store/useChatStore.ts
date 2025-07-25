import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Message as MessageType } from "@ai-sdk/react";
import { v4 as uuidv4 } from "uuid";
import { Form, Question } from "@formlink/schema";
import jsonata from "jsonata";
import { findNextQuestion } from "../../../lib/utils";
import { apiConfig, apiServices } from "../../../lib/api-config";
import type { QuestionResponse } from "../../../lib/types";

// --- Pure Helper Functions (top-level, no store dependency) ---

async function computeDerivedFields(
  formSchema: Form | null,
  currentInputs: Record<string, QuestionResponse>,
) {
  const responsesWithComputedFields = { ...currentInputs };
  const computedFields =
    formSchema?.settings?.additionalFields?.computedFromResponses;
  if (Array.isArray(computedFields) && computedFields.length > 0) {
    for (const computed of computedFields) {
      if (
        computed &&
        typeof computed === "object" &&
        computed.field_id &&
        computed.jsonata
      ) {
        try {
          const expr = jsonata(computed.jsonata);
          const value = await expr.evaluate(responsesWithComputedFields);
          responsesWithComputedFields[computed.field_id] = value;
        } catch (err) {
          console.error(
            "Error evaluating computedFromResponses jsonata:",
            computed,
            err,
          );
        }
      }
    }
  }
  return responsesWithComputedFields;
}

function saveAnswerToApi(
  apiConfiguration: {
    formId: string | null;
    versionId: string | null;
    submissionId: string | null;
    isTestSubmission: boolean;
  },
  payload: {
    questionId?: string;
    answerValue?: QuestionResponse;
    allResponses?: Record<string, QuestionResponse>;
    isPartial: boolean;
    submissionStatus: string;
  },
) {
  const { formId, versionId, submissionId, isTestSubmission } =
    apiConfiguration;
  if (!formId || !versionId || !submissionId) {
    console.error("Missing IDs for saveAnswerToApi");
    return;
  }
  fetch(apiConfig.getSaveAnswersUrl(formId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submissionId,
      versionId,
      ...(payload.questionId && payload.answerValue !== undefined
        ? { questionId: payload.questionId, answerValue: payload.answerValue }
        : {}),
      ...(payload.allResponses ? { allResponses: payload.allResponses } : {}),
      isPartial: payload.isPartial,
      submissionStatus: payload.submissionStatus,
      testmode: isTestSubmission,
    }),
  });
}

type FormDisplayState =
  | "idle"
  | "displaying_question_classical"
  | "chatting_ai_ready"
  | "chatting_ai_loading"
  | "uploading_file"
  | "completed"
  | "saved" // Added for post-save state before redirect
  | "error";

interface ChatState {
  aiMode: boolean;
  formSchema: Form | null;
  currentInputs: Record<string, QuestionResponse>;
  submissionId: string | null;
  versionId: string | null;
  formId: string | null;
  currentQuestionId: string | null;
  formDisplayState: FormDisplayState;
  lastError: string | null;
  chatHistoryMessages: MessageType[];
  isTestSubmission: boolean;
  ephemeralUploadedFile: File | null;

  // New: For selection-to-user-message UX
  triggerUserMessageForSelection: {
    assistantMessageId: string;
    questionId: string;
    value: QuestionResponse;
    displayText: string;
    timestamp: number;
  } | null;

  // Actions
  setupFormCore: (
    formSchemaData: Form,
    formIdVal: string,
    versionIdVal: string,
    aiModeFlag: boolean,
    initialData?: Record<string, QuestionResponse>,
    isTestSubmissionFlag?: boolean,
  ) => void;
  startFormInteraction: () => void;
  initializeForm: (
    formSchemaData: Form,
    formIdVal: string,
    versionIdVal: string,
    aiModeFlag: boolean,
    initialData?: Record<string, QuestionResponse>,
    isTestSubmissionFlag?: boolean,
  ) => void;
  submitAnswerClassical: (answerValue: QuestionResponse) => void;
  processAssistantResponse: () => void;
  getCurrentQuestion: () => Question | undefined;
  setFormDisplayState: (newState: FormDisplayState) => void;
  setLastError: (errorMsg: string) => void;
  setChatHistoryMessages: (messages: MessageType[]) => void;
  setCurrentInput: (questionId: string, value: QuestionResponse) => void;
  setTriggerUserMessageForSelection: (
    assistantMessageId: string,
    questionId: string,
    value: QuestionResponse,
    displayText: string,
  ) => void;
  clearTriggerUserMessageForSelection: () => void;
  restartForm: () => void;
  setEphemeralUploadedFile: (file: File | null) => void;
  handleFileUpload: (questionId: string, file: File) => Promise<void>;
  setCurrentQuestionId: (questionId: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      aiMode: false,
      formSchema: null,
      currentInputs: {},
      submissionId: null,
      versionId: null,
      formId: null,
      currentQuestionId: null,
      formDisplayState: "idle",
      lastError: null,
      chatHistoryMessages: [],
      triggerUserMessageForSelection: null,
      isTestSubmission: false,
      ephemeralUploadedFile: null,

      setupFormCore: (
        formSchemaData,
        formIdVal,
        versionIdVal,
        aiModeFlag,
        initialData = {},
        isTestSubmissionFlag = false,
      ) => {
        const {
          formId: prevFormId,
          submissionId: prevSubmissionId,
          currentQuestionId: prevCurrentQuestionId,
          formDisplayState: prevFormDisplayState,
          chatHistoryMessages: prevChatHistoryMessages,
          currentInputs: prevCurrentInputs,
        } = get();

        // Determine if we are re-initializing the exact same form instance
        const isContinuingSameFormInstance =
          prevFormId === formIdVal && prevSubmissionId;

        let newSubmissionId = prevSubmissionId;
        // Generate a new submissionId if it's a different form or no submissionId was persisted
        if (!prevSubmissionId || prevFormId !== formIdVal) {
          newSubmissionId = uuidv4();
        }

        set({
          formSchema: formSchemaData,
          formId: formIdVal,
          versionId: versionIdVal,
          aiMode: aiModeFlag,
          currentInputs: isContinuingSameFormInstance
            ? prevCurrentInputs
            : initialData,
          submissionId: newSubmissionId,
          chatHistoryMessages: isContinuingSameFormInstance
            ? prevChatHistoryMessages
            : [],
          currentQuestionId: isContinuingSameFormInstance
            ? prevCurrentQuestionId
            : null,
          formDisplayState: isContinuingSameFormInstance
            ? prevFormDisplayState
            : "idle",
          lastError: null,
          triggerUserMessageForSelection: null,
          isTestSubmission: isTestSubmissionFlag,
        });
      },

      startFormInteraction: () => {
        const {
          formSchema,
          aiMode,
          formId,
          submissionId,
          versionId,
          isTestSubmission,
        } = get();
        if (!formSchema) return;

        // Create the submission record in the database (only for non-AI mode)
        // In AI mode, the chat-assist route will create the submission
        if (!aiMode) {
          if (formId && submissionId && versionId) {
            fetch(apiConfig.getSaveAnswersUrl(formId), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                submissionId: submissionId,
                answers: [],
                formVersionId: versionId,
                isTestSubmission: isTestSubmission,
                status: "in_progress",
              }),
            }).catch((error) => {
              console.error(
                "Failed to create initial submission record:",
                error,
              );
            });
          }
        }

        const firstQuestionId =
          formSchema.questions && formSchema.questions.length > 0
            ? formSchema.questions[0]?.id
            : null;

        // Always start with empty chat history for startFormInteraction
        // This ensures the AI system message can be sent properly
        const initialChatHistoryMessages: MessageType[] = [];

        const newState = {
          chatHistoryMessages: initialChatHistoryMessages,
          formDisplayState: (aiMode
            ? "chatting_ai_ready"
            : "displaying_question_classical") as FormDisplayState,
          currentQuestionId: firstQuestionId,
        };

        set(newState);
      },

      initializeForm: (
        formSchemaData,
        formIdVal,
        versionIdVal,
        aiModeFlag,
        initialData = {},
        isTestSubmissionFlag = false,
      ) => {
        get().setupFormCore(
          formSchemaData,
          formIdVal,
          versionIdVal,
          aiModeFlag,
          initialData,
          isTestSubmissionFlag,
        );
      },

      submitAnswerClassical: async (answerValue) => {
        const {
          formSchema,
          currentQuestionId,
          currentInputs,
          formId,
          versionId,
          submissionId,
          isTestSubmission,
          setFormDisplayState, // get setFormDisplayState from store
        } = get();
        if (!formSchema || !currentQuestionId) return;

        const currentQuestion = formSchema.questions.find(
          (q: Question) => q.id === currentQuestionId,
        );

        if (!currentQuestion) {
          set({
            lastError: "Cannot submit answer: Current question not found.",
            formDisplayState: "error",
          });
          return;
        }

        // Simple validation (can be extended)
        if (
          currentQuestion.validations?.required &&
          (answerValue === undefined ||
            answerValue === null ||
            answerValue === "")
        ) {
          set({
            lastError: "Validation failed.",
            formDisplayState: "displaying_question_classical",
          });
          return;
        }

        const newInputs = {
          ...currentInputs,
          [currentQuestionId]: answerValue,
        };
        set({ currentInputs: newInputs, lastError: null });

        // Determine submission status
        const submissionStatus = "in_progress";

        // Save answer (partial)
        saveAnswerToApi(
          { formId, versionId, submissionId, isTestSubmission },
          {
            questionId: currentQuestionId,
            answerValue,
            isPartial: true,
            submissionStatus,
          },
        );

        // Find next question (currentQuestion is now guaranteed to be Question)
        const nextQ = findNextQuestion(
          currentQuestion,
          formSchema.questions,
          newInputs,
        );
        if (nextQ) {
          set({
            currentQuestionId: nextQ.id,
            formDisplayState: "displaying_question_classical",
          });
        } else {
          // Form complete
          // Compute computed fields before saving all answers
          const responsesWithComputedFields = await computeDerivedFields(
            formSchema,
            newInputs,
          );

          // Determine status for full submission
          const finalSubmissionStatus = "completed";

          // Save all answers
          saveAnswerToApi(
            { formId, versionId, submissionId, isTestSubmission },
            {
              allResponses: responsesWithComputedFields,
              isPartial: false,
              submissionStatus: finalSubmissionStatus,
            },
          );
          setFormDisplayState("saved"); // Transition to saved state
          set({ currentQuestionId: null }); // Clear current question
        }
      },

      processAssistantResponse: async () => {
        // This function is now a stub, as the primary logic
        // for handling question transitions is managed by the link-based system
        // and the backend's `processUserAnswer` endpoint.
        // We can retain it for potential future use cases or logging.
      },

      getCurrentQuestion: () => {
        const { formSchema, currentQuestionId } = get();
        if (!formSchema || !currentQuestionId) return undefined;
        return formSchema.questions.find(
          (q: Question) => q.id === currentQuestionId,
        );
      },

      setFormDisplayState: (newState) => set({ formDisplayState: newState }),
      setLastError: (errorMsg) => set({ lastError: errorMsg }),
      setChatHistoryMessages: (messages) =>
        set({ chatHistoryMessages: messages }),
      setCurrentInput: (questionId, value) =>
        set((state) => ({
          currentInputs: {
            ...state.currentInputs,
            [questionId]: value,
          },
        })),
      setTriggerUserMessageForSelection: (
        assistantMessageId,
        questionId,
        value,
        displayText,
      ) =>
        set({
          triggerUserMessageForSelection: {
            assistantMessageId,
            questionId,
            value,
            displayText,
            timestamp: Date.now(),
          },
        }),
      clearTriggerUserMessageForSelection: () =>
        set({ triggerUserMessageForSelection: null }),

      setEphemeralUploadedFile: (file) => set({ ephemeralUploadedFile: file }),

      handleFileUpload: async (questionId, file) => {
        const {
          formId,
          submissionId,
          setLastError,
          setCurrentInput,
          setFormDisplayState,
          setTriggerUserMessageForSelection,
        } = get();
        if (!formId || !submissionId) {
          setLastError("Cannot upload file: missing form or submission ID.");
          return;
        }

        set({ ephemeralUploadedFile: file });
        setFormDisplayState("uploading_file");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("formId", formId);
        formData.append("submissionId", submissionId);
        formData.append("questionId", questionId);

        try {
          const result = await apiServices.uploadFile(formData);
          const { publicUrl, fileName, fileSize } = result;

          const fileDetails = {
            url: publicUrl,
            name: fileName,
            size: fileSize,
          };

          // Set the input value immediately after successful upload
          setCurrentInput(questionId, fileDetails);

          // Find the last assistant message to trigger the user message from
          const lastAssistantMessage = get()
            .chatHistoryMessages.filter((m) => m.role === "assistant")
            .pop();

          if (lastAssistantMessage) {
            setTriggerUserMessageForSelection(
              lastAssistantMessage.id,
              questionId,
              fileDetails,
              `Uploaded file: ${fileName}`,
            );
          }
        } catch (error) {
          setLastError(
            error instanceof Error
              ? error.message
              : "An unknown error occurred during file upload.",
          );
        } finally {
          setFormDisplayState("chatting_ai_ready");
          set({ ephemeralUploadedFile: null });
        }
      },

      restartForm: () => {
        set((state) => {
          // Get initial data used for the current form setup.
          // This is a bit tricky as initialData isn't stored directly.
          // We'll assume initialData was {} if not provided during the last setupFormCore.
          // A more robust solution might involve storing initialData in the state if it's always needed for restart.
          // For now, resetting to empty or a predefined initial state.
          // The original plan mentioned `queryDataForForm || {}`. This data comes from component props.
          // The store itself doesn't have direct access to `queryDataForForm` from `FormAIComponent` props.
          // So, we'll reset to an empty object for `currentInputs`.
          // If `queryDataForForm` is critical for restart, `initializeForm` with preserved `submissionId`
          // might be a more suitable approach, but that's a larger refactor.
          // The current request is to "remove localstorage value keep same submission id".
          // Resetting currentInputs effectively does this for the form data part.

          return {
            ...state, // Keep existing state
            currentInputs: {}, // Reset to empty, or re-evaluate if queryDataForForm is essential here
            chatHistoryMessages: [], // Clear chat history
            currentQuestionId: null, // Reset current question
            formDisplayState: "idle", // Go back to start screen
            lastError: null,
            triggerUserMessageForSelection: null, // Clear any pending UI triggers
            ephemeralUploadedFile: null,
            // submissionId, formId, formSchema, versionId, aiMode, isTestSubmission are preserved
          };
        });
      },

      setCurrentQuestionId: (questionId) =>
        set({ currentQuestionId: questionId }),
    }),
    {
      name: "form-junction-chat-history-v2",
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              ![
                "ephemeralUploadedFile",
                "triggerUserMessageForSelection",
              ].includes(key),
          ),
        ),
    },
  ),
);
