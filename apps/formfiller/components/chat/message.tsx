"use client";

import { Message as MessageType } from "@ai-sdk/react";
import React from "react";
import { MessageAssistant } from "./message-assistant";
import { MessageUser } from "./message-user";

type MessageProps = {
  id: string;
  variant: MessageType["role"];
  message: MessageType;
  isLast?: boolean;
  hasScrollAnchor?: boolean;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
};

export function Message({
  id,
  variant,
  message,
  isLast,
  hasScrollAnchor,
  handleFileUpload,
}: MessageProps) {
  if (variant === "user") {
    return (
      <MessageUser
        id={id}
        message={message}
        hasScrollAnchor={hasScrollAnchor}
      />
    );
  }

  if (variant === "assistant") {
    return (
      <MessageAssistant
        message={message}
        isLast={isLast}
        hasScrollAnchor={hasScrollAnchor}
        handleFileUpload={handleFileUpload}
      />
    );
  }

  return null;
}
