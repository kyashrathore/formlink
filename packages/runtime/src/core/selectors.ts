import type { FieldMeta } from "@tanstack/form-core";
import type { Question } from "../schema";
import type {
  RuntimeContextSnapshot,
  RuntimeFieldErrors,
  RuntimeProgress,
  RuntimeStatus,
  RuntimeValues,
} from "../types";

export function computeProgress(
  currentId: string | null,
  eligibleIds: string[],
): RuntimeProgress {
  if (eligibleIds.length === 0) {
    return { index: -1, total: 0, percent: 0 };
  }

  const index =
    currentId !== null
      ? Math.max(
          0,
          Math.min(
            eligibleIds.length - 1,
            eligibleIds.findIndex((id) => id === currentId),
          ),
        )
      : 0;

  const percent =
    eligibleIds.length === 0
      ? 0
      : Math.round(((index + 1) / eligibleIds.length) * 100);

  return { index, total: eligibleIds.length, percent };
}

export function buildFieldErrors(
  meta: Record<string, FieldMeta> | undefined,
): RuntimeFieldErrors {
  if (!meta) return {};
  return Object.entries(meta).reduce<RuntimeFieldErrors>(
    (acc, [key, value]) => {
      const raw = (value as unknown as { errors?: unknown })?.errors;
      const errors = Array.isArray(raw) ? raw : [];
      if (errors.length > 0) {
        acc[key] = errors.map((err) => {
          if (typeof err === "string") return err;
          if (err && typeof err === "object" && "message" in err) {
            const message = (err as { message?: unknown }).message;
            if (typeof message === "string") return message;
          }
          return "Invalid input";
        });
      }
      return acc;
    },
    {},
  );
}

export function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function computeUnansweredIds(
  eligibleIds: string[],
  values: RuntimeValues,
  questionMap: Map<string, Question>,
): string[] {
  return eligibleIds.filter((id) => {
    const question = questionMap.get(id);
    if (!question) return false;
    const required =
      question.validations?.required?.value !== undefined
        ? Boolean(question.validations.required.value)
        : false;
    if (!required) return false;
    const value = values[id];
    return !isAnswered(value);
  });
}

export function createSnapshot({
  status,
  currentId,
  eligibleIds,
  values,
  errors,
  questionMap,
  isValid,
  isSubmitting,
}: {
  status: RuntimeStatus;
  currentId: string | null;
  eligibleIds: string[];
  values: RuntimeValues;
  errors: RuntimeFieldErrors;
  questionMap: Map<string, Question>;
  isValid: boolean;
  isSubmitting: boolean;
}): RuntimeContextSnapshot {
  const unansweredIds = computeUnansweredIds(eligibleIds, values, questionMap);
  const progress = computeProgress(currentId, eligibleIds);
  return {
    status,
    currentId,
    eligibleIds,
    progress,
    values,
    errors,
    firstUnansweredId: unansweredIds[0] ?? null,
    unansweredIds,
    isValid,
    isSubmitting,
  };
}
