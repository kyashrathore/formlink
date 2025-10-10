"use client";

import { useChatStore } from "@/components/chat/store/useChatStore";
import { useChatMessages, useChatStatus } from "@ai-sdk-tools/store";
import { UIMessage as MessageType } from "@ai-sdk/react";
import { Form } from "@formlink/schema";
import {
  Conversation as AIConversation,
  ConversationContent,
  ConversationScrollButton,
} from "@formlink/ui/ai-elements";
import React, { useEffect, useMemo, useRef } from "react";
import { useSlotBridge } from "./hooks/useSlotBridge";
import { MessageAssistant } from "./message-assistant";
import { MessageLoading } from "./message-loading";
import { MessageUser } from "./message-user";

// Not using slot token to drive spinner; status is authoritative.

type ConversationProps = {
  data?: Form | null;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  onSubmitSelection?: (
    questionId: string,
    value: any,
    displayText: string,
  ) => Promise<void>;
  introBlock?: React.ReactNode;
  onToolResult?: (toolName: string, result: any) => void;
  onFirstAssistant?: () => void;
};

//

const ConversationComponent = ({
  handleFileUpload,
  onSubmitSelection,
  introBlock,
  onToolResult,
  onFirstAssistant,
}: ConversationProps) => {
  // Localized subscriptions to the chat store
  const messages = useChatMessages();
  const status = useChatStatus();

  const initialMessageCount = useRef(messages.length);

  // Filter out hidden messages
  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => {
      const msgWithHidden = msg as MessageType & { hidden?: boolean };
      return !msgWithHidden.hidden;
    });
  }, [messages]);

  const lastAssistant = useMemo(() => {
    return [...visibleMessages].reverse().find((m) => m.role === "assistant");
  }, [visibleMessages]);
  const firstAssistantSeenRef = useRef(false);
  useEffect(() => {
    if (firstAssistantSeenRef.current) return;
    const hasAssistant = visibleMessages.some((m) => m.role === "assistant");
    if (hasAssistant) {
      firstAssistantSeenRef.current = true;
      onFirstAssistant?.();
    }
  }, [visibleMessages, onFirstAssistant]);
  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i]?.role === "assistant") return i;
    }
    return -1;
  }, [visibleMessages]);

  const showLoading = status !== "ready";
  // Intentionally reduce log spam; uncomment if needed
  // debugLog("Conversation status", { status, lastAssistantId: (lastAssistant as any)?.id, showLoading });

  // Bridge slot token → set currentQuestionId in Zustand (localized here)
  useSlotBridge({ messages: visibleMessages });

  // Keep global chatHistoryMessages in sync with the UI-visible list
  const setChatHistoryMessages = useChatStore((s) => s.setChatHistoryMessages);
  const lastHistorySigRef = useRef<string>("");
  useEffect(() => {
    const sig = visibleMessages
      .map(
        (m: any) =>
          `${m.id}:${m.role}:${Array.isArray(m.parts) ? m.parts.length : 0}`,
      )
      .join("#");
    if (sig !== lastHistorySigRef.current) {
      setChatHistoryMessages(visibleMessages);
      lastHistorySigRef.current = sig;
    }
  }, [visibleMessages, setChatHistoryMessages]);

  // Removed live tool application; tools are applied in onFinish for stability.

  return (
    <AIConversation className="relative flex h-[calc(75vh)] w-full overflow-y-auto overflow-x-hidden">
      <ConversationContent className="flex w-full flex-col items-center">
        {visibleMessages.length === 0 && status !== "streaming" && introBlock}
        {visibleMessages?.map((message, index) => {
          const msgKey = String(
            (message as any)?.id ??
              `mi-${index}-${message.role}-${Array.isArray((message as any)?.parts) ? (message as any).parts.length : 0}`,
          );
          const isLastMessage =
            index === visibleMessages.length - 1 && status !== "submitted";
          const hasScrollAnchor =
            isLastMessage && messages.length > initialMessageCount.current;
          const isLastAssistant =
            message.role === "assistant" && index === lastAssistantIndex;

          if (message.role === "user") {
            return (
              <MessageUser
                key={msgKey}
                id={String(message.id)}
                message={message}
                hasScrollAnchor={hasScrollAnchor}
              />
            );
          }

          if (message.role === "assistant") {
            return (
              <MessageAssistant
                key={msgKey}
                message={message}
                isLast={isLastAssistant}
                hasScrollAnchor={hasScrollAnchor}
                handleFileUpload={handleFileUpload}
                onSubmitSelection={onSubmitSelection}
              />
            );
          }

          return null;
        })}
        {showLoading && <MessageLoading />}
      </ConversationContent>
      <ConversationScrollButton />
    </AIConversation>
  );
};

function areConversationPropsEqual(
  prev: ConversationProps,
  next: ConversationProps,
): boolean {
  if (prev.handleFileUpload !== next.handleFileUpload) return false;
  if (prev.onSubmitSelection !== next.onSubmitSelection) return false;
  if (prev.onToolResult !== next.onToolResult) return false;
  if (prev.introBlock !== next.introBlock) return false;
  return true;
}

export const Conversation = React.memo(
  ConversationComponent,
  areConversationPropsEqual,
);
