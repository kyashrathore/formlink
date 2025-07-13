"use client";

import React from "react";
import { Button } from "../../../ui/button";
import { ArrowRight } from "lucide-react";
// Note: Using any for compatibility with both schema and UI types
import { useFormMode } from "../../context/FormModeContext";
import { cn } from "../../../lib/utils";

export interface IntroScreenProps {
  formSchema: { title?: string; description?: string };
  onStart: () => void;
  className?: string;
}

export function IntroScreen({
  formSchema,
  onStart,
  className,
}: IntroScreenProps) {
  const { mode } = useFormMode();

  if (!formSchema) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-screen px-4 py-12",
        className,
      )}
    >
      <div className="w-full max-w-md text-center space-y-6">
        <h1
          className={cn(
            "text-3xl font-bold mb-4",
            mode === "typeform" ? "text-foreground" : "text-primary",
          )}
        >
          {formSchema.title}
        </h1>

        {formSchema.description && (
          <p className="text-muted-foreground mb-8">{formSchema.description}</p>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={onStart}
          type="button"
          variant={mode === "typeform" ? "default" : "ghost"}
        >
          Begin Survey
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default IntroScreen;
