import type { IntentResult, InputIntent } from "./input-intent";
import { detectInputIntent } from "./input-intent";

export type UseSubmitGateOptions = {
  expectedFormat: InputIntent | null | undefined;
  value: string;
  confidence?: number; // default 0.9
};

export type SubmitGateResult = {
  canSubmit: boolean;
  block: boolean;
  reason?: string;
  detection: IntentResult;
  onAttempt: () => void;
};

/**
 * Stateless submit-gate helper. Use directly or wrap in a React hook.
 */
export function useSubmitGate(opts: UseSubmitGateOptions): SubmitGateResult {
  const { expectedFormat, value, confidence = 0.9 } = opts;
  const detection = detectInputIntent(value);
  const isExpected = Boolean(
    expectedFormat && detection.intent === expectedFormat,
  );
  const isHighConfidenceInvalid = Boolean(
    isExpected &&
      detection.confidence >= confidence &&
      detection.valid === false,
  );
  const block = isHighConfidenceInvalid;
  const canSubmit = !block && Boolean(value.trim());
  return {
    canSubmit,
    block,
    reason: block ? "high-confidence-invalid" : undefined,
    detection,
    onAttempt: () => void 0,
  };
}

// Alias without a `use*` prefix to avoid confusion with React Hooks.
export function submitGate(opts: UseSubmitGateOptions): SubmitGateResult {
  return useSubmitGate(opts);
}
