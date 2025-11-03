export type KeyboardFeatureFlags = {
  enterToContinue?: boolean;
  lettersForChoices?: boolean;
  numbersForScale?: boolean;
};

export type KeyboardContext = {
  // Current question type family for interpreting shortcuts
  family:
    | "singleChoice"
    | "multipleChoice"
    | "likertScale"
    | "rating"
    | "linearScale"
    | "triggerSelect"
    | "date"
    | "text"
    | "textarea"
    | "ranking"
    | "fileUpload"
    | "address"
    | "signature";
  // For choice families
  optionCount?: number;
  // For linear scale
  linear?: { start: number; end: number; step?: number };
  // For rating
  rating?: { min?: number; max?: number };
};

export type KeyboardRequest = {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  composing?: boolean;
  defaultPrevented?: boolean;
  // Adapter-supplied environment bails
  overlayOpen?: boolean;
  inEditable?: boolean;
  // True if the event target (or its ancestors) opted out via data attribute
  scopeBailed?: boolean;
  // True if the handler is scoped to the active question container
  scopeActive?: boolean;
  // Allow-enter exception (e.g., input[type=date])
  allowEnterInEditable?: boolean;
};

export type KeyboardIntent =
  | { type: "None" }
  | { type: "Continue" }
  | { type: "SelectIndex"; index: number; autoAdvance: boolean }
  | { type: "ToggleIndex"; index: number }
  | { type: "SetNumber"; value: number; autoAdvance: boolean };

const LETTER_RE = /^[a-zA-Z]$/;
const DIGIT_1_9_RE = /^[1-9]$/;

export function interpretKeyboard(
  req: KeyboardRequest,
  ctx: KeyboardContext,
  flags: KeyboardFeatureFlags = {
    enterToContinue: true,
    lettersForChoices: true,
    numbersForScale: true,
  },
): KeyboardIntent {
  // Global bails
  if (req.overlayOpen) return { type: "None" };
  if (req.defaultPrevented) return { type: "None" };
  if (req.composing) return { type: "None" };
  if (req.scopeBailed) return { type: "None" };
  if (req.metaKey || req.ctrlKey || req.altKey) return { type: "None" };
  if (req.inEditable && !req.allowEnterInEditable) return { type: "None" };

  const key = req.key;
  const hasLetters = flags.lettersForChoices ?? true;
  const hasNumbers = flags.numbersForScale ?? true;

  // Choice families (letters/digits map to option index)
  if (
    (ctx.family === "singleChoice" ||
      ctx.family === "multipleChoice" ||
      ctx.family === "likertScale") &&
    typeof ctx.optionCount === "number"
  ) {
    const count = Math.max(0, ctx.optionCount);
    if (hasLetters && LETTER_RE.test(key)) {
      const idx = key.toUpperCase().charCodeAt(0) - 65; // A -> 0
      if (idx >= 0 && idx < count) {
        if (ctx.family === "multipleChoice")
          return { type: "ToggleIndex", index: idx };
        return { type: "SelectIndex", index: idx, autoAdvance: true };
      }
    }
    if (hasLetters && DIGIT_1_9_RE.test(key)) {
      const idx = parseInt(key, 10) - 1;
      if (idx >= 0 && idx < count) {
        if (ctx.family === "multipleChoice")
          return { type: "ToggleIndex", index: idx };
        return { type: "SelectIndex", index: idx, autoAdvance: true };
      }
    }
  }

  // Scale families (digits map to numeric values)
  if (hasNumbers && DIGIT_1_9_RE.test(key)) {
    const num = parseInt(key, 10);
    if (ctx.family === "rating") {
      const min = ctx.rating?.min ?? 1;
      const max = ctx.rating?.max ?? 5;
      if (num >= min && num <= max) {
        return { type: "SetNumber", value: num, autoAdvance: true };
      }
    } else if (ctx.family === "linearScale") {
      const start = ctx.linear?.start ?? 1;
      const end = ctx.linear?.end ?? 1;
      const step = ctx.linear?.step ?? 1;
      const inRange =
        start <= end ? num >= start && num <= end : num <= start && num >= end;
      const aligns = (num - start) % step === 0;
      if (inRange && aligns)
        return { type: "SetNumber", value: num, autoAdvance: true };
    }
  }

  // Global Enter to continue
  if (
    (flags.enterToContinue ?? true) &&
    key === "Enter" &&
    !req.shiftKey &&
    !req.ctrlKey &&
    !req.metaKey &&
    !req.altKey
  ) {
    // If inside a multipleChoice option, adapter should set scopeBailed; we also allow adapters
    // to pass scopeActive to restrict Enter to the active question.
    return { type: "Continue" };
  }

  return { type: "None" };
}
