"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Form } from "@formlink/schema";
import FormPageClient from "@/app/[formId]/FormPageClient";
import { ThemeApplicator } from "@/lib/theme/ThemeApplicator";

// Message types for postMessage communication
interface FormUpdateMessage {
  type: "FORMCRAFT_FORM_UPDATE";
  payload: Form;
}

interface FormModeUpdateMessage {
  type: "FORMCRAFT_MODE_UPDATE";
  payload: {
    formMode: "chat" | "typeform";
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
  | FormShadcnCSSUpdateMessage;

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
  return ["https://app.formcraft.com", "https://formcraft.com"];
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
  const [currentFormMode, setCurrentFormMode] = useState<"chat" | "typeform">(
    "chat",
  );
  const hasNotifiedReady = useRef(false);
  const themeApplicator = useRef(new ThemeApplicator());

  // Send ready message to parent when component mounts
  useEffect(() => {
    if (!hasNotifiedReady.current && typeof window !== "undefined") {
      const readyMessage: PreviewReadyMessage = {
        type: "FORMFILLER_PREVIEW_READY",
        formId: initialFormSchema.id,
      };

      // Send to parent window
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(readyMessage, "*");
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
        window.parent.postMessage(message, "*");
      }
    },
    [],
  );

  // Function to apply shadcn CSS variables directly
  const applyShadcnCSS = useCallback(
    (cssText: string) => {
      try {
        const result = themeApplicator.current.applyShadcnVariables(cssText);

        if (result.success) {
          sendShadcnAppliedMessage(
            true,
            undefined,
            result.appliedRootVariables,
            result.appliedDarkVariables,
            result.warnings,
          );
          console.log(
            `Applied ${result.appliedRootVariables.length} root variables and ${result.appliedDarkVariables.length} dark variables`,
          );
        } else {
          console.error("Shadcn CSS application failed:", result);
          sendShadcnAppliedMessage(
            false,
            result.error || "Shadcn CSS application failed",
            [],
            [],
            result.warnings,
          );
        }

        // Log warnings if any
        if (result.warnings.length > 0) {
          console.warn("Shadcn CSS application warnings:", result.warnings);
        }
      } catch (error) {
        console.error("Failed to apply shadcn CSS:", error);
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
        console.warn(`Blocked message from untrusted origin: ${event.origin}`);
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
          applyShadcnCSS(payload.cssText);
          break;

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
    mode: currentFormMode === "typeform" ? "typeform" : "chat",
    // Keep aimode for backward compatibility
    aimode: currentFormMode === "chat" ? "true" : "false",
  };

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
