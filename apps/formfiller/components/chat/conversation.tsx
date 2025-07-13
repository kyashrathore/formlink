"use client";

import { Button } from "@formlink/ui";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDown } from "lucide-react";

import { useRef } from "react";
import { Message } from "./message";
import { MessageLoading } from "./message-loading";

import { Message as MessageType } from "@ai-sdk/react";
type ConversationProps = {
  data: any; // Changed type to any for now to accommodate currentQuestion
  messages: MessageType[];
  status?: "streaming" | "ready" | "submitted" | "error";
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
};  

// Scroll button component
const ConversationScrollButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  
  return !isAtBottom ? (
    <Button
      size="icon"
      variant="secondary"
      className="absolute bottom-4 right-4 rounded-full shadow-md hover:shadow-lg transition-shadow z-10"
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
    </Button>
  ) : null;
};

export function Conversation({
  messages,
  status = "ready",
  handleFileUpload,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length);

  // Filter out hidden messages
  const visibleMessages = messages.filter(msg => !(msg as any).hidden);

  return (
    <StickToBottom 
      className="relative flex h-[calc(75vh)] w-full overflow-y-auto overflow-x-hidden"
      resize="smooth"
      initial="smooth"
    >
      <StickToBottom.Content className="flex w-full flex-col items-center">
        {visibleMessages?.map((message, index) => {
          const isLast =
            index === visibleMessages.length - 1 && status !== "submitted";
          const hasScrollAnchor =
            isLast && messages.length > initialMessageCount.current;
          return (
            <Message
              message={message}
              key={message.id}
              id={message.id}
              variant={message.role}
              isLast={isLast}
              hasScrollAnchor={hasScrollAnchor}
              handleFileUpload={handleFileUpload}
            />
          );
        })}
        {(status === "submitted" || status === "streaming") && (
          <MessageLoading />
        )}
      </StickToBottom.Content>
      <ConversationScrollButton />
    </StickToBottom>
  );
}
