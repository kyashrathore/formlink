"use client";
import type { InputIntent } from "@/headless/ai/input-intent";
import { PhoneCountrySelector } from "./PhoneCountrySelector";

export type TypedInputGate = {
  expected: InputIntent | null;
  detection: { intent: any; confidence: number; valid: boolean | null };
  block: boolean;
  isIntentMatch: boolean;
  showValidation: boolean;
  setShowValidation: (v: boolean) => void;
};

export type PromptInputTypedAssistProps = {
  expectedFormat: InputIntent | null;
  value: string;
  onValueChange: (v: string) => void;
  gate?: TypedInputGate;
  alwaysShowTelSelector?: boolean;
  getControlElement?: () => HTMLTextAreaElement | HTMLInputElement | null;
};

export function PromptInputTypedAssist({
  expectedFormat,
  value,
  onValueChange,
  gate,
  alwaysShowTelSelector = true,
  getControlElement,
}: PromptInputTypedAssistProps) {
  if (!expectedFormat) return null;
  const showError = Boolean(gate?.showValidation && gate?.block);
  const showTelSelector =
    expectedFormat === "tel" && (alwaysShowTelSelector || showError);
  return (
    <div className="flex items-center gap-2 text-xs">
      {showTelSelector ? (
        <PhoneCountrySelector
          value={value}
          onValueChange={onValueChange}
          getControlElement={getControlElement}
        />
      ) : null}
      {showError ? (
        <div className="text-destructive">
          {expectedFormat === "tel" && "That phone number looks invalid"}
          {expectedFormat === "email" && "That email doesn’t look valid"}
          {expectedFormat === "url" && "That URL doesn’t look valid"}
          {expectedFormat === "number" && "That number doesn’t look valid"}
        </div>
      ) : null}
    </div>
  );
}
