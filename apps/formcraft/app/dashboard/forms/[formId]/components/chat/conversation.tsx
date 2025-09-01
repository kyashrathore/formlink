"use client"

import { cn } from "@/app/lib"
import {
  Conversation as AIConversation,
  Message as AIMessage,
  ConversationContent,
  ConversationScrollButton,
  MessageContent,
  Tool,
  ToolContent,
  ToolHeader,
  ToolLogs,
  ToolOutput,
} from "@formlink/ui/ai-elements"
import type { DynamicToolUIPart, ToolUIPart } from "ai"
import { getToolName } from "ai"
import { Loader2 } from "lucide-react"
import type { ChatMessage } from "./types"
import { formatChatMessageTime } from "./utils"

type ConversationProps = {
  messages: ChatMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  displaySummaryMessage?: string
}

export function Conversation({
  messages,
  status = "ready",
  displaySummaryMessage = "",
}: ConversationProps) {
  // Filter out hidden messages (preserve existing logic)
  const visibleMessages = messages.filter((msg) => {
    const msgWithHidden = msg as ChatMessage & { hidden?: boolean }
    return !msgWithHidden.hidden
  })

  return (
    <AIConversation className="relative flex h-[calc(75vh)] w-full overflow-x-hidden overflow-y-auto">
      <ConversationContent className="flex w-full flex-col items-center">
        {visibleMessages?.map((message, index) => {
          const isLast =
            index === visibleMessages.length - 1 && status !== "submitted"

          if (message.role === "user") {
            // Extract text from AI SDK v5 format: message.parts
            const textPart = message.parts?.find(
              (p: any) => p && typeof p === "object" && p.type === "text"
            ) as any
            const userText = textPart?.text || message.content || ""

            return (
              <AIMessage
                key={`user-${index}`}
                from="user"
                className="w-full max-w-3xl"
              >
                <MessageContent>{userText}</MessageContent>
              </AIMessage>
            )
          }

          if (message.role === "assistant") {
            // For assistant messages, we need to handle both text and tool parts
            // Keep the existing tool visualization logic but wrap in AI Elements
            return (
              <div
                key={`assistant-${index}`}
                className={cn(
                  "flex w-full max-w-3xl flex-col items-start pb-2"
                )}
              >
                {message.parts && message.parts.length > 0
                  ? // Render parts (text and tools) - safely handle unknown[] type
                    message.parts
                      .filter(
                        (p): p is any => p != null && typeof p === "object"
                      )
                      .map((part, partIndex) => {
                        switch (part.type) {
                          case "text":
                            return part.text ? (
                              <AIMessage
                                key={`text-${partIndex}`}
                                from="assistant"
                                className="mb-2 flex w-full max-w-3xl flex-col"
                              >
                                <MessageContent className="prose dark:prose-invert prose-sm max-w-none">
                                  {part.text}
                                </MessageContent>
                              </AIMessage>
                            ) : null

                          case "step-start":
                            return isLast ? (
                              <div
                                key={partIndex}
                                className="bg-border my-2 h-px w-full"
                              />
                            ) : null

                          default: {
                            // Handle tool parts using AI Elements Tool component
                            const isDynamic =
                              (part as any).type === "dynamic-tool"
                            const isTool =
                              typeof (part as any).type === "string" &&
                              (part as any).type.startsWith("tool-")
                            const isInvocation =
                              (part as any).type === "tool-invocation"
                            const isSavedToolCall =
                              (part as any).type === "tool-call"

                            if (
                              !isDynamic &&
                              !isTool &&
                              !isInvocation &&
                              !isSavedToolCall
                            )
                              return null

                            const toolPart = part as
                              | ToolUIPart
                              | DynamicToolUIPart
                            const partType = (part as any).type as string
                            const toolName = isInvocation
                              ? ((part as any).toolInvocation?.toolName ??
                                "tool")
                              : isDynamic
                                ? (toolPart as DynamicToolUIPart).toolName
                                : partType === "tool-call" &&
                                    (toolPart as any).toolName
                                  ? ((toolPart as any).toolName as string)
                                  : (getToolName(
                                      toolPart as ToolUIPart
                                    ) as string)

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
                              !isLast &&
                              (state === "input-streaming" ||
                                state === "input-available")
                            ) {
                              return null
                            }

                            const result = isInvocation
                              ? (part as any).toolInvocation?.result
                              : (toolPart as any).output

                            const errorText = (toolPart as any).errorText

                            return (
                              <Tool key={partIndex} state={state}>
                                <ToolHeader type={toolName} state={state} />
                                <ToolContent>
                                  {(state === "input-streaming" ||
                                    state === "input-available") &&
                                    displaySummaryMessage && (
                                      <ToolLogs logs={displaySummaryMessage} />
                                    )}

                                  {/* Show output/results for completed states */}
                                  {(result || errorText) &&
                                    state !== "input-streaming" &&
                                    state !== "input-available" && (
                                      <ToolOutput
                                        output={result}
                                        errorText={errorText}
                                      />
                                    )}
                                </ToolContent>
                              </Tool>
                            )
                          }
                        }
                      })
                  : null}

                <div className="mt-1 text-xs opacity-70">
                  {formatChatMessageTime(message.timestamp)}
                </div>
              </div>
            )
          }

          return null
        })}

        {(status === "submitted" || status === "streaming") && (
          <div className="flex items-center justify-center p-4">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground text-sm">
                {status === "streaming" ? "Generating..." : "Processing..."}
              </span>
            </div>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </AIConversation>
  )
}
