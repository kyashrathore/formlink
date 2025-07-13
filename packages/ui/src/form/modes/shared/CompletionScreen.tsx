"use client";

import React from "react";
import { cn } from "../../../lib/utils";
import { Award } from "lucide-react";
import { Button } from "../../../ui/button";
import { ConfettiElements } from "./ConfettiElements";
import { useFormMode } from "../../context/FormModeContext";

export interface CompletionScreenProps {
  isMobileView?: boolean;
  showConfetti: boolean;
  onRestart: () => void;
  className?: string;
}

export function CompletionScreen({
  isMobileView = false,
  showConfetti,
  onRestart,
  className,
}: CompletionScreenProps) {
  const { mode } = useFormMode();
  const isTypeform = mode === "typeform";

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card text-card-foreground p-6 justify-between relative overflow-hidden",
        !isTypeform && "rounded-md border",
        isMobileView && "p-4",
        className,
      )}
    >
      {showConfetti && <ConfettiElements />}
      <div className="space-y-4 text-center z-10">
        <h2 className={cn("font-bold", isMobileView ? "text-xl" : "text-2xl")}>
          Form Completed!
        </h2>
        <div className="flex justify-center mb-4">
          <Award
            className={cn(
              "text-primary",
              isMobileView ? "w-12 h-12" : "w-16 h-16",
            )}
          />
        </div>
        <p className="text-muted-foreground">
          Thank you for completing the form. Your responses have been submitted
          successfully.
        </p>
      </div>
      <Button
        onClick={onRestart}
        className={cn("mt-auto w-full", isMobileView && "text-sm py-3")}
        size="lg"
        variant={isTypeform ? "default" : "ghost"}
      >
        Start Over
      </Button>
    </div>
  );
}

export default CompletionScreen;
