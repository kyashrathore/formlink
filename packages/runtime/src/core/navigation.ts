import type { Form } from "../schema";
import type { RuntimeValues } from "../types";

export function getEligibleQuestionIds(
  form: Form,
  _values: RuntimeValues,
): string[] {
  const sorted = [...form.questions].sort((a, b) => {
    const ai = a.questionNo ?? Number.MAX_SAFE_INTEGER;
    const bi = b.questionNo ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  // TODO(runtime): Integrate journeyScript + conditionalLogic evaluation.
  return sorted.map((question) => question.id);
}

export function getInitialQuestionId(eligibleIds: string[]): string | null {
  const first = eligibleIds[0];
  return typeof first === "string" ? first : null;
}

export function getNextQuestionId(
  currentId: string | null,
  eligibleIds: string[],
): string | null {
  if (!currentId) {
    const first = eligibleIds[0];
    return first ?? null;
  }
  const idx = eligibleIds.findIndex((id) => id === currentId);
  if (idx === -1) {
    const first = eligibleIds[0];
    return first ?? null;
  }
  const next = eligibleIds[idx + 1];
  if (next !== undefined) return next;
  return null;
}

export function getPreviousQuestionId(
  currentId: string | null,
  eligibleIds: string[],
): string | null {
  if (!currentId) {
    const first = eligibleIds[0];
    return first ?? null;
  }
  const idx = eligibleIds.findIndex((id) => id === currentId);
  if (idx <= 0) {
    const first = eligibleIds[0];
    return first ?? null;
  }
  const candidate = eligibleIds[idx - 1];
  if (candidate !== undefined) return candidate;
  const first = eligibleIds[0];
  return first ?? null;
}
