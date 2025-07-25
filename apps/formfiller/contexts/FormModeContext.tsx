"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import {
  FormModeProvider as UIFormModeProvider,
  useFormMode as useUIFormMode,
  type FormMode as UIFormMode,
} from "@formlink/ui";
import type { ExtendedFormModeContext } from "@/lib/types";

export type AppFormMode = "ai" | "typeform";

interface FormModeProviderProps {
  children: React.ReactNode;
  defaultMode?: AppFormMode;
  formSettings?: {
    defaultMode?: AppFormMode;
  };
  urlSearchParams?: {
    mode?: string;
    aimode?: string;
  };
}

// Wrapper that connects Next.js routing to the UI package's FormModeProvider
export function FormModeProvider({
  children,
  defaultMode = "ai" as AppFormMode,
  formSettings,
  urlSearchParams: passedUrlSearchParams,
}: FormModeProviderProps) {
  const searchParams = useSearchParams();

  // Use passed URL search params if provided, otherwise read from Next.js
  const urlSearchParams = passedUrlSearchParams || {
    mode: searchParams.get("mode") || undefined,
    aimode: searchParams.get("aimode") || undefined,
  };

  // Map "ai" mode to "chat" for the UI package
  const mappedDefaultMode = (
    defaultMode === "ai"
      ? "chat"
      : defaultMode === "typeform"
        ? "typeform"
        : "chat"
  ) as UIFormMode;
  const mappedFormSettings = formSettings
    ? {
        defaultMode: (formSettings.defaultMode === "ai"
          ? "chat"
          : formSettings.defaultMode === "typeform"
            ? "typeform"
            : "chat") as UIFormMode,
      }
    : undefined;

  return (
    <UIFormModeProvider
      defaultMode={mappedDefaultMode}
      formSettings={mappedFormSettings}
      urlSearchParams={urlSearchParams}
    >
      {children}
    </UIFormModeProvider>
  );
}

// Create a compatibility layer that maps UI package modes back to app modes
export function useFormMode() {
  const context = useUIFormMode();
  const extendedContext = context as ExtendedFormModeContext;
  const { mode, setMode } = extendedContext;
  const isChatMode = extendedContext.isChatMode ?? mode === "chat";
  const isTypeFormMode = extendedContext.isTypeFormMode ?? mode === "typeform";

  return {
    mode: mode === "chat" ? ("ai" as const) : (mode as AppFormMode),
    setMode: (newMode: AppFormMode) => {
      setMode(newMode === "ai" ? "chat" : newMode);
    },
    isAIMode: isChatMode,
    isTypeFormMode: isTypeFormMode,
  };
}

export type FormMode = AppFormMode; // Backwards compatibility alias
