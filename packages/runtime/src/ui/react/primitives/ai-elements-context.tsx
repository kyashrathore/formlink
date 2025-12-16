"use client";
import * as React from "react";

type AnyComponent = React.ComponentType<any>;

export type AiElementsPrimitives = {
  Conversation: AnyComponent;
  ConversationContent: AnyComponent;
  ConversationScrollButton: AnyComponent;
  PromptInput: AnyComponent;
  PromptInputHeader: AnyComponent;
  PromptInputTextarea: AnyComponent;
  PromptInputSubmit: AnyComponent;
  Response: AnyComponent;
  Reasoning?: AnyComponent;
  ReasoningTrigger?: AnyComponent;
  ReasoningContent?: AnyComponent;
};

const AiElementsContext = React.createContext<AiElementsPrimitives | null>(
  null,
);

export function AiElementsProvider({
  components,
  children,
}: {
  components: AiElementsPrimitives;
  children: React.ReactNode;
}) {
  const isDev =
    typeof globalThis !== "undefined" &&
    (globalThis as { process?: { env?: Record<string, unknown> } })?.process
      ?.env?.NODE_ENV !== "production";
  if (isDev) {
    const required: Array<keyof AiElementsPrimitives> = [
      "Conversation",
      "ConversationContent",
      "ConversationScrollButton",
      "PromptInput",
      "PromptInputHeader",
      "PromptInputTextarea",
      "PromptInputSubmit",
      "Response",
    ];
    const missing = required.filter((k) => !components?.[k]);
    if (missing.length > 0) {
      throw new Error(
        `[AiElementsProvider] Missing required ai-elements: ${missing.join(", ")}.\n` +
          `Provide them via <AiElementsProvider components={{...}}>. If you use @formlink/ui, map from '@formlink/ui/ai-elements'.`,
      );
    }
  }
  return (
    <AiElementsContext.Provider value={components}>
      {children}
    </AiElementsContext.Provider>
  );
}

export function useAiElements(): AiElementsPrimitives {
  const ctx = React.useContext(AiElementsContext);
  if (!ctx) {
    throw new Error(
      "useAiElements must be used within an AiElementsProvider. Provide components via <AiElementsProvider>.",
    );
  }
  return ctx;
}
