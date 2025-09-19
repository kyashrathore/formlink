"use client"

import type { RIPlanResponse } from "@/app/lib/ri/types"
import {
  Conversation as AIConversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
  Response,
  Tool,
  ToolContent,
  ToolHeader,
  ToolLogs,
  ToolOutput,
} from "@formlink/ui/ai-elements"
import { getToolName } from "ai"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "../../lib"
import { useQuestionRenderer } from "./hooks/useQuestionRenderer"
import type { ChatMessage } from "./types"

type ConversationProps = {
  messages: ChatMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  displaySummaryMessage?: string
  renderPlanPreview?: (plan: RIPlanResponse) => ReactNode
}

export function Conversation({
  messages,
  status = "ready",
  displaySummaryMessage = "",
  renderPlanPreview,
}: ConversationProps) {
  // Filter out hidden messages
  const visibleMessages = messages.filter((msg) => {
    const msgWithHidden = msg as ChatMessage & { hidden?: boolean }
    return !msgWithHidden.hidden
  })

  return (
    <AIConversation className="relative flex h-full w-full overflow-x-hidden overflow-y-auto">
      <ConversationContent className="flex w-full flex-col">
        {visibleMessages?.map((message, index) => {
          const isLast =
            index === visibleMessages.length - 1 && status !== "submitted"
          const messageId = `msg-${message.timestamp || index}`

          // Get components for question rendering
          const { components } = useQuestionRenderer(
            messageId,
            isLast,
            message.role as "user" | "assistant"
          )

          return (
            <Message key={`${message.role}-${index}`} from={message.role}>
              <MessageContent
                className={cn(message.role === "user" ? "" : "px-0")}
              >
                {message.role === "user"
                  ? // User messages - extract text from parts
                    (() => {
                      const textPart = message.parts?.find(
                        (p: any) =>
                          p && typeof p === "object" && p.type === "text"
                      ) as any
                      const userText = textPart?.text || message.content || ""
                      return <Response>{userText}</Response>
                    })()
                  : // Assistant messages - render parts
                    message.parts?.map((part: any, partIndex: number) => {
                      if (!part || typeof part !== "object") return null

                      // Skip reasoning and step-start parts
                      if (
                        part.type === "reasoning" ||
                        part.type === "step-start"
                      ) {
                        return null
                      }

                      // Handle text parts
                      if (part.type === "text" && part.text) {
                        return (
                          <Response
                            parseIncompleteMarkdown={false}
                            key={`part-${partIndex}`}
                            components={components}
                            defaultOrigin="https://formlink.ai"
                            allowedLinkPrefixes={["*"]}
                          >
                            {part.text}
                          </Response>
                        )
                      }

                      if (part.type === "ri-plan" && part.plan) {
                        if (renderPlanPreview) {
                          return (
                            <div key={`part-${partIndex}`} className="my-3">
                              {renderPlanPreview(part.plan as RIPlanResponse)}
                            </div>
                          )
                        }
                        return (
                          <Tool
                            key={`tool-${partIndex}`}
                            state="output-available"
                          >
                            <ToolHeader
                              type="response-plan"
                              state="output-available"
                            />
                            <ToolContent>
                              <ToolOutput output={part.plan} />
                            </ToolContent>
                          </Tool>
                        )
                      }

                      // Handle tool parts
                      const isDynamic = part.type === "dynamic-tool"
                      const isTool =
                        typeof part.type === "string" &&
                        part.type.startsWith("tool-")
                      const isInvocation = part.type === "tool-invocation"
                      const isSavedToolCall = part.type === "tool-call"

                      if (
                        isDynamic ||
                        isTool ||
                        isInvocation ||
                        isSavedToolCall
                      ) {
                        const toolName = isInvocation
                          ? (part.toolInvocation?.toolName ?? "tool")
                          : isDynamic
                            ? part.toolName
                            : part.type === "tool-call" && part.toolName
                              ? part.toolName
                              : getToolName(part)

                        const rawState =
                          part.state ??
                          (isInvocation
                            ? part.toolInvocation?.state
                            : undefined) ??
                          (part.type === "tool-call" ? "result" : undefined)

                        const state =
                          rawState === "result"
                            ? "output-available"
                            : rawState === "error"
                              ? "output-error"
                              : rawState

                        // Hide active states for non-last messages
                        if (
                          !isLast &&
                          (state === "input-streaming" ||
                            state === "input-available")
                        ) {
                          return null
                        }

                        const result = isInvocation
                          ? part.toolInvocation?.result
                          : part.output

                        const errorText = isInvocation
                          ? part.toolInvocation?.errorText
                          : part.errorText

                        return (
                          <div key={`tool-${partIndex}`} className="my-2">
                            <Tool state={state}>
                              <ToolHeader type={toolName} state={state} />
                              <ToolContent>
                                {(state === "input-streaming" ||
                                  state === "input-available") &&
                                  displaySummaryMessage && (
                                    <ToolLogs logs={displaySummaryMessage} />
                                  )}

                                {state !== "input-streaming" &&
                                  state !== "input-available" &&
                                  (result || errorText ? (
                                    <ToolOutput
                                      output={result}
                                      errorText={errorText}
                                    />
                                  ) : displaySummaryMessage ? (
                                    <ToolLogs logs={displaySummaryMessage} />
                                  ) : (
                                    <div className="text-muted-foreground p-4 text-xs">
                                      ✓ Completed {toolName}
                                    </div>
                                  ))}
                              </ToolContent>
                            </Tool>
                          </div>
                        )
                      }

                      return null
                    })}
              </MessageContent>
            </Message>
          )
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
