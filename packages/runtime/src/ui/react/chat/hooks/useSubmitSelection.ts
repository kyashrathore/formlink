"use client";
import * as React from "react";

type SendMessage = (
  message: { text: string; files?: any[] },
  opts?: { body?: Record<string, any> },
) => Promise<any> | void;

export function useSubmitSelection(opts: {
  sendMessage: SendMessage;
  currentQuestionId: string | null | undefined;
  getFormSchema?: () => any;
  getResponses?: () => Record<string, unknown>;
  getSubmissionId?: () => string | null | undefined;
  getUserId?: () => string | null | undefined;
  delayMs?: number;
}) {
  const {
    sendMessage,
    currentQuestionId,
    getFormSchema,
    getResponses,
    getSubmissionId,
    getUserId,
    delayMs = 250,
  } = opts;
  const timerRef = React.useRef<number | null>(null);

  const submitSelection = React.useCallback(
    async (questionId: string, value: unknown, displayText: string) => {
      if (!questionId) return;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      await new Promise<void>((resolve) => {
        timerRef.current = window.setTimeout(
          () => resolve(),
          Math.max(0, delayMs),
        );
      });
      const formSchema = getFormSchema ? getFormSchema() : undefined;
      const responses = getResponses ? getResponses() : {};
      const submissionId = getSubmissionId ? getSubmissionId() : undefined;
      const userId = getUserId ? getUserId() : undefined;
      sendMessage(
        { text: displayText },
        {
          body: {
            userInput: displayText,
            submissionBehavior: "auto",
            currentQuestionId: currentQuestionId ?? questionId,
            formSchema,
            responses,
            justSavedAnswer: { questionId, value },
            submissionId,
            userId,
          },
        },
      );
    },
    [
      sendMessage,
      currentQuestionId,
      getFormSchema,
      getResponses,
      getSubmissionId,
      getUserId,
      delayMs,
    ],
  );

  return { submitSelection } as const;
}
