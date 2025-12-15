"use client";
import type { Question } from "@/schema";
import { PromptInputTypedAssist } from "@/ui/react/ai/PromptInputTypedAssist";
import { useTypedInputGate } from "@/ui/react/ai/useTypedInputGate";
import { ChatMessageAssistant } from "@/ui/react/chat/ChatMessageAssistant";
import { useChatStartCard } from "@/ui/react/chat/hooks/useChatStartCard";
import { useFileUploadSubmission } from "@/ui/react/chat/hooks/useFileUploadSubmission";
import { useQuestionPlaceholder } from "@/ui/react/chat/hooks/useQuestionPlaceholder";
import { useSlotBridge } from "@/ui/react/chat/hooks/useSlotBridge";
import { useSubmitSelection } from "@/ui/react/chat/hooks/useSubmitSelection";
import { FormlinkLogo } from "@/ui/react/icons/FormlinkLogo";
import { UserRound } from "lucide-react";
import * as React from "react";
import { useAiElements } from "./primitives/ai-elements-context";
import { useUiComponents } from "./primitives/context";
// Minimal classnames joiner to avoid pulling UI utils
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type UIMessage = { id?: string | number; role: string; parts?: any[] };

export type ChatController = {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  sendMessage: (
    message: { text: string },
    opts?: { body?: Record<string, any> },
  ) => Promise<any> | void;
};

export interface ChatTemplateProps {
  form: { id?: string; questions?: Question[]; [k: string]: any };
  baseUrl: string; // host base for uploads, e.g. "" to use same origin
  controller: ChatController;
  title?: string;
  avatarUrl?: string;
  showDebugIntent?: boolean;
}

export function ChatTemplate({
  form,
  baseUrl,
  controller,
  title,
  avatarUrl,
  showDebugIntent = false,
}: ChatTemplateProps) {
  const {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
    PromptInput,
    PromptInputHeader,
    PromptInputTextarea,
    PromptInputSubmit,
    Response,
  } = useAiElements();

  // ai-elements provided by host via AiElementsProvider
  const { messages, status, sendMessage } = controller;

  const [currentQuestionId, setCurrentQuestionId] = React.useState<
    string | null
  >(null);
  const [input, setInput] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  const [drafts, setDrafts] = React.useState<Record<string, any>>({});
  const [completed, setCompleted] = React.useState(false);

  // Bridge the slot token to current question id
  useSlotBridge({ messages, onSlot: setCurrentQuestionId });

  // Apply tool outputs from assistant messages exactly once per message id
  const lastAppliedRef = React.useRef<string>("");
  React.useEffect(() => {
    const assistants = messages.filter((m) => m?.role === "assistant");
    if (assistants.length === 0) return;
    const last = assistants[assistants.length - 1]!;
    const lastId = String((last as any)?.id ?? assistants.length);
    if (lastAppliedRef.current === lastId) return;
    // scan for tool-* parts
    const toolParts = (
      Array.isArray((last as any).parts) ? (last as any).parts : []
    ).filter(
      (p: any) => typeof p?.type === "string" && p.type.startsWith("tool-"),
    );
    if (toolParts.length === 0) return; // nothing to apply yet
    lastAppliedRef.current = lastId;
    for (const p of toolParts) {
      const tool = String(p.type).replace(/^tool-/, "");
      const result = p?.output ?? p?.result;
      if (tool === "saveAnswer") {
        const qid = result?.questionId;
        const next = result?.nextQuestionId ?? null;
        if (qid != null) {
          setAnswers((prev) => ({ ...prev, [qid]: result?.value }));
        }
        setCurrentQuestionId(next);
      }
      if (tool === "completeSubmission") {
        setCompleted(true);
      }
    }
  }, [messages]);

  const getFormSchema = React.useCallback(() => form, [form]);
  const getResponses = React.useCallback(
    () => ({ ...answers, ...drafts }),
    [answers, drafts],
  );

  // Track optimistic submission to hide controls immediately
  const [lastSubmittedQuestionId, setLastSubmittedQuestionId] = React.useState<
    string | null
  >(null);

  const { submitSelection } = useSubmitSelection({
    sendMessage: (msg, opts) => {
      // Optimistically mark question as submitted when message is actually sent (after delay)
      const qid = opts?.body?.justSavedAnswer?.questionId;
      if (qid) setLastSubmittedQuestionId(qid);
      return sendMessage(msg, opts);
    },
    currentQuestionId,
    getFormSchema,
    getResponses,
  });

  const { handleFileUpload } = useFileUploadSubmission({
    uploadApi: `${baseUrl}/api/upload`,
    submitSelection,
  });

  const findQuestion = React.useCallback(
    (qId: string | null): Question | null => {
      const qs = Array.isArray(form?.questions)
        ? (form.questions as Question[])
        : [];
      if (!qId) return null;
      return (qs.find((q) => q?.id === qId) as Question) ?? null;
    },
    [form?.questions],
  );

  const currentQuestion = React.useMemo(
    () => findQuestion(currentQuestionId),
    [findQuestion, currentQuestionId],
  );

  const { format: currentTextFormat, placeholder: promptPlaceholder } =
    useQuestionPlaceholder({
      question: currentQuestion,
      defaultPlaceholder: "Type your response",
    });

  const gate = useTypedInputGate({
    expectedFormat: (currentTextFormat as any) ?? null,
    value: input,
    confidence: 0.85,
  });

  const { started, canStart, start } = useChatStartCard({
    messages,
    status,
    sendMessage,
    getFormSchema,
    getCurrentQuestionId: () => currentQuestionId,
    getResponses,
    startText: "Start",
  });

  async function handleSubmit() {
    if (!input) return;
    if (status === "streaming" || status === "submitted") return;
    if (gate.block) {
      gate.setShowValidation(true);
      return;
    }
    const body = {
      userInput: input,
      submissionBehavior: "manualUnclear",
      currentQuestionId,
      formSchema: getFormSchema(),
      responses: getResponses(),
    };
    if (currentQuestionId) setLastSubmittedQuestionId(currentQuestionId);
    setInput("");
    await Promise.resolve(sendMessage({ text: input }, { body }));
  }

  const headerText = React.useMemo(() => {
    if (gate.showValidation && gate.block && currentTextFormat) {
      return `Please enter a valid ${currentTextFormat}.`;
    }
    const qType = currentQuestion?.type?.name;
    if (qType === "singleChoice" || qType === "multipleChoice") {
      return "Select an option above, or type your answer here.";
    }
    if (
      qType === "text" &&
      currentTextFormat &&
      currentTextFormat !== "text" &&
      currentTextFormat !== "textarea"
    ) {
      return `Enter your ${currentTextFormat}, or ask a clarifying question.`;
    }
    return "";
  }, [
    gate.showValidation,
    gate.block,
    currentTextFormat,
    currentQuestion?.type?.name,
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 min-h-screen">
      {!started ? (
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">
            {form?.description ?? "Answer a few questions to get started."}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border"
              onClick={() => start()}
              disabled={!canStart}
            >
              Start
            </button>
          </div>
        </div>
      ) : (
        <>
          <Conversation
            className={cn(
              "border rounded-md rounded-b-none",
              started
                ? "h-[calc(100svh-64px)] lg:h-[calc(100svh-164px)]"
                : "h-[calc(100svh-8px)] lg:h-[calc(100svh-42px)]",
            )}
          >
            <ConversationContent className="flex flex-col justify-end min-h-full">
              {messages.map((m, i) => {
                const key = String(m.id ?? i);
                const isAssistant = m.role === "assistant";
                const lastAssistantIndex = [...messages]
                  .reverse()
                  .findIndex((mm) => mm.role === "assistant");
                const isLastAssistant = isAssistant && lastAssistantIndex === 0;

                const Header = (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(() => {
                      const { Avatar, AvatarImage, AvatarFallback } =
                        useUiComponents();
                      const icon = isAssistant ? (
                        <FormlinkLogo className="h-3 w-3" />
                      ) : (
                        <UserRound className="h-3 w-3" />
                      );
                      if (Avatar) {
                        return (
                          <Avatar className="h-6 w-6">
                            {AvatarImage ? (
                              <AvatarImage
                                src={isAssistant ? avatarUrl : undefined}
                              />
                            ) : null}
                            {AvatarFallback ? (
                              <AvatarFallback className="text-[10px]">
                                {icon}
                              </AvatarFallback>
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full border">
                                {icon}
                              </div>
                            )}
                          </Avatar>
                        );
                      }
                      return (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border">
                          {icon}
                        </div>
                      );
                    })()}
                    <span>{isAssistant ? "Formlink" : "You"}</span>
                  </div>
                );

                if (isAssistant) {
                  const parts = Array.isArray((m as any).parts)
                    ? (m as any).parts
                    : [];
                  const hasText = parts.some(
                    (p: any) =>
                      p?.type === "text" &&
                      String(p.text || "").trim().length > 0,
                  );
                  return (
                    <div key={key} className="w-full p-3">
                      {Header}
                      <div className="mt-1 pl-9">
                        {isLastAssistant &&
                        status === "streaming" &&
                        !hasText ? (
                          <div
                            className="text-sm opacity-80"
                            aria-live="polite"
                            role="status"
                          >
                            {/* Simple thinking dots indicator */}
                            Thinking...
                          </div>
                        ) : (
                          <ChatMessageAssistant
                            message={m}
                            isLast={isLastAssistant}
                            currentQuestionId={currentQuestionId ?? undefined}
                            form={form as any}
                            values={{ ...answers, ...drafts }}
                            onChange={(qid, v) =>
                              setDrafts((d) => ({ ...d, [qid]: v }))
                            }
                            onSubmitSelection={(qid, value, display) =>
                              submitSelection(qid, value, display)
                            }
                            onFileUpload={(qid, f) => handleFileUpload(qid, f)}
                            renderSlots={(q) => {
                              if (q.id === lastSubmittedQuestionId)
                                return false;
                              return (q as any).type?.name !== "text";
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                }

                const userText = (Array.isArray(m.parts) ? m.parts : [])
                  .filter((p: any) => p?.type === "text")
                  .map((p: any) => p?.text ?? "")
                  .join("\n\n");
                if (!userText) return null;
                return (
                  <div key={key} className="w-full p-3">
                    {Header}
                    <div className="mt-1 pl-9">
                      <Response>{userText}</Response>
                    </div>
                  </div>
                );
              })}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {!completed && (
            <PromptInput onSubmit={handleSubmit} className="relative mt-3">
              <PromptInputHeader>
                <div className="flex items-center gap-2 min-h-[1.5rem]">
                  <PromptInputTypedAssist
                    expectedFormat={currentTextFormat as any}
                    value={input}
                    onValueChange={setInput}
                    alwaysShowTelSelector
                    gate={gate}
                  />
                  {headerText && (
                    <div className="text-xs text-muted-foreground animate-in fade-in slide-in-from-left-1">
                      {headerText}
                    </div>
                  )}
                </div>
              </PromptInputHeader>
              <PromptInputTextarea
                key="footer-textarea"
                value={input}
                onChange={(e: any) => setInput(e.target.value)}
                placeholder={promptPlaceholder}
                className="p-[2px] md:p-3 pr-10 md:pr-14 text-sm md:text-base"
              />
              <PromptInputSubmit
                className="absolute bottom-1 right-1 md:bottom-2 md:right-2 rounded-full"
                status={status}
                disabled={
                  !input ||
                  status === "streaming" ||
                  (gate.showValidation && gate.block)
                }
              />
            </PromptInput>
          )}
        </>
      )}
    </div>
  );
}
