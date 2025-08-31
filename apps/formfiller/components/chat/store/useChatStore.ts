import { UIMessage as MessageType } from "@ai-sdk/react";
import { createServerClient } from "@formlink/db";
import { Form, Question } from "@formlink/schema";
import jsonata from "jsonata";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiConfig, apiServices } from "../../../lib/api-config";
import type { QuestionResponse } from "../../../lib/types";
import { findNextQuestion } from "../../../lib/utils";

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
    console.warn("Missing IDs for saveAnswerToApi");
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

// Database validation utility
async function validateSubmissionExists(
  submissionId: string,
): Promise<boolean> {
  try {
    const supabase = await createServerClient(null, "service");
    const { data, error } = await supabase
      .from("form_submissions")
      .select("submission_id")
      .eq("submission_id", submissionId)
      .maybeSingle();

    if (error) {
      console.warn(`Error checking submission existence: ${error.message}`);
      return false;
    }

    return !!data;
  } catch (err) {
    console.warn(`Exception checking submission existence:`, err);
    return false;
  }
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
  ) => Promise<void>;
  startFormInteraction: () => void;
  initializeForm: (
    formSchemaData: Form,
    formIdVal: string,
    versionIdVal: string,
    aiModeFlag: boolean,
    initialData?: Record<string, QuestionResponse>,
    isTestSubmissionFlag?: boolean,
  ) => Promise<void>;
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
  clearPersistedState: () => void;
  restartForm: () => void;
  setEphemeralUploadedFile: (file: File | null) => void;
  handleFileUpload: (questionId: string, file: File) => Promise<void>;
  setCurrentQuestionId: (questionId: string | null) => void;
  updateSubmissionId: (newSubmissionId: string) => void;

  // New: Hydrate from server chat-history (messages + responses)
  hydrateFromHistory: (
    messages: MessageType[],
    responses: Record<string, QuestionResponse>,
    formSchemaOverride?: Form,
  ) => void;
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

      setupFormCore: async (
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

        // Validate if prevSubmissionId is a valid UUID
        const isValidUUID = (id: string | null): boolean => {
          if (!id) return false;
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(id);
        };

        let newSubmissionId = prevSubmissionId;
        let isContinuingSameFormInstance = false;

        // Case 1: No previous submission ID or invalid format - generate new one
        if (!isValidUUID(prevSubmissionId) || prevFormId !== formIdVal) {
          newSubmissionId = uuidv4();
        }
        // Case 2: Valid UUID and same form - check if it exists in database
        else if (prevFormId === formIdVal && isValidUUID(prevSubmissionId)) {
          const submissionExists = await validateSubmissionExists(
            prevSubmissionId!,
          ); // Non-null assertion safe after isValidUUID check
          if (submissionExists) {
            isContinuingSameFormInstance = true;
          } else {
            // Clear stale persisted state when submission no longer exists
            newSubmissionId = uuidv4();
            // Clear chat history since the old submission is invalid
            set({
              chatHistoryMessages: [],
              currentInputs: {},
              currentQuestionId: null,
            });
          }
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

        // If we're continuing a form instance with history but no current question,
        // re-hydrate to calculate the correct current question now that we have form schema
        if (
          isContinuingSameFormInstance &&
          prevChatHistoryMessages.length > 0 &&
          !prevCurrentQuestionId
        ) {
          const store = get();
          store.hydrateFromHistory(prevChatHistoryMessages, prevCurrentInputs);
        }
      },

      startFormInteraction: () => {
        const {
          formSchema,
          aiMode,
          formId,
          submissionId,
          versionId,
          isTestSubmission,
          chatHistoryMessages,
          currentQuestionId,
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

        // Preserve existing chat history if present; start fresh only when none exists
        const hasExistingHistory =
          Array.isArray(chatHistoryMessages) && chatHistoryMessages.length > 0;

        const initialChatHistoryMessages: MessageType[] = hasExistingHistory
          ? chatHistoryMessages
          : [];

        const resolvedCurrentQuestionId = hasExistingHistory
          ? (currentQuestionId ?? firstQuestionId)
          : firstQuestionId;

        set({
          chatHistoryMessages: initialChatHistoryMessages,
          formDisplayState: (aiMode
            ? "chatting_ai_ready"
            : "displaying_question_classical") as FormDisplayState,
          currentQuestionId: resolvedCurrentQuestionId,
        });
      },

      initializeForm: async (
        formSchemaData,
        formIdVal,
        versionIdVal,
        aiModeFlag,
        initialData = {},
        isTestSubmissionFlag = false,
      ) => {
        await get().setupFormCore(
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
        const nextQ = findNextQuestion(currentQuestion, formSchema.questions);
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
        // Set state back to ready after processing assistant response
        // This ensures the form is ready for user interaction
        const { formDisplayState } = get();
        if (formDisplayState === "chatting_ai_loading") {
          set({ formDisplayState: "chatting_ai_ready" });
        }
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
      ) => {
        set({
          triggerUserMessageForSelection: {
            assistantMessageId,
            questionId,
            value,
            displayText,
            timestamp: Date.now(),
          },
        });
      },
      clearTriggerUserMessageForSelection: () => {
        set({ triggerUserMessageForSelection: null });
      },

      clearPersistedState: () => {
        // Clear only the persisted fields to reset localStorage
        set({
          submissionId: null,
          formId: null,
          versionId: null,
          currentInputs: {},
          chatHistoryMessages: [],
          currentQuestionId: null,
        });
      },

      setEphemeralUploadedFile: (file) => set({ ephemeralUploadedFile: file }),

      handleFileUpload: async (questionId, file) => {
        // Handle case where file is passed as an array (from onFileSelect callback)
        let actualFile = file;
        if (Array.isArray(file) && file.length > 0) {
          actualFile = file[0];
        }

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

        set({ ephemeralUploadedFile: actualFile });
        setFormDisplayState("uploading_file");

        const formData = new FormData();
        formData.append("file", actualFile);
        formData.append("formId", formId);
        formData.append("submissionId", submissionId);
        formData.append("questionId", questionId);

        try {
          const result = await apiServices.uploadFile(formData);
          const { url, fileName, fileSize } = result;

          const fileDetails = {
            url: url,
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
          return {
            ...state,
            currentInputs: {},
            chatHistoryMessages: [],
            currentQuestionId: null,
            formDisplayState: "idle",
            lastError: null,
            triggerUserMessageForSelection: null,
            ephemeralUploadedFile: null,
          };
        });
      },

      setCurrentQuestionId: (questionId) =>
        set({ currentQuestionId: questionId }),

      updateSubmissionId: (newSubmissionId) => {
        // Validate the new submission ID is a valid UUID
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(newSubmissionId)) {
          set({ submissionId: newSubmissionId });
        } else {
          console.error(`Invalid submission ID format: ${newSubmissionId}`);
        }
      },

      // Hydrate store from server-provided history and responses
      hydrateFromHistory: (messages, responses, formSchemaOverride) => {
        const store = get();
        const formSchema = formSchemaOverride || store.formSchema;

        let nextQuestionId: string | null = null;

        if (formSchema?.questions?.length) {
          for (const q of formSchema.questions) {
            if (!Object.prototype.hasOwnProperty.call(responses || {}, q.id)) {
              nextQuestionId = q.id;
              break;
            }
          }
        }

        const newState = {
          chatHistoryMessages: messages,
          currentInputs: responses as Record<string, QuestionResponse>,
          currentQuestionId: nextQuestionId,
          formSchema: formSchema, // Add formSchema to the state
          // Set display state to ready if there's an unanswered question
          formDisplayState: (nextQuestionId
            ? "chatting_ai_ready"
            : "idle") as any,
        };

        set(newState);
      },
    }),
    {
      name: "formfiller-chat-store",
      partialize: (state) => ({
        // Only persist essential data, not UI state
        submissionId: state.submissionId,
        formId: state.formId,
      }),
      version: 1,
      // Skip hydration if there's no valid data to prevent conflicts
      skipHydration: false,
    },
  ),
);
