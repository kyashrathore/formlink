"use client";

import { Conversation } from "@/components/chat/conversation";
import { useChatStore } from "@/components/chat/store/useChatStore";
import { useChat } from "@ai-sdk/react";
import { Form, Question } from "@formlink/schema";
import type { UIForm } from "@formlink/ui";
import {
  Alert,
  AlertDescription,
  Button,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@formlink/ui";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useRedirect } from "../../hooks/useRedirect";
import { apiConfig } from "../../lib/api-config";
import type {
  QueryDataForForm,
  ChatError,
  InputChangeEvent,
  FormWithVersions,
  QuestionResponse,
} from "../../lib/types";
import type { Message } from "@ai-sdk/react";

type FormAIComponentProps = {
  formId: string;
  formSchema: Form;
  uiFormSchema: UIForm;
  isTestSubmission: boolean;
  queryDataForForm?: QueryDataForForm;
};

export default function FormAIComponent({
  formId,
  formSchema,
  isTestSubmission,
  queryDataForForm,
}: FormAIComponentProps) {
  const store = useChatStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [isInFallbackMode] = useState(false);
  const [userId] = useState<string | null>(null);

  const {
    formDisplayState,
    currentQuestionId,
    chatHistoryMessages,
    initializeForm,
    startFormInteraction,
    processAssistantResponse,
    setFormDisplayState,
    setLastError,
    submissionId,
    currentInputs,
    triggerUserMessageForSelection,
    clearTriggerUserMessageForSelection,
    setChatHistoryMessages,
    handleFileUpload,
    setCurrentInput,
  } = store;

  const currentQuestionIdRef = useRef<string | null>(null);

  // Note: In AI mode, all saves are handled by the chat-assist route
  // This function is kept for potential future use but is not called in AI mode

  useEffect(() => {
    if (!submissionId || store.formId !== formId) {
      const versionToUse =
        (formSchema as FormWithVersions).current_published_version_id ||
        (formSchema as FormWithVersions).current_draft_version_id ||
        "";
      // Convert queryDataForForm to proper QuestionResponse format
      const initialData: Record<string, QuestionResponse> = {};
      if (queryDataForForm) {
        Object.entries(queryDataForForm).forEach(([key, value]) => {
          // Convert boolean to string for compatibility
          if (typeof value === "boolean") {
            initialData[key] = value.toString();
          } else if (value !== undefined && value !== null) {
            initialData[key] = value;
          }
        });
      }

      initializeForm(
        formSchema,
        formId,
        versionToUse,
        true,
        initialData,
        isTestSubmission,
      );
    }
  }, [
    formId,
    formSchema,
    submissionId,
    isTestSubmission,
    queryDataForForm,
    initializeForm,
    store.formId,
  ]);

  const chat = useChat({
    api: apiConfig.getChatAssistUrl(),
    initialMessages: chatHistoryMessages,
    body: {
      submissionId,
      formSchema,
      responses: currentInputs,
      userId,
      currentQuestionId,
      isTestSubmission,
    },
    onFinish: (message: Message) => {
      processAssistantResponse();

      // Check for tool invocations
      if (message.toolInvocations) {
        // Update local state for any saveAnswer tool calls
        message.toolInvocations.forEach((toolCall) => {
          if (
            toolCall.toolName === "saveAnswer" &&
            toolCall.state === "result"
          ) {
            const result = toolCall.result;
            if (
              result?.saved &&
              result?.questionId &&
              result?.answer !== undefined
            ) {
              setCurrentInput(result.questionId, result.answer);
            }
          }
        });

        // Check for completion
        if (
          message.toolInvocations.some(
            (t) => t.toolName === "completeSubmission",
          )
        ) {
          setFormDisplayState("completed");
        }
      }

      // Extract questionId from the message content if present
      try {
        // Look for all question links in the message
        const questionLinkRegex = /\[question\]\([^)]+\?qId=([^)]+)\)/g;
        const matches = [
          ...(message.content?.matchAll(questionLinkRegex) || []),
        ];

        if (matches.length > 0) {
          // Use the last question link found (most likely the current question)
          const lastMatch = matches[matches.length - 1];
          const newQuestionId = lastMatch?.[1];

          // Validate that this question exists in the form schema
          if (newQuestionId) {
            const questionExists = formSchema?.questions?.some(
              (q: Question) => q.id === newQuestionId,
            );

            if (questionExists) {
              store.setCurrentQuestionId(newQuestionId);
            } else {
              console.warn(
                `[FormAIComponent] Question ID ${newQuestionId} not found in form schema`,
              );
            }
          }
        }
      } catch (error) {
        console.error(
          "[FormAIComponent] Error extracting question ID from AI response:",
          error,
        );
      }

      setErrorMessage(null);
      setShowRetry(false);
    },
    onError: (error: ChatError) => {
      console.error("Chat error:", error);

      // Handle different error types
      if (error.message?.includes("Rate limit")) {
        setErrorMessage(
          "You're going too fast! Please wait a moment before continuing.",
        );
      } else if (error.message?.includes("Network")) {
        setErrorMessage(
          "Connection issue. Please check your internet and try again.",
        );
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }

      setShowRetry(true);
      setLastError(error.message);
    },
  });

  const {
    messages,
    setMessages,
    append,
    input,
    handleInputChange,
    handleSubmit,
    status,
  } = chat;

  useEffect(() => {
    if (
      formDisplayState === "idle" &&
      chatHistoryMessages.length === 0 &&
      messages.length > 0
    ) {
      setMessages([]);
    }
  }, [formDisplayState, chatHistoryMessages, messages, setMessages]);

  useEffect(() => {
    const historyLastMsg = chatHistoryMessages.at(-1);
    const newMsg = messages.at(-1);

    if (historyLastMsg?.id !== newMsg?.id) {
      setChatHistoryMessages(messages);
    }
  }, [messages, setChatHistoryMessages, chatHistoryMessages]);

  useEffect(() => {
    if (triggerUserMessageForSelection && append && formSchema) {
      const { questionId, value, displayText } = triggerUserMessageForSelection;

      const handleAutoSubmission = async () => {
        try {
          // In AI mode, the chat-assist route handles all saves
          // Don't save directly to database

          // Update local state
          setCurrentInput(questionId, value);

          // Find next question (but don't update currentQuestionId yet)
          const updatedInputs = { ...currentInputs, [questionId]: value };

          // Don't update currentQuestionId here - let the QuestionWrapper handle it
          // when the AI presents the next question
          // if (nextQuestion) {
          //   store.setCurrentQuestionId(nextQuestion.id);
          // }

          const newUserMessage = {
            id: uuidv4(),
            role: "user" as const,
            content: displayText || value,
            createdAt: new Date(),
          };

          // Determine submission behavior based on how the answer was submitted
          const submissionBehavior = "auto"; // User clicked on an input component

          const submissionBody = {
            userInput: value,
            submissionBehavior,
            currentQuestionId: questionId, // The question that was just answered
            justSavedAnswer: { questionId, value }, // Include info about saved answer
            formSchema,
            responses: updatedInputs, // Use updated inputs that include the new answer
            submissionId,
            userId,
            isTestSubmission,
          };

          append(newUserMessage, { body: submissionBody });
          setFormDisplayState("chatting_ai_loading");
        } catch (error) {
          console.error("Failed to save answer:", error);
          setErrorMessage("Failed to save your answer. Please try again.");
        } finally {
          clearTriggerUserMessageForSelection();
        }
      };

      handleAutoSubmission();
    }
  }, [
    triggerUserMessageForSelection,
    clearTriggerUserMessageForSelection,
    append,
    formSchema,
    currentInputs,
    setFormDisplayState,
    setCurrentInput,
    submissionId,
    userId,
    isTestSubmission,
  ]);

  const handleAISubmit = (
    e?: React.FormEvent<HTMLFormElement> | React.KeyboardEvent,
  ) => {
    e?.preventDefault();

    if (!input.trim()) return;

    currentQuestionIdRef.current = currentQuestionId;
    setErrorMessage(null);

    const body = {
      userInput: input,
      submissionBehavior: "manualUnclear", // User typed and hit enter
      currentQuestionId,
      formSchema,
      responses: currentInputs,
      submissionId,
      userId,
      isTestSubmission,
    };

    handleSubmit(e, { body });
    setFormDisplayState("chatting_ai_loading");
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setShowRetry(false);
    // Resend the last message
    if (messages.length > 0) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage && input) {
        const body = {
          userInput: input,
          submissionBehavior: "manualUnclear",
          currentQuestionId,
          formSchema,
          responses: currentInputs,
          submissionId,
          userId,
          isTestSubmission,
        };
        append(lastUserMessage, { body });
      }
    }
  };

  const isFormSaved = formDisplayState === "saved";
  const isFormCompleted = formDisplayState === "completed";

  const formRedirectUrl =
    formSchema?.settings?.redirectOnSubmissionUrl &&
    typeof formSchema.settings.redirectOnSubmissionUrl === "string"
      ? formSchema.settings.redirectOnSubmissionUrl
      : undefined;

  useRedirect(isFormSaved, formRedirectUrl);

  // Track if we've sent the initial message
  const hasInitiatedRef = useRef(false);

  // Auto-start form when component mounts
  useEffect(() => {
    if (submissionId && formDisplayState === "idle") {
      startFormInteraction();
    }
  }, [submissionId, formDisplayState, startFormInteraction]);

  // Send initial message to AI when form interaction starts
  useEffect(() => {
    if (
      formDisplayState === "chatting_ai_ready" &&
      chatHistoryMessages.length === 0 &&
      append &&
      !hasInitiatedRef.current
    ) {
      hasInitiatedRef.current = true;

      // Send a hidden user message to initiate the form
      const initiationMessage = {
        id: uuidv4(),
        role: "user" as const,
        content: "Start the form",
        createdAt: new Date(),
        hidden: true, // Mark as hidden so it won't be displayed
      };

      const submissionBody = {
        userInput: "Start the form",
        submissionBehavior: "auto" as const,
        currentQuestionId: null,
        formSchema,
        responses: {},
        submissionId,
        userId,
        isTestSubmission,
      };

      append(initiationMessage, { body: submissionBody });
      setFormDisplayState("chatting_ai_loading");
    }
  }, [
    formDisplayState,
    chatHistoryMessages,
    append,
    formSchema,
    submissionId,
    userId,
    setFormDisplayState,
    isTestSubmission,
  ]);

  // Calculate isChatActive early
  const isChatActive = !(
    formDisplayState === "idle" ||
    (chatHistoryMessages.length === 0 &&
      (formDisplayState === "displaying_question_classical" ||
        formDisplayState === "chatting_ai_ready"))
  );

  if (!submissionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <span>Loading form...</span>
      </div>
    );
  }

  const showThankYou = isFormSaved || isFormCompleted;

  return (
    <div className="flex flex-col h-full">
      {errorMessage && (
        <Alert
          variant="destructive"
          className="mx-4 mt-4 border-red-200 bg-red-50"
        >
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {errorMessage}
            {showRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="ml-4"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {isInFallbackMode && (
        <Alert
          variant="default"
          className="mx-4 mt-2 border-yellow-200 bg-yellow-50"
        >
          <AlertDescription className="text-yellow-800">
            Running in simplified mode due to technical issues.
          </AlertDescription>
        </Alert>
      )}
      <AnimatePresence>
        {!isChatActive ? (
          <div key="loading-screen" className="h-full">
            <div className="flex flex-col items-center justify-center h-full p-4 text-center lg:max-w-3xl md:max-w-3xl mx-auto">
              <div className="text-muted-foreground">Loading form...</div>
            </div>
          </div>
        ) : (
          <div key="chat-interface">
            <div className="relative flex flex-col h-full w-full overflow-hidden">
              <div className="overflow-hidden">
                <Conversation
                  messages={messages}
                  status={status}
                  data={null}
                  handleFileUpload={handleFileUpload}
                />
              </div>

              <AnimatePresence>
                {!showThankYou && (
                  <motion.div key="prompt-input">
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
                      <div className="lg:max-w-3xl md:max-w-3xl mx-auto w-full">
                        <div className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1">
                          <form onSubmit={handleAISubmit}>
                            <PromptInput
                              className="border-input bg-popover relative z-10 overflow-hidden border p-0 pb-2 shadow-xs backdrop-blur-xl"
                              value={input}
                              onValueChange={(value: string) =>
                                handleInputChange?.({
                                  target: { value },
                                } as InputChangeEvent)
                              }
                              onSubmit={handleAISubmit}
                            >
                              <PromptInputTextarea
                                placeholder="Your answer..."
                                className="mt-2 ml-2 min-h-[44px] text-base leading-[1.3] sm:text-base md:text-base !bg-popover"
                              />
                              <PromptInputActions className="mt-5 w-full justify-end px-2">
                                <PromptInputAction tooltip="Send" className="">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-9 w-9 cursor-pointer rounded-full transition-all duration-300 ease-out"
                                    disabled={
                                      !input.trim() ||
                                      status === "streaming" ||
                                      !submissionId
                                    }
                                    type="submit"
                                    aria-label="Send answer"
                                  >
                                    <ArrowRight className="size-4" />
                                  </Button>
                                </PromptInputAction>
                              </PromptInputActions>
                            </PromptInput>
                          </form>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
