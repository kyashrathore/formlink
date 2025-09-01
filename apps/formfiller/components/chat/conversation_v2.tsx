"use client";

import {
  Conversation as AIConversation,
  ConversationContent,
  ConversationScrollButton,
  Message as AIMessage,
  MessageContent,
} from "@formlink/ui/ai-elements";
import { UIMessage as MessageType } from "@ai-sdk/react";
import { Form } from "@formlink/schema";
import { useRef } from "react";
import { MessageLoading } from "./message-loading";
import { MessageAssistant } from "./message-assistant";

type ConversationProps = {
  data?: Form | null;
  messages: MessageType[];
  status?: "streaming" | "ready" | "submitted" | "error";
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  onSubmitSelection?: (
    questionId: string,
    value: any,
    displayText: string,
  ) => Promise<void>;
};

export function Conversation({
  messages,
  status = "ready",
  handleFileUpload,
  onSubmitSelection,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length);

  // Filter out hidden messages
  const visibleMessages = messages.filter((msg) => {
    const msgWithHidden = msg as MessageType & { hidden?: boolean };
    return !msgWithHidden.hidden;
  });

  return (
    <AIConversation className="relative flex h-[calc(75vh)] w-full overflow-y-auto overflow-x-hidden">
      <ConversationContent className="flex w-full flex-col items-center">
        {visibleMessages?.map((message, index) => {
          const isLast =
            index === visibleMessages.length - 1 && status !== "submitted";
          const hasScrollAnchor =
            isLast && messages.length > initialMessageCount.current;

          if (message.role === "user") {
            // Extract text from AI SDK v5 format: message.parts
            const textPart = message.parts?.find((p: any) => p.type === "text") as any;
            const userText = textPart?.text || (message as any).content || "";
            return (
              <AIMessage
                key={message.id}
                from="user"
                className="w-full max-w-3xl"
              >
                <MessageContent>
                  {userText}
                </MessageContent>
              </AIMessage>
            );
          }

          if (message.role === "assistant") {
            // Use the existing MessageAssistant component to preserve question rendering
            return (
              <MessageAssistant
                key={message.id}
                message={message}
                isLast={isLast}
                hasScrollAnchor={hasScrollAnchor}
                handleFileUpload={handleFileUpload}
                onSubmitSelection={onSubmitSelection}
              />
            );
          }

          return null;
        })}
        {(status === "submitted" || status === "streaming") && (
          <MessageLoading />
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </AIConversation>
  );
}
