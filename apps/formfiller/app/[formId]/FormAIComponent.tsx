"use client";

import { AiIntroScreen } from "@/components/chat/AiIntroScreen";
import { Conversation } from "@/components/chat/conversation";
import { useChatStore } from "@/components/chat/store/useChatStore";
import { debugLog } from "@/components/chat/utils/debug";
import { useChat } from "@ai-sdk-tools/store";
import { Form } from "@formlink/schema";
import { Alert, AlertDescription, Button } from "@formlink/ui";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@formlink/ui/ai-elements";
import { DefaultChatTransport } from "ai";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useFormSession } from "../../hooks/useFormSession";
import { useRedirect } from "../../hooks/useRedirect";
import { apiConfig, apiServices } from "../../lib/api-config";
import type {
  ChatError,
  QueryDataForForm,
  QuestionResponse,
} from "../../lib/types";
// Chat state is managed by @ai-sdk-tools/store globally to avoid prop-driven re-renders

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [isInFallbackMode] = useState(false);
  const [input, setInput] = useState("");
  const [introDismissed, setIntroDismissed] = useState(false);
  const [awaitingFirstResponse, setAwaitingFirstResponse] = useState(false);

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

  const selected = useChatStore(
    useShallow((state) => ({
      formDisplayState: state.formDisplayState,
      currentQuestionId: state.currentQuestionId,
      chatHistoryMessages: state.chatHistoryMessages,
      processAssistantResponse: state.processAssistantResponse,
      setFormDisplayState: state.setFormDisplayState,
      setLastError: state.setLastError,
      currentInputs: state.currentInputs,
      setChatHistoryMessages: state.setChatHistoryMessages,
      setCurrentInput: state.setCurrentInput,
      setCurrentQuestionId: state.setCurrentQuestionId,
      submissionId: state.submissionId,
      formId: state.formId,
    })),
  );

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
    setCurrentQuestionId,
    submissionId: storeSubmissionId,
    formId: storeFormId,
  } = selected;

  const submissionId = storeSubmissionId;

  // Helper to apply a single tool result consistently (reused across live processing and final onFinish)
  const applyToolResult = React.useCallback(
    (toolName: string, result: any) => {
      if (!result || typeof toolName !== "string") return;

      const validToolNames = ["saveAnswer", "completeSubmission"];
      if (!validToolNames.includes(toolName)) {
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
            setCurrentQuestionId(result.nextQuestionId);
          }
        } else if (toolName === "completeSubmission") {
          setFormDisplayState("completed");
          // Don't clear persisted state - allow refreshing completed forms to show history
        }
      } catch {
        // swallow applyToolResult errors; UI shows status via state
      }
    },
    [setCurrentInput, setCurrentQuestionId, setFormDisplayState],
  );

  // Debug: Check what URL is being used
  const chatAssistUrl = apiConfig.getChatAssistUrl();

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: chatAssistUrl,
    }),
    onFinish: (data: any) => {
      debugLog("chat-onFinish", {
        partsCount: Array.isArray(data?.message?.parts)
          ? data.message.parts.length
          : Array.isArray((data as any)?.parts)
            ? (data as any).parts.length
            : undefined,
      });
      const message = data.message || data;
      processAssistantResponse();

      // Prefer AI SDK v5 parts[] shape
      const parts = Array.isArray(message?.parts) ? message.parts : [];

      if (parts.length > 0) {
        parts.forEach((part: any) => {
          try {
            // tool parts look like: { type: "tool-saveAnswer" | "tool-completeSubmission", state, input, output }
            if (
              typeof part?.type === "string" &&
              part.type.startsWith("tool-")
            ) {
              const toolName = part.type.replace("tool-", "");
              const result = part.output ?? part.result;
              applyToolResult(toolName, result);
            }
          } catch {
            // swallow part processing errors
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
          } catch {
            // swallow tool invocation errors
          }
        });
      }

      setErrorMessage(null);
      setShowRetry(false);
    },
    onError: (error: ChatError) => {
      debugLog("chat-onError", { message: error?.message });

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
  const { setMessages, sendMessage, status } = chatResult;

  // Keep FormAIComponent detached from chat message updates to avoid re-rendering the whole tree.

  useEffect(() => {
    debugLog("chat-status", { status });
  }, [status]);

  // Slot bridging is handled inside Conversation to localize reactivity.

  // Log status changes only when they change (reduce noise)
  const prevStatusRef = React.useRef<typeof status | null>(null);
  React.useEffect(() => {
    if (prevStatusRef.current !== status) {
      debugLog("status-change", { from: prevStatusRef.current, to: status });
      prevStatusRef.current = status;
    }
  }, [status]);

  const lifecycleLogRef = React.useRef<{
    status: string;
    lastAssistantId: string | null;
    lastAssistantHasSlot: boolean;
    messageCount: number;
  }>({
    status,
    lastAssistantId: null,
    lastAssistantHasSlot: false,
    messageCount: 0,
  });

  React.useEffect(() => {
    const nextSnapshot = {
      status,
      lastAssistantId: null,
      lastAssistantHasSlot: false,
      messageCount: 0,
    };
    const prevSnapshot = lifecycleLogRef.current;
    if (
      prevSnapshot.status !== nextSnapshot.status ||
      prevSnapshot.lastAssistantId !== nextSnapshot.lastAssistantId ||
      prevSnapshot.lastAssistantHasSlot !== nextSnapshot.lastAssistantHasSlot ||
      prevSnapshot.messageCount !== nextSnapshot.messageCount
    ) {
      debugLog("chat-lifecycle", nextSnapshot);
      lifecycleLogRef.current = nextSnapshot;
    }
  }, [status]);

  // Live-apply tool results while streaming to keep UI state in sync without
  // waiting for onFinish (prevents spinners from lingering and renders inputs ASAP).
  const processedToolKeysRef = React.useRef<Set<string>>(new Set());
  // Live tool application moved into Conversation (localizes updates to message subtree).

  // Welcome assistant injection disabled for AI intro + hidden-start flow.

  // Direct selection submission helper
  const submitSelection = React.useCallback(
    async function submitSelection(
      questionId: string,
      value: QuestionResponse,
      displayText: string,
    ): Promise<void> {
      debugLog("sendMessage:submitSelection", {
        questionId,
        displayText,
      });
      // 1) optimistic local update
      setCurrentInput(questionId, value);

      // 2) assemble body (ensure responses include the latest value)
      const updatedResponses = { ...currentInputs, [questionId]: value };
      const body = {
        userInput: value, // structured value (string/number/object), not used for chat rendering
        submissionBehavior: "auto" as const,
        currentQuestionId,
        justSavedAnswer: { questionId, value },
        formSchema, // keep as-is for now
        responses: updatedResponses,
        submissionId,
        userId: null,
        isTestSubmission,
        initiate: false,
        suppressUserMessagePersistence: false,
        startMode: null,
      };

      // 3) guarded send with small delay for UX parity
      await new Promise<void>((resolve, reject) => {
        const DELAY_MS = 250;
        setTimeout(() => {
          try {
            setFormDisplayState("chatting_ai_loading");
            // Track last user-visible text for retry UX
            lastUserTextRef.current = displayText;
            Promise.resolve(
              sendMessage(
                { parts: [{ type: "text", text: displayText }] },
                { body },
              ),
            )
              .then(() => resolve())
              .catch(reject);
          } catch (err) {
            reject(err as any);
          }
        }, DELAY_MS);
      });
    },
    [
      setCurrentInput,
      currentInputs,
      currentQuestionId,
      formSchema,
      submissionId,
      isTestSubmission,
      setFormDisplayState,
      sendMessage,
    ],
  );

  // Keep lightweight: let Conversation sync message history as it renders.

  // After history fetch, hydrate chat messages once
  const hasHydratedFromHistoryRef = useRef(false);
  useEffect(() => {
    if (
      !isLoading &&
      chatHistoryMessages.length > 0 &&
      !hasHydratedFromHistoryRef.current
    ) {
      setMessages(chatHistoryMessages);
      hasHydratedFromHistoryRef.current = true;
    }
  }, [isLoading, chatHistoryMessages, setMessages]);

  async function handleAISubmit(message: any) {
    if (!input.trim()) return;

    setErrorMessage(null);

    // Capture and clear immediately for snappy UX
    const userText = input;
    setInput("");
    lastUserTextRef.current = userText;

    const body = {
      userInput: userText,
      submissionBehavior: "manualUnclear" as const,
      currentQuestionId: currentQuestionId ?? null,
      formSchema,
      responses: currentInputs,
      submissionId,
      userId: null,
      isTestSubmission,
      initiate: false,
      suppressUserMessagePersistence: false,
      startMode: null,
    };

    setFormDisplayState("chatting_ai_loading");
    try {
      debugLog("sendMessage:manualUnclear", { textLen: userText.length });
      await sendMessage(
        { parts: [{ type: "text", text: userText }] },
        { body },
      );
    } catch (err) {
      // Restore input on failure so the user can retry/edit
      setInput(userText);
      throw err;
    }
  }

  // File upload handler that calls submitSelection directly
  const handleFileUploadWithSubmission = React.useCallback(
    async function handleFileUploadWithSubmission(
      questionId: string,
      file: File | File[],
    ): Promise<void> {
      // Handle case where file is passed as an array (from onFileSelect callback)
      const actualFile: File = Array.isArray(file)
        ? (file[0] as File)
        : (file as File);

      if (!formId || !submissionId) {
        setErrorMessage("Cannot upload file: missing form or submission ID.");
        return;
      }

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
    },
    [
      formId,
      submissionId,
      setFormDisplayState,
      setErrorMessage,
      submitSelection,
    ],
  );

  const lastUserTextRef = useRef<string | null>(null);

  const handleRetry = React.useCallback(async () => {
    setErrorMessage(null);
    setShowRetry(false);
    // Retry the last explicitly sent user text (tracked locally)
    if (lastUserTextRef.current) {
      const retryText = lastUserTextRef.current;
      const body = {
        userInput: retryText,
        submissionBehavior: "manualUnclear",
        currentQuestionId: currentQuestionId ?? null,
        formSchema,
        responses: currentInputs,
        submissionId,
        userId: null,
        isTestSubmission,
        initiate: false,
        suppressUserMessagePersistence: false,
        startMode: null,
      };
      try {
        await sendMessage(
          { parts: [{ type: "text", text: retryText }] },
          { body },
        );
      } catch {
        setErrorMessage("Failed to resend message. Please try again.");
      }
    } else {
      setErrorMessage("No previous message to retry.");
    }
  }, [
    currentInputs,
    currentQuestionId,
    formSchema,
    isTestSubmission,
    sendMessage,
    setErrorMessage,
    submissionId,
  ]);

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
  const hasStartedRef = useRef(false);

  // One-shot kickoff/resume after isLoading (no auto-start message)
  useEffect(() => {
    if (isLoading) return;
    if (!submissionId) return;

    const hasHistory = (chatHistoryMessages?.length ?? 0) > 0;

    if (
      !hasInitiatedRef.current &&
      hasHistory &&
      currentQuestionId &&
      formDisplayState === "idle"
    ) {
      // resume without synthetic message
      hasInitiatedRef.current = true;
      setFormDisplayState("chatting_ai_ready");
    }
  }, [
    isLoading,
    submissionId,
    formDisplayState,
    currentQuestionId,
    chatHistoryMessages,
    setFormDisplayState,
  ]);

  // Explicit chat start handler: trigger backend but hide the synthetic user message
  const handleChatStart = async () => {
    if (!sendMessage || !submissionId) return;
    hasStartedRef.current = true;
    setIntroDismissed(true);
    hasInitiatedRef.current = true;
    setAwaitingFirstResponse(true);
    const startModeValue: "start" | "resume" =
      chatHistoryMessages.length > 0 ? "resume" : "start";
    const submissionBody = {
      userInput: "Start the form",
      submissionBehavior: "auto" as const,
      currentQuestionId: null,
      formSchema,
      responses: {},
      submissionId,
      userId: null,
      isTestSubmission,
      initiate: true,
      suppressUserMessagePersistence: true,
      startMode: startModeValue,
    };
    setFormDisplayState("chatting_ai_loading");
    try {
      lastUserTextRef.current = "Start the form";
      await sendMessage(
        { parts: [{ type: "text", text: "Start the form" }] },
        { body: submissionBody },
      );
      // Hide the user message we just added so it doesn't show up in chat
      setMessages((prev) => {
        const arr = [...prev];
        for (let i = arr.length - 1; i >= 0; i--) {
          if ((arr[i] as any).role === "user") {
            (arr[i] as any).hidden = true;
            break;
          }
        }
        return arr;
      });
    } catch {
      setFormDisplayState("idle");
      hasInitiatedRef.current = false;
    }
  };

  // Always render chat UI
  const isChatActive = true;

  if (!submissionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <span>Loading form...</span>
      </div>
    );
  }

  const showThankYou = isFormSaved || isFormCompleted;

  const noHistory = (chatHistoryMessages?.length ?? 0) === 0;
  const introPending = !introDismissed && !isLoading && noHistory;

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
        {
          <div key="chat-interface">
            <div className="relative flex flex-col h-full w-full overflow-hidden">
              <div className="overflow-hidden">
                <Conversation
                  data={null}
                  handleFileUpload={handleFileUploadWithSubmission}
                  onSubmitSelection={submitSelection}
                  onToolResult={applyToolResult}
                  onFirstAssistant={() => setAwaitingFirstResponse(false)}
                  introBlock={
                    introPending ? (
                      <AiIntroScreen
                        formSchema={formSchema}
                        onStart={handleChatStart}
                      />
                    ) : undefined
                  }
                />
              </div>

              <AnimatePresence>
                {!showThankYou && !introPending && !awaitingFirstResponse && (
                  <motion.div key="prompt-input">
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
                      <div className="lg:max-w-3xl md:max-w-3xl mx-auto w-full">
                        <div className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1">
                          <PromptInput
                            className="border-input bg-popover relative z-10 overflow-hidden border p-0 pb-2 shadow-xs backdrop-blur-xl"
                            onSubmit={handleAISubmit}
                          >
                            <PromptInputTextarea
                              placeholder="Your answer..."
                              className="mt-2 ml-2 min-h-[44px] text-base leading-[1.3] sm:text-base md:text-base !bg-popover"
                              value={input}
                              onChange={(
                                e: React.ChangeEvent<HTMLTextAreaElement>,
                              ) => setInput(e.target.value)}
                            />
                            <PromptInputTools className="mt-5 w-full justify-end px-2">
                              <PromptInputTools>
                                <PromptInputSubmit
                                  className="h-9 w-9 cursor-pointer rounded-full transition-all duration-300 ease-out"
                                  disabled={
                                    !input.trim() ||
                                    status === "streaming" ||
                                    !submissionId
                                  }
                                  status={status}
                                  aria-label="Send answer"
                                />
                              </PromptInputTools>
                            </PromptInputTools>
                          </PromptInput>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        }
      </AnimatePresence>
    </div>
  );
}
