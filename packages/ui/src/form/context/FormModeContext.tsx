"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type FormMode = "chat" | "typeform";

interface FormModeContextValue {
  mode: FormMode;
  setMode: (mode: FormMode) => void;
  isChatMode: boolean;
  isTypeFormMode: boolean;
}

const FormModeContext = createContext<FormModeContextValue | undefined>(undefined);

interface FormModeProviderProps {
  children: React.ReactNode;
  defaultMode?: FormMode;
  formSettings?: {
    defaultMode?: FormMode;
  };
  // Optional URL params for apps that use routing
  urlSearchParams?: {
    mode?: string;
    aimode?: string; // Legacy support for aimode=false
  };
}

export function FormModeProvider({ 
  children, 
  defaultMode = "chat",
  formSettings,
  urlSearchParams
}: FormModeProviderProps) {
  
  // Determine initial mode from multiple sources
  const getInitialMode = (): FormMode => {
    // 1. Check URL params first (highest priority)
    if (urlSearchParams?.mode === "typeform") return "typeform";
    if (urlSearchParams?.mode === "chat") return "chat";
    
    // Legacy param support: aimode=false means typeform, otherwise chat
    if (urlSearchParams?.aimode === "false") return "typeform";
    if (urlSearchParams?.aimode === "true") return "chat";
    
    // 2. Check form settings
    if (formSettings?.defaultMode) {
      return formSettings.defaultMode;
    }
    
    // 3. Use provided default
    return defaultMode;
  };

  const [mode, setMode] = useState<FormMode>(getInitialMode());

  // Update mode when URL params change
  useEffect(() => {
    if (!urlSearchParams) return;
    
    if (urlSearchParams.mode === "typeform") {
      setMode("typeform");
    } else if (urlSearchParams.mode === "chat") {
      setMode("chat");
    } else if (urlSearchParams.aimode === "false") {
      setMode("typeform");
    } else if (urlSearchParams.aimode === "true") {
      setMode("chat");
    }
  }, [urlSearchParams?.mode, urlSearchParams?.aimode]);

  const value: FormModeContextValue = {
    mode,
    setMode,
    isChatMode: mode === "chat",
    isTypeFormMode: mode === "typeform",
  };

  return (
    <FormModeContext.Provider value={value}>
      {children}
    </FormModeContext.Provider>
  );
}

export function useFormMode() {
  const context = useContext(FormModeContext);
  if (!context) {
    throw new Error("useFormMode must be used within a FormModeProvider");
  }
  
  // Ensure we always return the expected shape
  // This handles edge cases where context might be corrupted
  if (!context.mode || typeof context.setMode !== 'function') {
    console.error("FormModeContext is corrupted:", context);
    return {
      mode: "chat" as FormMode,
      setMode: () => console.warn("setMode called on corrupted context"),
      isChatMode: true,
      isTypeFormMode: false,
    };
  }
  
  return context;
}