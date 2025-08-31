import { cn } from "@/app/lib"
import { Message, MessageContent } from "@formlink/ui"
import type {
  DynamicToolUIPart,
  StepStartUIPart,
  TextUIPart,
  ToolUIPart,
} from "ai"
import { getToolName } from "ai"
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import React from "react"
import { formatChatMessageTime } from "./utils"

type MessagePart = TextUIPart | ToolUIPart | DynamicToolUIPart | StepStartUIPart

interface MessageWithPartsProps {
  role: "user" | "assistant"
  content: string
  timestamp: string
  parts?: MessagePart[]
  isLastMessage?: boolean
  displaySummaryMessage?: string
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

          case "step-start":
            return isLastMessage ? (
              <div key={index} className="bg-border my-2 h-px w-full" />
            ) : null

          default: {
            // Handle tool parts in v5 and persisted shapes:
            // - 'tool-<name>' (ToolUIPart)
            // - 'dynamic-tool' (DynamicToolUIPart)
            // - 'tool-invocation' (persisted invocation shape)
            const isDynamic = (part as any).type === "dynamic-tool"
            const isTool =
              typeof (part as any).type === "string" &&
              (part as any).type.startsWith("tool-")
            const isInvocation = (part as any).type === "tool-invocation"
            const isSavedToolCall = (part as any).type === "tool-call"

            if (!isDynamic && !isTool && !isInvocation && !isSavedToolCall)
              return null

            const toolPart = part as ToolUIPart | DynamicToolUIPart
            const partType = (part as any).type as string
            const toolName = isInvocation
              ? ((part as any).toolInvocation?.toolName ?? "tool")
              : isDynamic
                ? (toolPart as DynamicToolUIPart).toolName
                : partType === "tool-call" && (toolPart as any).toolName
                  ? ((toolPart as any).toolName as string)
                  : (getToolName(toolPart as ToolUIPart) as string)

            // Normalize state across live and persisted shapes
            const rawState =
              (toolPart as any).state ??
              (isInvocation
                ? (part as any).toolInvocation?.state
                : undefined) ??
              (partType === "tool-call" ? "result" : undefined)

            const state =
              rawState === "result"
                ? "output-available"
                : rawState === "error"
                  ? "output-error"
                  : (rawState as
                      | "input-streaming"
                      | "input-available"
                      | "output-available"
                      | "output-error")

            // Hide only active/in-progress states for non-last messages
            if (
              !isLastMessage &&
              (state === "input-streaming" || state === "input-available")
            ) {
              return null
            }

            const getStatusDisplay = () => {
              // Inspect output payload if available to decide success/failure
              const isOutputAvailable = state === "output-available"
              const output: any = isOutputAvailable
                ? isInvocation
                  ? (part as any).toolInvocation?.result
                  : (toolPart as any).output
                : undefined
              const hasSuccessFlag =
                output && typeof output === "object" && "success" in output
              const isSuccess = hasSuccessFlag
                ? Boolean((output as any).success)
                : undefined

              switch (state) {
                case "output-available":
                  if (isSuccess === false) {
                    return {
                      icon: AlertTriangle,
                      text:
                        typeof output?.message === "string" && output.message
                          ? `✗ ${toolName} failed: ${output.message}`
                          : `✗ ${toolName} failed`,
                      className:
                        "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
                      spinning: false,
                    }
                  }
                  return {
                    icon: CheckCircle,
                    text: `✓ Completed ${toolName}`,
                    className:
                      "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
                    spinning: false,
                  }
                case "input-streaming":
                  return {
                    icon: Loader2,
                    text: `Preparing ${toolName}...`,
                    className: "bg-muted/30 text-foreground border-border",
                    spinning: true,
                  }
                case "input-available":
                  return {
                    icon: Loader2,
                    text: `Running ${toolName}...`,
                    className: "bg-muted/30 text-foreground border-border",
                    spinning: true,
                  }
                case "output-error":
                  return {
                    icon: AlertTriangle,
                    text: `Error in ${toolName}`,
                    className:
                      "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
                    spinning: false,
                  }
                default:
                  return {
                    icon: Loader2,
                    text: `Processing ${toolName}...`,
                    className: "bg-muted/30 text-foreground border-border",
                    spinning: true,
                  }
              }
            }

            const statusDisplay = getStatusDisplay()
            const IconComponent = statusDisplay.icon

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
                    className={cn(
                      "h-4 w-4",
                      statusDisplay.spinning && "animate-spin"
                    )}
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
          }
        }
      })}

      <div className="mt-1 text-xs opacity-70">
        {formatChatMessageTime(timestamp)}
      </div>
    </div>
  )
}
