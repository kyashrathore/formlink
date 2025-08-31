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
import { useFormSession } from "../../hooks/useFormSession";
import { useRedirect } from "../../hooks/useRedirect";
import { apiConfig, apiServices } from "../../lib/api-config";
import type {
  ChatError,
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
  const [input, setInput] = useState("");

  // Convert queryDataForForm to proper QuestionResponse format
  const normalizeQueryData = (
    queryData?: QueryDataForForm,
  ): Record<string, QuestionResponse> => {
    const initialData: Record<string, QuestionResponse> = {};
    if (queryData) {
      Object.entries(queryData).forEach(([key, value]) => {
        // Convert boolean to string for compatibility
        if (typeof value === "boolean") {
          initialData[key] = value.toString();
        } else if (value !== undefined && value !== null) {
          initialData[key] = value;
        }
      });
    }
    return initialData;
  };

  const { isLoading } = useFormSession({
    formId,
    formSchema,
    initialData: normalizeQueryData(queryDataForForm),
    isTestSubmission,
  });

  const {
    formDisplayState,
    currentQuestionId,
    chatHistoryMessages,
    processAssistantResponse,
    setFormDisplayState,
    setLastError,
    currentInputs,
    setChatHistoryMessages,
    setCurrentInput,
  } = store;

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
        if (!result || typeof toolName !== "string") return;

        // Validate tool name is expected
        const validToolNames = [
          "saveAnswer",
          "presentQuestion",
          "completeSubmission",
        ];
        if (!validToolNames.includes(toolName)) {
          console.warn(`Unknown tool name: ${toolName}`);
          return;
        }

        try {
          if (toolName === "saveAnswer") {
            if (
              result?.saved &&
              typeof result?.questionId === "string" &&
              result?.questionId.trim() &&
              result?.value !== undefined
            ) {
              setCurrentInput(result.questionId, result.value);
            }
            if (
              typeof result?.nextQuestionId === "string" &&
              result.nextQuestionId.trim()
            ) {
              store.setCurrentQuestionId(result.nextQuestionId);
            }
          } else if (toolName === "presentQuestion") {
            const qid = result?.questionId;
            if (typeof qid === "string" && qid.trim()) {
              store.setCurrentQuestionId(qid);
            }
          } else if (toolName === "completeSubmission") {
            setFormDisplayState("completed");
            // Don't clear persisted state - allow refreshing completed forms to show history
          }
        } catch (error) {
          console.error(`Error applying tool result for ${toolName}:`, error);
        }
      };

      // Prefer AI SDK v5 parts[] shape
      const parts = Array.isArray(message?.parts) ? message.parts : [];

      if (parts.length > 0) {
        parts.forEach((part: any) => {
          try {
            // tool parts look like: { type: "tool-saveAnswer" | "tool-presentQuestion" | "tool-completeSubmission", state, input, output }
            if (
              typeof part?.type === "string" &&
              part.type.startsWith("tool-")
            ) {
              const toolName = part.type.replace("tool-", "");
              const result = part.output ?? part.result;
              applyToolResult(toolName, result);
            }
          } catch (error) {
            console.error("Error processing part:", part, error);
          }
        });
      }

      // Back-compat: some transports expose toolInvocations
      if (Array.isArray(message?.toolInvocations)) {
        message.toolInvocations.forEach((toolCall: any) => {
          try {
            if (toolCall?.toolName && (toolCall.result || toolCall.output)) {
              applyToolResult(
                toolCall.toolName,
                toolCall.result ?? toolCall.output,
              );
            }
          } catch (error) {
            console.error("Error processing toolInvocation:", toolCall, error);
          }
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

  // Direct selection submission helper
  async function submitSelection(
    questionId: string,
    value: QuestionResponse,
    displayText: string,
  ): Promise<void> {
    // 1) optimistic local update
    setCurrentInput(questionId, value);

    // 2) assemble body (ensure responses include the latest value)
    const updatedResponses = { ...currentInputs, [questionId]: value };
    const body = {
      userInput: value, // structured value (string/number/object), not used for chat rendering
      submissionBehavior: "auto" as const,
      currentQuestionId: store.currentQuestionId, // authoritative from last tool
      justSavedAnswer: { questionId, value },
      formSchema, // keep as-is for now
      responses: updatedResponses,
      submissionId: store.submissionId,
      userId: null,
      isTestSubmission,
    };

    // 3) guarded send
    setFormDisplayState("chatting_ai_loading");
    await sendMessage(
      { parts: [{ type: "text", text: displayText }] }, // chat-visible text
      { body },
    );
  }

  useEffect(() => {
    const historyLastMsg = chatHistoryMessages.at(-1);
    const newMsg = messages.at(-1);

    if (historyLastMsg?.id !== newMsg?.id) {
      setChatHistoryMessages(messages);
    }
  }, [messages, setChatHistoryMessages, chatHistoryMessages]);

  // After history fetch, hydrate chat messages if chat is empty
  useEffect(() => {
    if (!isLoading && messages.length === 0 && chatHistoryMessages.length > 0) {
      setMessages(chatHistoryMessages);
    }
  }, [isLoading, messages, chatHistoryMessages, setMessages]);

  async function handleAISubmit(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault();
    if (!input.trim()) return;

    setErrorMessage(null);

    const body = {
      userInput: input,
      submissionBehavior: "manualUnclear" as const,
      currentQuestionId: store.currentQuestionId ?? null, // do not guess from parts
      formSchema,
      responses: currentInputs,
      submissionId: store.submissionId,
      userId: null,
      isTestSubmission,
    };

    setFormDisplayState("chatting_ai_loading");
    await sendMessage({ parts: [{ type: "text", text: input }] }, { body });
    setInput("");
  }

  // File upload handler that calls submitSelection directly
  async function handleFileUploadWithSubmission(
    questionId: string,
    file: File | File[],
  ): Promise<void> {
    // Handle case where file is passed as an array (from onFileSelect callback)
    const actualFile: File = Array.isArray(file)
      ? (file[0] as File)
      : (file as File);

    if (!store.formId || !store.submissionId) {
      setErrorMessage("Cannot upload file: missing form or submission ID.");
      return;
    }

    setFormDisplayState("uploading_file");

    const formData = new FormData();
    formData.append("file", actualFile);
    formData.append("formId", store.formId);
    formData.append("submissionId", store.submissionId);
    formData.append("questionId", questionId);

    try {
      const result = await apiServices.uploadFile(formData);
      const { url, fileName, fileSize } = result;

      const fileDetails = {
        url: url,
        name: fileName,
        size: fileSize,
      };

      // Call submitSelection directly instead of using the trigger flag
      await submitSelection(
        questionId,
        fileDetails,
        `Uploaded file: ${fileName}`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unknown error occurred during file upload.",
      );
      // Reset UI state on upload failure; success path transitions via submitSelection/onFinish
      setFormDisplayState("chatting_ai_ready");
    } finally {
      // Do not override chat state here; submitSelection/onFinish manage it
    }
  }

  const handleRetry = async () => {
    setErrorMessage(null);
    setShowRetry(false);
    // Resend the last message if available
    if (messages.length > 0) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage) {
        const retryText = (lastUserMessage as any).content || "";
        const body = {
          userInput: retryText,
          submissionBehavior: "manualUnclear",
          currentQuestionId: store.currentQuestionId ?? null,
          formSchema,
          responses: currentInputs,
          submissionId: store.submissionId,
          userId: null,
          isTestSubmission,
        };
        try {
          await sendMessage(
            { parts: [{ type: "text", text: retryText }] },
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

  // One-shot kickoff/resume after isLoading
  useEffect(() => {
    if (isLoading || !sendMessage) return;
    if (!store.submissionId) return;

    const hasHistory = (chatHistoryMessages?.length ?? 0) > 0;

    if (
      !hasInitiatedRef.current &&
      !hasHistory &&
      (formDisplayState === "idle" || formDisplayState === "chatting_ai_ready")
    ) {
      // auto-start
      hasInitiatedRef.current = true;
      const submissionBody = {
        userInput: "Start the form",
        submissionBehavior: "auto" as const,
        currentQuestionId: null,
        formSchema,
        responses: {},
        submissionId: store.submissionId,
        userId: null,
        isTestSubmission,
      };

      setFormDisplayState("chatting_ai_loading");
      sendMessage(
        { parts: [{ type: "text", text: "Start the form" }] },
        { body: submissionBody },
      ).catch((error) => {
        console.error("Failed to send auto-start message:", error);
        setFormDisplayState("idle");
        hasInitiatedRef.current = false;
      });
      return;
    }

    if (
      !hasInitiatedRef.current &&
      hasHistory &&
      currentQuestionId &&
      formDisplayState === "idle"
    ) {
      // resume
      hasInitiatedRef.current = true;
      const resumeBody = {
        userInput: "Continue where we left off",
        submissionBehavior: "auto" as const,
        currentQuestionId,
        formSchema,
        responses: currentInputs,
        submissionId: store.submissionId,
        userId: null,
        isTestSubmission,
      };

      setFormDisplayState("chatting_ai_loading");
      sendMessage(
        { parts: [{ type: "text", text: "Continue where we left off" }] },
        { body: resumeBody },
      ).catch((error) => {
        console.error("Failed to send resume message:", error);
        setFormDisplayState("idle");
        hasInitiatedRef.current = false;
      });
    }
  }, [
    isLoading,
    sendMessage,
    store.submissionId,
    formDisplayState,
    currentQuestionId,
    chatHistoryMessages,
    currentInputs,
    formSchema,
    isTestSubmission,
    setFormDisplayState,
  ]);

  // Calculate isChatActive - show chat interface when:
  // 1. We have chat history OR
  // 2. We're in a chatting state (ready or loading) OR
  // 3. History is still loading (to prevent flicker)
  const isChatActive =
    isLoading || // Show chat UI while loading history
    chatHistoryMessages.length > 0 ||
    messages.length > 0 ||
    formDisplayState === "chatting_ai_ready" ||
    formDisplayState === "chatting_ai_loading" ||
    formDisplayState === "completed" ||
    formDisplayState === "saved";

  if (!store.submissionId) {
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
                {isLoading ? "Loading chat history..." : "Initializing chat..."}
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
                  handleFileUpload={handleFileUploadWithSubmission}
                  onSubmitSelection={submitSelection}
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
                              onValueChange={(value: string) => setInput(value)}
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
                                      !store.submissionId
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
