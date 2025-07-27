import { cn } from "@/app/lib"
import type {
  StepStartUIPart,
  TextUIPart,
  ToolInvocationUIPart,
} from "@ai-sdk/ui-utils"
import { Message, MessageContent } from "@formlink/ui"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import React from "react"
import { formatChatMessageTime } from "./utils"

type MessagePart = TextUIPart | ToolInvocationUIPart | StepStartUIPart

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
            const { state, toolName } = part.toolInvocation

            if (!isLastMessage && state !== "result") {
              return null
            }

            const getStatusDisplay = () => {
              switch (state) {
                case "result":
                  return {
                    icon: CheckCircle,
                    text: `✓ Completed ${toolName}`,
                    className:
                      "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
                  }
                case "error":
                  return {
                    icon: XCircle,
                    text: `✗ Failed ${toolName}`,
                    className:
                      "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
                  }
                case "partial-call":
                  return {
                    icon: Loader2,
                    text: `Preparing ${toolName}...`,
                    className: "bg-muted/30 text-foreground border-border",
                  }
                default:
                  return {
                    icon: Loader2,
                    text: `Running ${toolName}...`,
                    className: "bg-muted/30 text-foreground border-border",
                  }
              }
            }

            const statusDisplay = getStatusDisplay()
            const IconComponent = statusDisplay.icon
            const isSpinning = state === "partial-call" || state === "call"

            return (
              <div
                key={index}
                className={cn(
                  "mb-2 rounded-lg border p-3",
                  statusDisplay.className
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <IconComponent
                    className={cn("h-4 w-4", isSpinning && "animate-spin")}
                  />
                  <span className="text-sm font-medium">
                    {statusDisplay.text}
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
