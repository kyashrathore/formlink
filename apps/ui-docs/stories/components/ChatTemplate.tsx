"use client";

import React, { ReactNode } from "react";
import {
  Conversation,
  ConversationContent,
  Message,
  MessageAvatar,
  MessageContent,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";

interface ChatTemplateProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ChatTemplate({
  title,
  description,
  children,
}: ChatTemplateProps) {
  return (
    <div className="w-full h-[600px] border rounded-lg grid grid-rows-[1fr_auto] overflow-hidden bg-background">
      <Conversation className="bg-background">
        <ConversationContent className="max-w-3xl mx-auto w-full">
          <Message from="assistant">
            <MessageAvatar src="/assistant.png" name="AI" />
            <MessageContent>
              <div className="prose prose-sm dark:prose-invert">
                <h3 className="m-0">{title}</h3>
                {description && <p className="mt-1">{description}</p>}
              </div>
              <div className="mt-3">{children}</div>
            </MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>
      <div className="border-t bg-card">
        <PromptInput className="max-w-3xl mx-auto w-full flex items-end gap-2 p-3">
          <PromptInputTextarea
            placeholder="Type your message…"
            className="min-h-10"
          />
          <PromptInputSubmit>Send</PromptInputSubmit>
        </PromptInput>
      </div>
    </div>
  );
}

export default ChatTemplate;
