import { cn } from "@/app/lib"
import { Message, MessageContent } from "@formlink/ui"
import { Loader2 } from "lucide-react"
import React from "react"
import { formatChatMessageTime } from "./utils"

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
  displaySummaryMessage?: string
  isStreaming?: boolean
}

export const MessageWithParts: React.FC<MessageWithPartsProps> = ({
  role,
  content,
  timestamp,
  parts,
  isLastMessage = false,
  displaySummaryMessage = "",
  isStreaming = false,
}) => {
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
            if (!isLastMessage || part.toolInvocation.state === "result") {
              return null
            }

            const toolName = part.toolInvocation.toolName
            const toolStatus =
              part.toolInvocation.state === "partial-call"
                ? `Preparing ${toolName}...`
                : `Running ${toolName}...`

            return (
              <div
                key={index}
                className="bg-muted/30 border-border mb-2 rounded-lg border p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Loader2 className="text-primary h-4 w-4 animate-spin" />
                  <span className="text-foreground text-sm font-medium">
                    🔧 {toolStatus}
                  </span>
                </div>
                {displaySummaryMessage && (
                  <div className="text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono text-xs">
                    {displaySummaryMessage}
                  </div>
                )}
              </div>
            )

          case "step-start":
            return isLastMessage ? (
              <div key={index} className="bg-border my-2 h-px w-full" />
            ) : null

          default:
            return null
        }
      })}

      <div className="mt-1 text-xs opacity-70">
        {formatChatMessageTime(timestamp)}
      </div>
    </div>
  )
}
