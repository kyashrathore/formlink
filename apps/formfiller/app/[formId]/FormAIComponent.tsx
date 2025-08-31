"use client";

import { Conversation } from "@/components/chat/conversation";
import { useChatStore } from "@/components/chat/store/useChatStore";
import { useChat } from "@ai-sdk/react";
import { Form } from "@formlink/schema";
import {
  Alert,
  AlertDescription,
  Button,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@formlink/ui";
import { DefaultChatTransport } from "ai";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import { useRedirect } from "../../hooks/useRedirect";
import { apiConfig } from "../../lib/api-config";
import type {
  ChatError,
  FormWithVersions,
  QueryDataForForm,
  QuestionResponse,
} from "../../lib/types";

type FormAIComponentProps = {
  formId: string;
  formSchema: Form;
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");

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
    hydrateFromHistory,
    handleFileUpload,
    setCurrentInput,
  } = store;

  const currentQuestionIdRef = useRef<string | null>(null);

  // Fetch chat history from backend and hydrate chat state
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      // If we don't have IDs or schema yet, nothing to do

      if (!submissionId || !formId || !formSchema) {
        setHistoryLoading(false);
        return;
      }

      try {
        setHistoryLoading(true);
        const res = await fetch(
          `/api/forms/${formId}/chat-history?submissionId=${submissionId}`,
        );
        if (res.ok) {
          const data: {
            messages: Array<{
              id: string;
              role: "user" | "assistant";
              content: string;
              createdAt?: string;
            }>;
            responses?: Record<string, unknown>;
            submissionStatus?: string;
            completedAt?: string;
          } = await res.json();

          // Keep messages in simple format - useChat will convert them
          const msgs = (data?.messages ?? []).map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
          }));
          const responses = (data as any)?.responses ?? {};
          if (!cancelled) {
            hydrateFromHistory(msgs as any, responses as any, formSchema); // Pass formSchema to prevent race condition

            // Check if submission is already completed
            if (data.submissionStatus === "completed") {
              setFormDisplayState("completed");
            }
          }
        } else {
          // Non-blocking: proceed with empty history
          if (!cancelled) {
            hydrateFromHistory([], {});
          }
        }
      } catch {
        if (!cancelled) {
          hydrateFromHistory([], {});
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [submissionId, formId, formSchema, setChatHistoryMessages]);

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

  // Debug: Check what URL is being used
  const chatAssistUrl = apiConfig.getChatAssistUrl();

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: chatAssistUrl,
    }),
    onFinish: (data: any) => {
      const message = data.message || data;
      processAssistantResponse();

      // Helper to apply a single tool result consistently
      const applyToolResult = (toolName: string, result: any) => {
        if (!result) return;

        if (toolName === "saveAnswer") {
          if (
            result?.saved &&
            result?.questionId &&
            result?.value !== undefined
          ) {
            setCurrentInput(result.questionId, result.value);
          }
          if (result?.nextQuestionId) {
            store.setCurrentQuestionId(result.nextQuestionId);
          }
        } else if (toolName === "presentQuestion") {
          const qid = result?.questionId;
          if (qid) {
            store.setCurrentQuestionId(qid);
          }
        } else if (toolName === "completeSubmission") {
          setFormDisplayState("completed");
          // Don't clear persisted state - allow refreshing completed forms to show history
        }
      };

      // Prefer AI SDK v5 parts[] shape
      const parts = Array.isArray(message?.parts) ? message.parts : [];

      if (parts.length > 0) {
        parts.forEach((part: any) => {
          // tool parts look like: { type: "tool-saveAnswer" | "tool-presentQuestion" | "tool-completeSubmission", state, input, output }
          if (typeof part?.type === "string" && part.type.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "");
            const result = part.output ?? part.result;
            applyToolResult(toolName, result);
          }
        });
      }

      // Back-compat: some transports expose toolInvocations
      if (Array.isArray(message?.toolInvocations)) {
        message.toolInvocations.forEach((toolCall: any) => {
          applyToolResult(toolCall.toolName, toolCall.result);
        });
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
      setFormDisplayState("chatting_ai_ready"); // Reset to ready state to allow retry
    },
  });

  const chatResult = chat;
  const { messages, setMessages, sendMessage, status } = chatResult;

  // Log what's actually available to debug

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    const historyLastMsg = chatHistoryMessages.at(-1);
    const newMsg = messages.at(-1);

    if (historyLastMsg?.id !== newMsg?.id) {
      setChatHistoryMessages(messages);
    }
  }, [messages, setChatHistoryMessages, chatHistoryMessages]);

  // After history fetch, hydrate chat messages if chat is empty
  useEffect(() => {
    if (
      !historyLoading &&
      messages.length === 0 &&
      chatHistoryMessages.length > 0
    ) {
      setMessages(chatHistoryMessages);
    }
  }, [historyLoading, messages, chatHistoryMessages, setMessages]);

  useEffect(() => {
    if (triggerUserMessageForSelection && sendMessage && formSchema) {
      const { questionId, value, displayText } = triggerUserMessageForSelection;

      const handleAutoSubmission = async () => {
        // Clear the trigger first thing in the async function to prevent re-triggers
        clearTriggerUserMessageForSelection();

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

          // AI SDK v5 sendMessage handles adding the user message automatically
          await sendMessage(
            {
              parts: [{ type: "text", text: displayText }],
            },
            { body: submissionBody },
          );

          setFormDisplayState("chatting_ai_loading");
        } catch (error) {
          console.error("Failed to save answer:", error);
          setErrorMessage("Failed to save your answer. Please try again.");
        }
      };

      handleAutoSubmission();
    }
  }, [
    triggerUserMessageForSelection, // ADD THIS!
    clearTriggerUserMessageForSelection, // ADD THIS!
    formDisplayState,
    chatHistoryMessages,
    messages,
    sendMessage,
    formSchema,
    submissionId,
    userId,
    setFormDisplayState,
    isTestSubmission,
    historyLoading,
    currentInputs,
    setCurrentInput,
  ]);

  const handleAISubmit = async (
    e?: React.FormEvent<HTMLFormElement> | React.KeyboardEvent,
  ) => {
    e?.preventDefault();

    if (!input.trim()) return;

    currentQuestionIdRef.current = currentQuestionId;
    setErrorMessage(null);

    // Derive the effective current question id from latest tool outputs, falling back to store/computed
    let derivedCurrentQ: string | null = null;
    try {
      const lastAssistant = [...messages]
        .reverse()
        .find((m: any) => m?.role === "assistant");
      const parts = Array.isArray((lastAssistant as any)?.parts)
        ? (lastAssistant as any).parts
        : [];
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (p?.type === "tool-presentQuestion" && p?.output?.questionId) {
          derivedCurrentQ = p.output.questionId;
          break;
        }
        if (p?.type === "tool-saveAnswer" && p?.output?.nextQuestionId) {
          derivedCurrentQ = p.output.nextQuestionId;
          break;
        }
      }
    } catch {
      // noop - best effort
    }

    // Fallbacks: store, then first unanswered based on currentInputs
    if (!derivedCurrentQ) {
      derivedCurrentQ = currentQuestionId ?? null;
    }
    if (!derivedCurrentQ && Array.isArray(formSchema?.questions)) {
      for (const q of formSchema.questions) {
        if (!Object.prototype.hasOwnProperty.call(currentInputs || {}, q.id)) {
          derivedCurrentQ = q.id;
          break;
        }
      }
    }

    // Keep store in sync if we computed a better value
    if (derivedCurrentQ && derivedCurrentQ !== currentQuestionId) {
      store.setCurrentQuestionId(derivedCurrentQ);
    }

    const body = {
      userInput: input,
      submissionBehavior: "manualUnclear", // User typed and hit enter
      currentQuestionId: derivedCurrentQ,
      formSchema,
      responses: currentInputs,
      submissionId,
      userId,
      isTestSubmission,
    };

    setFormDisplayState("chatting_ai_loading");

    await sendMessage({ parts: [{ type: "text", text: input }] }, { body });

    setInput(""); // Clear input after submission
  };

  const handleRetry = async () => {
    setErrorMessage(null);
    setShowRetry(false);
    // Resend the last message if available
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
        try {
          await sendMessage(
            {
              parts: [
                { type: "text", text: (lastUserMessage as any).content || "" },
              ],
            },
            { body },
          );
        } catch (error) {
          console.error("Failed to retry message:", error);
          setErrorMessage("Failed to resend message. Please try again.");
        }
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
    // Only initiate if:
    // 1. We're in the ready state
    // 2. We can send messages
    // 3. We haven't initiated yet
    // 4. History loading is complete
    // 5. There's no existing history or messages
    if (
      (formDisplayState === "idle" ||
        formDisplayState === "chatting_ai_ready") &&
      sendMessage &&
      !hasInitiatedRef.current &&
      !historyLoading && // Wait for history check to complete
      chatHistoryMessages.length === 0 && // No history exists
      messages.length === 0 // No current messages
    ) {
      hasInitiatedRef.current = true;

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

      const sendAutoStartMessage = async () => {
        try {
          await sendMessage(
            {
              parts: [{ type: "text", text: "Start the form" }],
            },
            { body: submissionBody },
          );
          setFormDisplayState("chatting_ai_loading");
        } catch (error) {
          console.error("Failed to send auto-start message:", error);
          setFormDisplayState("idle"); // Reset form state
          hasInitiatedRef.current = false; // Reset so user can try again
        }
      };

      sendAutoStartMessage();
    }
  }, [
    formDisplayState,
    chatHistoryMessages,
    messages,
    sendMessage,
    formSchema,
    submissionId,
    userId,
    setFormDisplayState,
    isTestSubmission,
    historyLoading,
  ]);

  // Resume conversation when history exists and there's a current question to present
  useEffect(() => {
    // Only resume if:
    // 1. History loading is complete
    // 2. We have existing history
    // 3. There's a current question to ask
    // 4. We're not in a loading or completed state already
    // 5. We haven't initiated this session yet
    if (
      !historyLoading &&
      chatHistoryMessages.length > 0 &&
      currentQuestionId &&
      formDisplayState === "idle" &&
      sendMessage &&
      !hasInitiatedRef.current
    ) {
      hasInitiatedRef.current = true;

      const resumeBody = {
        userInput: "Continue where we left off",
        submissionBehavior: "auto" as const,
        currentQuestionId,
        formSchema,
        responses: currentInputs,
        submissionId,
        userId,
        isTestSubmission,
      };

      const sendResumeMessage = async () => {
        try {
          await sendMessage(
            {
              parts: [{ type: "text", text: "Continue where we left off" }],
            },
            { body: resumeBody },
          );
          setFormDisplayState("chatting_ai_loading");
        } catch (error) {
          console.error("Failed to send resume message:", error);
          setFormDisplayState("idle");
          hasInitiatedRef.current = false;
        }
      };

      sendResumeMessage();
    }
  }, [
    historyLoading,
    chatHistoryMessages.length,
    currentQuestionId,
    formDisplayState,
    sendMessage,
    formSchema,
    currentInputs,
    submissionId,
    userId,
    isTestSubmission,
    setFormDisplayState,
  ]);

  // Calculate isChatActive - show chat interface when:
  // 1. We have chat history OR
  // 2. We're in a chatting state (ready or loading) OR
  // 3. History is still loading (to prevent flicker)
  const isChatActive =
    historyLoading || // Show chat UI while loading history
    chatHistoryMessages.length > 0 ||
    messages.length > 0 ||
    formDisplayState === "chatting_ai_ready" ||
    formDisplayState === "chatting_ai_loading" ||
    formDisplayState === "completed" ||
    formDisplayState === "saved";

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
              <div className="text-muted-foreground">
                {historyLoading
                  ? "Loading chat history..."
                  : "Initializing chat..."}
              </div>
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
                              onValueChange={(value: string) => {
                                const event = {
                                  target: { value },
                                } as React.ChangeEvent<HTMLInputElement>;
                                handleInputChange?.(event);
                              }}
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
