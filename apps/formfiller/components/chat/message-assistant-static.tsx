"use client";

import React from "react";
import { UIMessage as MessageType } from "@ai-sdk/react";
import { Message, MessageContent, Response } from "@formlink/ui/ai-elements";
import { cn } from "@formlink/ui/lib/utils";

type MessageAssistantStaticProps = {
  message: MessageType;
  hasScrollAnchor?: boolean;
};

function stripInputTokens(text: string): string {
  return text.replace(
    /::PresentQuestionInputComponent\s+qId=["']([^"']+)["']::/g,
    "",
  );
}

export function MessageAssistantStatic({
  message,
  hasScrollAnchor,
}: MessageAssistantStaticProps) {
  const parts = Array.isArray((message as any)?.parts)
    ? ((message as any).parts as any[])
    : [];
  const textParts = parts.filter((p) => p?.type === "text");
  if (textParts.length === 0) return null;
  return (
    <Message
      from="assistant"
      className={cn(
        "w-full max-w-3xl",
        hasScrollAnchor && "min-h-scroll-anchor",
      )}
    >
      <MessageContent className="bg-transparent">
        {textParts.map((part, idx) => (
          <Response key={idx} parseIncompleteMarkdown={false}>
            {stripInputTokens(part.text || "")}
          </Response>
        ))}
      </MessageContent>
    </Message>
  );
}
