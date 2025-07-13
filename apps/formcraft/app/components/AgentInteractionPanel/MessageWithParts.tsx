import { cn } from "@/app/lib"
import { Message, MessageContent } from "@formlink/ui"
import { Loader2 } from "lucide-react"
import React from "react"
import { formatChatMessageTime } from "./utils"

// Types based on AI SDK 4.3.16
interface TextPart {
  type: "text"
  text: string
}

interface ToolInvocationPart {
  type: "tool-invocation"
  toolInvocation: {
    state: "partial-call" | "call" | "result"
    toolCallId: string
    toolName: string
    args?: any
    result?: any
  }
}

interface StepStartPart {
  type: "step-start"
}

type MessagePart = TextPart | ToolInvocationPart | StepStartPart

interface MessageWithPartsProps {
  role: "user" | "assistant"
  content: string
  timestamp: string
  parts?: MessagePart[]
  isLastMessage?: boolean
}

export const MessageWithParts: React.FC<MessageWithPartsProps> = ({
  role,
  content,
  timestamp,
  parts,
  isLastMessage = false,
}) => {
  // If no parts, render traditional message
  if (!parts || parts.length === 0) {
    return (
      <Message
        className={cn(
          "flex flex-col pb-2",
          role === "user" ? "items-end" : "items-start"
        )}
      >
        <MessageContent
          markdown={role === "assistant"}
          className={
            role === "assistant"
              ? "prose dark:prose-invert prose-sm max-w-none"
              : ""
          }
        >
          {content}
        </MessageContent>
        <div className="mt-1 text-xs opacity-70">
          {formatChatMessageTime(timestamp)}
        </div>
      </Message>
    )
  }

  // Render message with parts
  return (
    <div
      className={cn(
        "flex flex-col pb-2",
        role === "user" ? "items-end" : "items-start"
      )}
    >
      {parts.map((part, index) => {
        switch (part.type) {
          case "text":
            return part.text ? (
              <Message
                key={index}
                className={cn(
                  "mb-2 flex flex-col",
                  role === "user" ? "items-end" : "items-start"
                )}
              >
                <MessageContent
                  markdown={role === "assistant"}
                  className={
                    role === "assistant"
                      ? "prose dark:prose-invert prose-sm max-w-none"
                      : ""
                  }
                >
                  {part.text}
                </MessageContent>
              </Message>
            ) : null

          case "tool-invocation":
            // Only show loading indicator for the last message and active tool calls
            if (!isLastMessage || part.toolInvocation.state === "result") {
              return null
            }

            return (
              <div
                key={index}
                className="bg-muted/50 mb-2 flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <Loader2 className="text-primary h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">
                  {part.toolInvocation.state === "partial-call"
                    ? `Preparing ${part.toolInvocation.toolName}...`
                    : `Running ${part.toolInvocation.toolName}...`}
                </span>
              </div>
            )

          case "step-start":
            // Optional: Add visual separator for multi-step processes
            return isLastMessage ? (
              <div key={index} className="bg-border my-2 h-px w-full" />
            ) : null

          default:
            return null
        }
      })}

      {/* Show timestamp for the last part */}
      <div className="mt-1 text-xs opacity-70">
        {formatChatMessageTime(timestamp)}
      </div>
    </div>
  )
}
