import { cn } from "@/app/lib"
import { Message, MessageContent } from "@formlink/ui"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
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
    state: "partial-call" | "call" | "result" | "error"
    toolCallId: string
    toolName: string
    args?: any
    result?: any
    error?: any
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
            const { state, toolName } = part.toolInvocation

            // Show loading for active calls, success/error for completed
            if (!isLastMessage && state !== "result" && state !== "error") {
              return null // Only hide non-final states for historical messages
            }

            const getStatusDisplay = () => {
              switch (state) {
                case "result":
                  return {
                    icon: CheckCircle,
                    text: `✓ Completed ${toolName}`,
                    className: "bg-green-50 text-green-700 border-green-200",
                  }
                case "error":
                  return {
                    icon: XCircle,
                    text: `✗ Failed ${toolName}`,
                    className: "bg-red-50 text-red-700 border-red-200",
                  }
                case "partial-call":
                  return {
                    icon: Loader2,
                    text: `Preparing ${toolName}...`,
                    className: "bg-muted/50 text-muted-foreground",
                  }
                default: // "call"
                  return {
                    icon: Loader2,
                    text: `Running ${toolName}...`,
                    className: "bg-muted/50 text-muted-foreground",
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
                  "mb-2 flex items-center gap-2 rounded-lg border px-3 py-2",
                  statusDisplay.className
                )}
              >
                <IconComponent
                  className={cn("h-4 w-4", isSpinning && "animate-spin")}
                />
                <span className="text-sm">{statusDisplay.text}</span>
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
