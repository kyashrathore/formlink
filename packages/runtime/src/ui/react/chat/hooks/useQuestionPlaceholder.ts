"use client";

import * as React from "react";

export type QuestionLike = {
  id?: string;
  title?: string;
  label?: string;
  description?: string;
  type?: { name?: string; format?: string } | null;
};

export type UseQuestionPlaceholderOptions = {
  question: QuestionLike | null | undefined;
  defaultPlaceholder?: string; // default: "What would you like to know?"
};

export type UseQuestionPlaceholderReturn = {
  format: string | null; // null when not a text question
  placeholder: string;
};

/**
 * Derives input format and a sensible placeholder for the current question.
 * - For non-text questions, returns format=null and description/title/label fallback placeholder.
 * - For text questions, maps common formats (email/url/tel/number/password) to canonical examples.
 */
export function useQuestionPlaceholder(
  opts: UseQuestionPlaceholderOptions,
): UseQuestionPlaceholderReturn {
  const { question, defaultPlaceholder = "What would you like to know?" } =
    opts;

  const format: string | null = React.useMemo(() => {
    if (!question) return null;
    const name = question?.type?.name;
    if (name !== "text") return null;
    return question?.type?.format ?? "text";
  }, [question]);

  const described = React.useMemo(() => {
    const desc = (question?.description || "").trim();
    if (desc) return desc;
    const title = (question?.title || "").trim();
    if (title) return title;
    const label = (question?.label || "").trim();
    if (label) return label;
    return undefined;
  }, [question]);

  const placeholder = React.useMemo(() => {
    if (!format) return described ?? defaultPlaceholder;
    switch (format) {
      case "email":
        return "example@example.com";
      case "url":
        return "https://example.com";
      case "tel":
        return "+1 555 555 5555";
      case "number":
        return "e.g. 123";
      case "password":
        return "••••••••";
      case "text":
      case "textarea":
      default:
        return described ?? defaultPlaceholder;
    }
  }, [format, described, defaultPlaceholder]);

  return { format, placeholder } as const;
}
