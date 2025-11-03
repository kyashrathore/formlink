"use client";
import * as React from "react";
import type { InputIntent, IntentResult } from "@/headless/ai/input-intent";
import { detectInputIntent } from "@/headless/ai/input-intent";

export type UseTypedInputGateOptions = {
  expectedFormat: InputIntent | null;
  value: string;
  confidence?: number;
};

export type TypedInputGate = {
  expected: InputIntent | null;
  detection: IntentResult;
  block: boolean;
  isIntentMatch: boolean;
  showValidation: boolean;
  setShowValidation: (v: boolean) => void;
  confidence: number;
};

export function useTypedInputGate(
  opts: UseTypedInputGateOptions,
): TypedInputGate {
  const { expectedFormat, value, confidence = 0.85 } = opts;
  const [showValidation, setShowValidation] = React.useState(false);
  const detection = React.useMemo(() => detectInputIntent(value), [value]);
  const isIntentMatch = Boolean(
    expectedFormat && detection.intent === expectedFormat,
  );
  const block = Boolean(
    expectedFormat &&
      isIntentMatch &&
      detection.confidence >= confidence &&
      detection.valid === false,
  );

  React.useEffect(() => {
    if (showValidation && detection.valid === true) setShowValidation(false);
  }, [showValidation, detection.valid]);

  return {
    expected: expectedFormat,
    detection,
    block,
    isIntentMatch,
    showValidation,
    setShowValidation,
    confidence,
  } as const;
}
