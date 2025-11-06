"use client";

import { FormModeProvider, useFormMode } from "@/contexts/FormModeContext";
import { useThemeLoader } from "@/hooks/useThemeLoader";
import { useAppFormStore } from "@/lib/stores/useAppFormStore";
import type { QueryDataForForm } from "@/lib/types";
import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage as AiUIMessage } from "ai";
import { createRuntime } from "@formlink/runtime";
import {
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
import React from "react";
import { apiConfig } from "@/lib/api-config";

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
  const { submissionId, initialize } = useAppFormStore();

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
      });
      return new Chat<AiUIMessage>({ transport });
    }, []),
  });

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
        <ChatTemplate
          form={formSchema}
          baseUrl={""}
          controller={{
            messages,
            status,
            sendMessage,
          }}
          title={formSchema.title}
        />
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

export default function FormPageClient({
  formSchema,
  isTestSubmission,
  queryDataForForm,
  searchParams,
}: FormPageClientProps) {
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
