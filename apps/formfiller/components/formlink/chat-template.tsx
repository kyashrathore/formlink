"use client";

import type { Question } from "@formlink/runtime/schema";
import {
  AiElementsProvider,
  ChatMessageAssistant,
  FormlinkLogo,
  PromptInputTypedAssist,
  ShadCnProvider,
  useAiElements,
  useChatStartCard,
  useFileUploadSubmission,
  useQuestionPlaceholder,
  useSlotBridge,
  useSubmitSelection,
  useTypedInputGate,
  useUiComponents,
} from "@formlink/runtime/ui/react";
import {
  ConversationContent as ConversationContentUi,
  ConversationScrollButton as ConversationScrollButtonUi,
  Conversation as ConversationUi,
} from "@formlink/ui/components/ai-elements/conversation";
import {
  PromptInputHeader as PromptInputHeaderUi,
  PromptInputSubmit as PromptInputSubmitUi,
  PromptInputTextarea as PromptInputTextareaUi,
  PromptInput as PromptInputUi,
} from "@formlink/ui/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@formlink/ui/components/ai-elements/reasoning";
import { Response as ResponseUi } from "@formlink/ui/components/ai-elements/response";
import {
  AvatarFallback as AvatarFallbackUi,
  AvatarImage as AvatarImageUi,
  Avatar as AvatarUi,
} from "@formlink/ui/components/ui/avatar";
import { Badge } from "@formlink/ui/components/ui/badge";
import { Button } from "@formlink/ui/components/ui/button";
import { Calendar } from "@formlink/ui/components/ui/calendar";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command as CommandRoot,
  CommandSeparator,
} from "@formlink/ui/components/ui/command";
import { Input } from "@formlink/ui/components/ui/input";
import { Label } from "@formlink/ui/components/ui/label";
import {
  PopoverAnchor,
  PopoverContent,
  Popover as PopoverRoot,
  PopoverTrigger,
} from "@formlink/ui/components/ui/popover";
import { ScrollArea } from "@formlink/ui/components/ui/scroll-area";
import { Separator } from "@formlink/ui/components/ui/separator";
import { Textarea } from "@formlink/ui/components/ui/textarea";
import { UserRound } from "lucide-react";
import * as React from "react";

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
  baseUrl: string;
  controller: ChatController;
  title?: string;
  avatarUrl?: string;
  showDebugIntent?: boolean;
}

function ChatTemplateInner({
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
  const {
    Avatar: AvatarComp,
    AvatarImage: AvatarImageComp,
    AvatarFallback: AvatarFallbackComp,
  } = useUiComponents();

  const { messages, status, sendMessage } = controller;
  const [currentQuestionId, setCurrentQuestionId] = React.useState<
    string | null
  >(null);
  const [input, setInput] = React.useState("");
  const [drafts, setDrafts] = React.useState<Record<string, any>>({});
  const [completed, setCompleted] = React.useState(false);

  useSlotBridge({ messages, onSlot: setCurrentQuestionId });

  // Derive answers from the entire message history.
  // This supports restoring state from history (e.g. on refresh) and live updates.
  const answers = React.useMemo(() => {
    const derived: Record<string, any> = {};
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      const parts = Array.isArray((m as any).parts) ? (m as any).parts : [];
      for (const p of parts) {
        // Broadly detect any part that looks like a saveAnswer result
        // We check both 'result' and 'output' properties for compatibility
        const result = (p as any)?.result ?? (p as any)?.output;

        // Debug log to inspect what we are parsing
        if (
          (p as any)?.type === "tool-result" ||
          (p as any)?.type?.includes("tool")
        ) {
          console.log("[Client Debug] processing part:", p, "result:", result);
        }

        if (
          result &&
          typeof result === "object" &&
          (result.saved === true || result.success === true) && // broadened check
          result.questionId &&
          result.value !== undefined
        ) {
          console.log(
            "[Client Debug] Found answer:",
            result.questionId,
            result.value,
          );
          derived[result.questionId] = result.value;
        }
      }
    }
    return derived;
  }, [messages]);

  // Track completion status from history
  React.useEffect(() => {
    const hasCompletion = messages.some((m) => {
      if (m.role !== "assistant") return false;
      const parts = Array.isArray((m as any).parts) ? (m as any).parts : [];
      return parts.some((p: any) => {
        const toolName = String(p?.type || "").replace(/^tool-/, "");
        return toolName === "completeSubmission";
      });
    });
    if (hasCompletion && !completed) {
      setCompleted(true);
    }
  }, [messages, completed]);

  const getFormSchema = React.useCallback(() => form, [form]);
  const getResponses = React.useCallback(
    () => ({ ...answers, ...drafts }),
    [answers, drafts],
  );

  const { submitSelection } = useSubmitSelection({
    sendMessage,
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
    await Promise.resolve(sendMessage({ text: input }, { body }));
    setInput("");
  }

  function renderHeader(isAssistant: boolean) {
    const icon = isAssistant ? (
      <FormlinkLogo className="h-3 w-3" />
    ) : (
      <UserRound className="h-3 w-3" />
    );
    if (AvatarComp) {
      return (
        <>
          <AvatarComp className="h-6 w-6">
            {AvatarImageComp ? (
              <AvatarImageComp src={isAssistant ? avatarUrl : undefined} />
            ) : null}
            {AvatarFallbackComp ? (
              <AvatarFallbackComp className="text-[10px]">
                {icon}
              </AvatarFallbackComp>
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border">
                {icon}
              </div>
            )}
          </AvatarComp>
          <span>{isAssistant ? "Formlink" : "You"}</span>
        </>
      );
    }
    return (
      <>
        <div className="flex h-6 w-6 items-center justify-center rounded-full border">
          {icon}
        </div>
        <span>{isAssistant ? "Formlink" : "You"}</span>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 min-h-[100svh]">
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
                ? "[&>*:first-child]:min-h-[calc(100svh-64px)] lg:[&>*:first-child]:min-h-[calc(100svh-164px)]"
                : "[&>*:first-child]:min-h-[calc(100svh-8px)] lg:[&>*:first-child]:min-h-[calc(100svh-42px)]",
            )}
          >
            <ConversationContent
              className={cn(
                "flex flex-col justify-end",
                started
                  ? "h-[calc(100svh-64px)] lg:h-[calc(100svh-164px)]"
                  : "h-[calc(100svh-8px)] lg:h-[calc(100svh-42px)]",
              )}
            >
              {messages.map((m, i) => {
                const key = String(m.id ?? i);
                const isAssistant = m.role === "assistant";
                const lastAssistantIndex = [...messages]
                  .reverse()
                  .findIndex((mm) => mm.role === "assistant");
                const isLastAssistant = isAssistant && lastAssistantIndex === 0;

                const Header = (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {renderHeader(isAssistant)}
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
                            Thinking...
                          </div>
                        ) : (
                          <ChatMessageAssistant
                            message={m}
                            isLast={isLastAssistant}
                            status={status}
                            currentQuestionId={currentQuestionId ?? undefined}
                            form={form as any}
                            values={{ ...drafts, ...answers }}
                            onChange={(qid, v) =>
                              setDrafts((d) => ({ ...d, [qid]: v }))
                            }
                            onSubmitSelection={(qid, value, display) =>
                              submitSelection(qid, value, display)
                            }
                            onFileUpload={(qid, f) => handleFileUpload(qid, f)}
                            renderSlots={(q: any) => q.type?.name !== "text"}
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
                <div className="flex items-center gap-2">
                  <PromptInputTypedAssist
                    expectedFormat={currentTextFormat as any}
                    value={input}
                    onValueChange={setInput}
                    alwaysShowTelSelector
                    gate={gate}
                  />
                  <div>{promptPlaceholder}</div>
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

export function ChatTemplate(props: ChatTemplateProps) {
  return (
    <ShadCnProvider
      components={{
        Button,
        Input,
        Textarea,
        Label,
        Badge,
        ScrollArea,
        Separator,
        Calendar,
        Avatar: AvatarUi,
        AvatarImage: AvatarImageUi,
        AvatarFallback: AvatarFallbackUi,
        PopoverRoot,
        PopoverTrigger,
        PopoverContent,
        PopoverAnchor,
        CommandRoot,
        CommandList,
        CommandItem,
        CommandGroup,
        CommandEmpty,
        CommandInput,
        CommandSeparator,
      }}
    >
      <AiElementsProvider
        components={{
          Conversation: ConversationUi,
          ConversationContent: ConversationContentUi,
          ConversationScrollButton: ConversationScrollButtonUi,
          PromptInput: PromptInputUi,
          PromptInputHeader: PromptInputHeaderUi,
          PromptInputTextarea: PromptInputTextareaUi,
          PromptInputSubmit: PromptInputSubmitUi,
          Response: ResponseUi,
          Reasoning,
          ReasoningTrigger,
          ReasoningContent,
        }}
      >
        <ChatTemplateInner {...props} />
      </AiElementsProvider>
    </ShadCnProvider>
  );
}
