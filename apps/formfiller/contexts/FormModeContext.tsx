"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

export type AppFormMode = "ai" | "typeform" | "classic";

interface FormModeContextValue {
  mode: AppFormMode;
  setMode: (mode: AppFormMode) => void;
  isAIMode: boolean;
  isTypeFormMode: boolean;
  isClassicMode: boolean;
}

const FormModeContext = createContext<FormModeContextValue | undefined>(
  undefined,
);

interface FormModeProviderProps {
  children: React.ReactNode;
  defaultMode?: AppFormMode;
  formSettings?: { defaultMode?: AppFormMode };
  urlSearchParams?: { mode?: string; aimode?: string };
}

export function FormModeProvider({
  children,
  defaultMode = "ai",
  formSettings,
  urlSearchParams: passedUrlSearchParams,
}: FormModeProviderProps) {
  const searchParams = useSearchParams();
  const urlSearchParams = passedUrlSearchParams || {
    mode: searchParams.get("mode") || undefined,
    aimode: searchParams.get("aimode") || undefined,
  };

  const resolveInitialMode = (): AppFormMode => {
    if (urlSearchParams?.mode === "typeform") return "typeform";
    if (urlSearchParams?.mode === "ai") return "ai";
    if (urlSearchParams?.mode === "classic") return "classic";
    if (urlSearchParams?.aimode === "false") return "typeform";
    if (urlSearchParams?.aimode === "true") return "ai";
    if (formSettings?.defaultMode) return formSettings.defaultMode;
    return defaultMode;
  };

  const [mode, setMode] = useState<AppFormMode>(resolveInitialMode());

  useEffect(() => {
    if (!urlSearchParams) return;
    if (urlSearchParams.mode === "typeform") setMode("typeform");
    else if (urlSearchParams.mode === "ai") setMode("ai");
    else if (urlSearchParams.mode === "classic") setMode("classic");
    else if (urlSearchParams.aimode === "false") setMode("typeform");
    else if (urlSearchParams.aimode === "true") setMode("ai");
  }, [urlSearchParams?.mode, urlSearchParams?.aimode]);

  const value = useMemo<FormModeContextValue>(
    () => ({
      mode,
      setMode,
      isAIMode: mode === "ai",
      isTypeFormMode: mode === "typeform",
      isClassicMode: mode === "classic",
    }),
    [mode],
  );

  return (
    <FormModeContext.Provider value={value}>
      {children}
    </FormModeContext.Provider>
  );
}

export function useFormMode() {
  const ctx = useContext(FormModeContext);
  if (!ctx)
    throw new Error("useFormMode must be used within a FormModeProvider");
  return ctx;
}

export type FormMode = AppFormMode;
