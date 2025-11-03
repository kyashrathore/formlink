"use client";

import * as React from "react";

type SendMessage = (
  message: { text: string },
  opts?: { body?: Record<string, any> },
) => Promise<any> | void;

export type UseChatStartCardOptions = {
  // Required integration points from host
  sendMessage: SendMessage;
  getFormSchema: () => any | null;
  getResponses?: () => Record<string, any>;
  getCurrentQuestionId?: () => string | null | undefined;

  // UI/control state
  messages: Array<any>;
  status: "ready" | "submitted" | "streaming" | "error";

  // Behavior
  startText?: string; // default: "Start"
  buildBody?: (args: {
    text: string;
    formSchema: any;
    currentQuestionId: string | null | undefined;
    responses: Record<string, any>;
  }) => Record<string, any>;
};

export type UseChatStartCardReturn = {
  started: boolean;
  canStart: boolean;
  start: () => void;
};

/**
 * useChatStartCard
 * - Derives whether the conversation has started from message history.
 * - Provides a canonical `start()` that sends the first user message with the required body.
 * - Keeps host-specific details injectable through `buildBody`.
 */
export function useChatStartCard(
  options: UseChatStartCardOptions,
): UseChatStartCardReturn {
  const {
    messages,
    status,
    sendMessage,
    getFormSchema,
    getResponses,
    getCurrentQuestionId,
    startText = "Start",
    buildBody,
  } = options;

  const started = messages.length > 0;
  const canStart = status === "ready";

  const start = React.useCallback(() => {
    const formSchema = getFormSchema();
    if (!formSchema) return;
    if (status === "streaming" || status === "submitted") return;

    const text = startText;
    const currentQuestionId = getCurrentQuestionId?.() ?? null;
    const responses = (getResponses?.() ?? {}) as Record<string, any>;

    const body = buildBody
      ? buildBody({ text, formSchema, currentQuestionId, responses })
      : {
          userInput: text,
          submissionBehavior: "manualUnclear",
          currentQuestionId,
          formSchema,
          responses,
        };

    sendMessage({ text }, { body });
  }, [
    buildBody,
    getCurrentQuestionId,
    getFormSchema,
    getResponses,
    sendMessage,
    startText,
    status,
  ]);

  return { started, canStart, start } as const;
}
