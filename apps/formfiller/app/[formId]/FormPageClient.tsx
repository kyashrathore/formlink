"use client";

import { FormModeProvider, useFormMode } from "@/contexts/FormModeContext";
import { useThemeLoader } from "@/hooks/useThemeLoader";
import { apiConfig } from "@/lib/api-config";
import { useAppFormStore } from "@/lib/stores/useAppFormStore";
import type { QueryDataForForm } from "@/lib/types";
import { Chat, useChat } from "@ai-sdk/react";
import { createRuntime } from "@formlink/runtime";
import {
  AiElementsProvider,
  ChatTemplate,
  ClassicTemplate,
  RuntimeProvider,
  ShadCnProvider,
  TypeformTemplate,
} from "@formlink/runtime/ui/react";
import { Form } from "@formlink/schema";
import {
  Badge,
  Button,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command as CommandRoot,
  CommandSeparator,
  Input,
  Label,
  PopoverAnchor,
  PopoverContent,
  Popover as PopoverRoot,
  PopoverTrigger,
  ScrollArea,
  Separator,
  Textarea,
} from "@formlink/ui";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  PromptInput,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  Response,
} from "@formlink/ui/ai-elements";
import { DefaultChatTransport, type UIMessage as AiUIMessage } from "ai";
import React from "react";

const CHAT_ASSIST_DEBUG_ENABLED = process.env.NODE_ENV !== "production";
const CHAT_ASSIST_TRACE_HEADER = "x-formlink-trace-id";
const CHAT_ASSIST_TEXT_PREVIEW_CHARS = 240;

function truncateText(value: string, maxChars: number): string {
  if (!value) return "";
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

function extractTextFromUiMessage(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as any;
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const text = parts
    .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("\n\n");
  if (text) return text;
  if (typeof msg.content === "string") return msg.content;
  return "";
}

function summarizeUiMessageForLog(message: unknown) {
  if (!message || typeof message !== "object") return null;
  const msg = message as any;
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const partTypes = parts
    .map((p: any) => p?.type)
    .filter((type: unknown) => typeof type === "string")
    .slice(0, 12);

  return {
    id: msg.id ?? null,
    role: msg.role ?? null,
    partTypes,
    textPreview: truncateText(
      extractTextFromUiMessage(msg),
      CHAT_ASSIST_TEXT_PREVIEW_CHARS,
    ),
  };
}

function pickToolPartsForLog(message: unknown) {
  if (!message || typeof message !== "object") return [];
  const msg = message as any;
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const toolParts = parts.filter(
    (p: any) =>
      typeof p?.type === "string" && String(p.type).startsWith("tool-"),
  );

  return toolParts.map((p: any) => ({
    type: p.type,
    state: p.state ?? null,
    toolCallId: p.toolCallId ?? null,
    input: p.input ?? null,
    output: p.output ?? p.result ?? null,
    errorText: p.errorText ?? null,
  }));
}

function createChatAssistTraceId(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FormPageContentProps {
  formSchema: Form;
  isTestSubmission: boolean;
  queryDataForForm: QueryDataForForm;
}

// This component must be used INSIDE FormModeProvider
function FormPageContent({
  formSchema,
  isTestSubmission,
  queryDataForForm,
}: FormPageContentProps) {
  const { isAIMode, isClassicMode } = useFormMode();

  // Load and apply themes from database
  const themeLoader = useThemeLoader(formSchema);

  // Removed debug logs for theme loading status
  React.useEffect(() => {
    // no-op: previously logged theme load results
  }, [
    themeLoader.isLoading,
    themeLoader.themeApplied,
    themeLoader.error,
    formSchema.id,
  ]);

  // Questions are available directly from formSchema.questions

  // Business logic from app store
  const { submissionId, initialize, questionResponses } = useAppFormStore();
  const submissionIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    submissionIdRef.current = submissionId ?? null;
  }, [submissionId]);

  // Initialize wrapper to seed query params and testmode for Typeform/Classic
  const handleInitialize = React.useCallback(
    async (schema: Form, id?: string) => {
      await initialize(schema, id);
    },
    [initialize, isTestSubmission, queryDataForForm],
  );

  // Seed submission + local state on mount (reuses existing store init)
  React.useEffect(() => {
    handleInitialize(formSchema, formSchema.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build runtime once submission id is available (Typeform/Classic)
  const runtime = React.useMemo(() => {
    if (!submissionId) return null;
    return createRuntime({
      form: formSchema,
      formfiller: {
        baseUrl: "",
        formId: formSchema.id,
        submissionId,
        formVersionId: formSchema.version_id,
        isTestSubmission,
      },
      uiMode: isClassicMode ? "classic" : "typeform",
    });
  }, [submissionId, formSchema, isClassicMode, isTestSubmission]);

  // Prepare AI chat controller unconditionally to keep hook order stable.
  // For our installed SDK versions, pass a transport that points to chat-assist.
  const chat = useChat<AiUIMessage>({
    chat: React.useMemo(() => {
      const transport = new DefaultChatTransport({
        api: apiConfig.getChatAssistUrl(),
        fetch: async (input, init) => {
          const traceId = createChatAssistTraceId();
          const headers = new Headers(init?.headers ?? {});
          headers.set(CHAT_ASSIST_TRACE_HEADER, traceId);

          let payload: any = null;
          let bodyString: BodyInit | null | undefined = init?.body;
          try {
            if (init?.body && typeof init.body === "string") {
              payload = JSON.parse(init.body);
            }
          } catch {}

          const stableSubmissionId = submissionIdRef.current;
          if (
            payload &&
            typeof payload === "object" &&
            stableSubmissionId &&
            (payload.submissionId === null ||
              payload.submissionId === undefined)
          ) {
            payload.submissionId = stableSubmissionId;
            bodyString = JSON.stringify(payload);
          }

          if (CHAT_ASSIST_DEBUG_ENABLED) {
            const messages = Array.isArray(payload?.messages)
              ? payload.messages
              : [];
            const formSchemaId =
              typeof payload?.formSchema?.id === "string"
                ? payload.formSchema.id
                : null;
            const responseKeys = payload?.responses
              ? Object.keys(payload.responses)
              : [];

            console.log("[chat-assist][client] request", {
              traceId,
              url:
                typeof input === "string"
                  ? input
                  : String((input as any)?.url ?? input),
              method: init?.method ?? "POST",
              chatId: payload?.id ?? null,
              messageId: payload?.messageId ?? null,
              trigger: payload?.trigger ?? null,
              submissionId: payload?.submissionId ?? null,
              submissionBehavior: payload?.submissionBehavior ?? null,
              currentQuestionId: payload?.currentQuestionId ?? null,
              initiate: payload?.initiate ?? null,
              startMode: payload?.startMode ?? null,
              userInputPreview: truncateText(
                String(payload?.userInput ?? ""),
                CHAT_ASSIST_TEXT_PREVIEW_CHARS,
              ),
              responseKeyCount: responseKeys.length,
              responseKeys: responseKeys.slice(0, 20),
              formId: formSchemaId,
              questionCount: Array.isArray(payload?.formSchema?.questions)
                ? payload.formSchema.questions.length
                : null,
              messagesCount: messages.length,
              messagesTail: messages
                .slice(-4)
                .map((m: unknown) => summarizeUiMessageForLog(m)),
            });
          }

          try {
            const response = await fetch(input, {
              ...init,
              body: bodyString,
              headers,
            });
            if (CHAT_ASSIST_DEBUG_ENABLED) {
              console.log("[chat-assist][client] response", {
                traceId,
                status: response.status,
                ok: response.ok,
                traceIdEcho: response.headers.get(CHAT_ASSIST_TRACE_HEADER),
              });
            }
            return response;
          } catch (error) {
            if (CHAT_ASSIST_DEBUG_ENABLED) {
              console.error("[chat-assist][client] fetch error", {
                traceId,
                error: error instanceof Error ? error.message : error,
              });
            }
            throw error;
          }
        },
      });
      return new Chat<AiUIMessage>({ transport });
    }, []),
  });

  const lastLoggedStatusRef = React.useRef(chat.status);
  const lastLoggedMessageCountRef = React.useRef(chat.messages.length);

  React.useEffect(() => {
    if (!CHAT_ASSIST_DEBUG_ENABLED) return;

    if (lastLoggedStatusRef.current !== chat.status) {
      console.log("[chat-assist][client] status", {
        from: lastLoggedStatusRef.current,
        to: chat.status,
        messagesCount: chat.messages.length,
      });
      lastLoggedStatusRef.current = chat.status;
    }

    if (lastLoggedMessageCountRef.current !== chat.messages.length) {
      const lastMessage =
        chat.messages.length > 0
          ? chat.messages[chat.messages.length - 1]
          : null;
      console.log("[chat-assist][client] messages", {
        fromCount: lastLoggedMessageCountRef.current,
        toCount: chat.messages.length,
        last: summarizeUiMessageForLog(lastMessage),
      });
      lastLoggedMessageCountRef.current = chat.messages.length;
    }
  }, [chat.messages, chat.status]);

  React.useEffect(() => {
    if (!CHAT_ASSIST_DEBUG_ENABLED) return;

    const assistants = chat.messages.filter(
      (m: any) => m?.role === "assistant",
    );
    const lastAssistant =
      assistants.length > 0 ? assistants[assistants.length - 1] : null;
    if (!lastAssistant) return;
    const pickToolParts = (msg: unknown) => {
      if (!msg || typeof msg !== "object") return [];
      const parts = Array.isArray((msg as any).parts) ? (msg as any).parts : [];
      return parts
        .filter(
          (p: any) =>
            typeof p?.type === "string" && String(p.type).startsWith("tool-"),
        )
        .map((p: any) => ({
          type: p.type,
          state: p.state ?? null,
          toolCallId: p.toolCallId ?? null,
          input: p.input ?? null,
          output: p.output ?? p.result ?? null,
          errorText: p.errorText ?? null,
        }));
    };
    const toolParts = pickToolParts(lastAssistant);
    if (toolParts.length === 0) return;

    console.log("[chat-assist][client] assistant-tool-parts", {
      assistant: summarizeUiMessageForLog(lastAssistant),
      toolParts,
    });
  }, [chat.messages]);

  // Show minimal loading state while theme is being applied to prevent content flash
  if (themeLoader.isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  // AI Chat path (runtime ChatTemplate + useChat)
  if (isAIMode) {
    const { messages, sendMessage, status } = chat;
    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Separator,
          Badge,
          ScrollArea,
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
            Conversation,
            ConversationContent,
            ConversationScrollButton,
            PromptInput,
            PromptInputHeader,
            PromptInputTextarea,
            PromptInputSubmit,
            Response,
          }}
        >
          <ChatTemplate
            key={submissionId || "init"}
            form={formSchema}
            baseUrl={""}
            controller={{
              messages,
              status,
              sendMessage,
            }}
            title={formSchema.title}
            initialAnswers={questionResponses}
          />
        </AiElementsProvider>
      </ShadCnProvider>
    );
  }

  if (isClassicMode) {
    if (!runtime) return null;
    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Separator,
          Badge,
          ScrollArea,
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
        <RuntimeProvider runtime={runtime} showDevtools={false}>
          <ClassicTemplate />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  }

  // Default to TypeForm mode if not in AI or Classic mode
  if (!runtime) return null;
  return (
    <ShadCnProvider
      components={{
        Button,
        Input,
        Textarea,
        Label,
        Separator,
        Badge,
        ScrollArea,
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
      <RuntimeProvider runtime={runtime} showDevtools={false}>
        <TypeformTemplate />
      </RuntimeProvider>
    </ShadCnProvider>
  );
}

interface FormPageClientProps {
  formSchema: Form;
  isTestSubmission: boolean;
  queryDataForForm: QueryDataForForm;
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function FormPageClient(props: FormPageClientProps) {
  const { formSchema, isTestSubmission, queryDataForForm, searchParams } =
    props;
  // Extract default mode from form settings
  const defaultMode = formSchema.settings?.defaultMode as
    | "ai"
    | "typeform"
    | "classic"
    | undefined;

  // Convert search params to the format expected by FormModeProvider
  const urlSearchParams = {
    mode:
      typeof searchParams?.mode === "string" ? searchParams.mode : undefined,
    aimode:
      typeof searchParams?.aimode === "string"
        ? searchParams.aimode
        : undefined,
  };

  return (
    <FormModeProvider
      defaultMode={defaultMode || "ai"}
      formSettings={{ defaultMode }}
      urlSearchParams={urlSearchParams}
    >
      <div className="h-full">
        <FormPageContent
          formSchema={formSchema}
          isTestSubmission={isTestSubmission}
          queryDataForForm={queryDataForForm}
        />
      </div>
    </FormModeProvider>
  );
}
