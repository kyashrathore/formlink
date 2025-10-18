"use client";

import FormPageClient from "@/app/[formId]/FormPageClient";
import { ThemeApplicator } from "@/lib/theme/ThemeApplicator";
import { Form } from "@formlink/schema";
import { useCallback, useEffect, useRef, useState } from "react";

// Message types for postMessage communication
interface FormUpdateMessage {
  type: "FORMCRAFT_FORM_UPDATE";
  payload: Form;
}

interface FormModeUpdateMessage {
  type: "FORMCRAFT_MODE_UPDATE";
  payload: {
    formMode: "chat" | "typeform" | "classic";
    timestamp: number;
  };
}

interface FormShadcnCSSUpdateMessage {
  type: "FORMCRAFT_SHADCN_CSS_UPDATE";
  payload: {
    cssText: string;
    timestamp: number;
  };
}

interface PreviewReadyMessage {
  type: "FORMFILLER_PREVIEW_READY";
  formId: string;
}

interface ShadcnCSSAppliedMessage {
  type: "FORMFILLER_SHADCN_CSS_APPLIED";
  payload: {
    success: boolean;
    error?: string;
    appliedRootVariables: string[];
    appliedDarkVariables: string[];
    warnings: string[];
    timestamp: number;
  };
}

type IncomingMessage =
  | FormUpdateMessage
  | FormModeUpdateMessage
  | FormShadcnCSSUpdateMessage
  | {
      type: "FORMCRAFT_THEME_MODE_UPDATE";
      payload: { mode: "light" | "dark" | "system"; timestamp: number };
    };

interface PreviewPageClientProps {
  formSchema: Form;
  isTestSubmission: boolean;
}

// Get allowed origins from environment variables
function getAllowedOrigins(): string[] {
  const allowedOrigins = process.env.NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS;

  if (allowedOrigins) {
    return allowedOrigins.split(",").map((origin) => origin.trim());
  }

  // Default fallback origins based on environment
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ];
  }

  // Production fallback - should be configured via environment variables
  return ["https://formlink.ai"];
}

function validateOrigin(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

export default function PreviewPageClient({
  formSchema: initialFormSchema,
  isTestSubmission,
}: PreviewPageClientProps) {
  const [currentFormSchema, setCurrentFormSchema] =
    useState<Form>(initialFormSchema);
  const [currentFormMode, setCurrentFormMode] = useState<
    "chat" | "typeform" | "classic"
  >(
    initialFormSchema.settings?.defaultMode === "classic"
      ? "classic"
      : initialFormSchema.settings?.defaultMode === "typeform"
        ? "typeform"
        : "chat",
  );
  const hasNotifiedReady = useRef(false);
  const themeApplicator = useRef(new ThemeApplicator());
  const lastCssRef = useRef<string | null>(null);

  // Send ready message to parent when component mounts
  useEffect(() => {
    if (!hasNotifiedReady.current && typeof window !== "undefined") {
      const readyMessage: PreviewReadyMessage = {
        type: "FORMFILLER_PREVIEW_READY",
        formId: initialFormSchema.id,
      };

      // Send to parent window
      if (window.parent && window.parent !== window) {
        // Send to parent with specific origin for security
        const parentOrigin =
          window.location.hostname === "localhost"
            ? "http://localhost:3000" // Dev server
            : "https://formlink.ai"; // Production Formlink
        window.parent.postMessage(readyMessage, parentOrigin);
        hasNotifiedReady.current = true;
      }
    }
  }, [initialFormSchema.id]);

  // Function to send shadcn CSS applied message
  const sendShadcnAppliedMessage = useCallback(
    (
      success: boolean,
      error?: string,
      appliedRootVariables: string[] = [],
      appliedDarkVariables: string[] = [],
      warnings: string[] = [],
    ) => {
      if (
        typeof window !== "undefined" &&
        window.parent &&
        window.parent !== window
      ) {
        const message: ShadcnCSSAppliedMessage = {
          type: "FORMFILLER_SHADCN_CSS_APPLIED",
          payload: {
            success,
            error,
            appliedRootVariables,
            appliedDarkVariables,
            warnings,
            timestamp: Date.now(),
          },
        };
        const parentOrigin =
          window.location.hostname === "localhost"
            ? "http://localhost:3000" // Dev server
            : "https://formlink.ai"; // Production Formlink
        window.parent.postMessage(message, parentOrigin);
      }
    },
    [],
  );

  // Function to apply shadcn CSS variables directly
  const applyShadcnCSS = useCallback(
    (cssText: string) => {
      try {
        lastCssRef.current = cssText;
        const result = themeApplicator.current.applyShadcnVariables(cssText);

        if (result.success) {
          sendShadcnAppliedMessage(
            true,
            undefined,
            result.appliedRootVariables,
            result.appliedDarkVariables,
            result.warnings,
          );

          // Force a reflow to ensure CSS variables are applied
          void document.documentElement.offsetHeight;
        } else {
          sendShadcnAppliedMessage(
            false,
            result.error || "Shadcn CSS application failed",
            [],
            [],
            result.warnings,
          );
        }

        // Warnings previously logged; logs removed
      } catch (error) {
        sendShadcnAppliedMessage(
          false,
          error instanceof Error ? error.message : "Unknown error",
          [],
          [],
          [],
        );
      }
    },
    [sendShadcnAppliedMessage],
  );

  // Set up postMessage listener
  useEffect(() => {
    function handleMessage(event: MessageEvent<IncomingMessage>) {
      // Validate origin
      if (!validateOrigin(event.origin)) {
        return;
      }

      const { type, payload } = event.data;

      switch (type) {
        case "FORMCRAFT_FORM_UPDATE":
          setCurrentFormSchema(payload);
          break;

        case "FORMCRAFT_MODE_UPDATE":
          setCurrentFormMode(payload.formMode);
          break;

        case "FORMCRAFT_SHADCN_CSS_UPDATE":
          // Avoid infinite loops by skipping if CSS hasn't changed
          if (payload.cssText !== lastCssRef.current) {
            applyShadcnCSS(payload.cssText);
          }
          break;

        case "FORMCRAFT_THEME_MODE_UPDATE": {
          const next = payload.mode;
          const root = document.documentElement;
          root.classList.remove("light", "dark");
          if (next === "dark") root.classList.add("dark");
          if (next === "light") root.classList.add("light");
          // system = remove both classes; CSS defaults should apply
          // Update inline variables to match the new mode immediately
          try {
            themeApplicator.current.syncInlineForCurrentMode();
            void document.documentElement.offsetHeight;
          } catch {}
          break;
        }

        default:
        // Unknown message type - silently ignore
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("message", handleMessage);

      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [applyShadcnCSS]);

  // Create search params that force the desired form mode
  const searchParams = {
    formlinkai_testmode: "true",
    mode:
      currentFormMode === "typeform"
        ? "typeform"
        : currentFormMode === "classic"
          ? "classic"
          : "chat",
    // Keep aimode for backward compatibility
    aimode: currentFormMode === "chat" ? "true" : "false",
  };

  // Heuristic polling to reduce preview lag in non-chat modes:
  // If only 0-1 question is currently available right after generation starts,
  // poll the form schema for a short time to pick up newly generated questions without requiring a hard reload.
  useEffect(() => {
    // Only relevant for classic/typeform previews; chat mode streams via AI route
    if (currentFormMode === "chat") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const maxAttempts = 10;
    let attempts = 0;

    const currentCount = Array.isArray(currentFormSchema?.questions)
      ? currentFormSchema.questions.length
      : 0;

    // Only poll if it looks like we don't yet have the full schema
    if (currentCount <= 1) {
      const poll = async () => {
        try {
          attempts++;
          const res = await fetch(`/api/forms/${initialFormSchema.id}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (res.ok) {
            const data = (await res.json()) as Form;
            const newCount = Array.isArray(data.questions)
              ? data.questions.length
              : 0;
            const currCount = Array.isArray(currentFormSchema?.questions)
              ? currentFormSchema.questions.length
              : 0;

            // Update when we see more questions than we currently have
            if (newCount > currCount) {
              setCurrentFormSchema(data);
            }
          }
        } catch {
          // swallow and retry
        } finally {
          if (attempts < maxAttempts) {
            timer = setTimeout(poll, 2000);
          }
        }
      };

      // kick off polling
      poll();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentFormMode, currentFormSchema?.questions, initialFormSchema.id]);

  return (
    <div className="h-full w-full">
      <FormPageClient
        formSchema={currentFormSchema}
        isTestSubmission={isTestSubmission}
        queryDataForForm={{}}
        searchParams={searchParams}
      />
    </div>
  );
}
