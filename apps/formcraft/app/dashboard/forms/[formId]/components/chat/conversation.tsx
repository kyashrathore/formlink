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
import { getToolName, type UIMessage } from "ai"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "../../lib"
import { useQuestionRenderer } from "./hooks/useQuestionRenderer"

type ConversationProps = {
  messages: UIMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  displaySummaryMessage?: string
  renderPlanPreview?: (plan: RIPlanResponse) => ReactNode
}

const VisibleMessage = ({
  message,
  isLast,
  messageId,
  renderPlanPreview,
  displaySummaryMessage,
}: {
  message: UIMessage
  messageId: string
  isLast: boolean
  renderPlanPreview?: (plan: RIPlanResponse) => ReactNode
  displaySummaryMessage?: string
}) => {
  // Get components for question rendering
  const { components } = useQuestionRenderer(
    messageId,
    isLast,
    message.role as "user" | "assistant"
  )
  return (
    <Message key={messageId} from={message.role as "user" | "assistant"}>
      <MessageContent className={cn(message.role === "user" ? "" : "px-0")}>
        {message.role === "user"
          ? // User messages - extract text from parts
            (() => {
              const textPart = (message.parts as any)?.find(
                (p: any) => p && typeof p === "object" && p.type === "text"
              ) as any
              const userText = textPart?.text || ""
              return <Response>{userText}</Response>
            })()
          : // Assistant messages - render parts
            (message.parts as any)?.map((part: any, partIndex: number) => {
              if (!part || typeof part !== "object") return null

              // Skip reasoning and step-start parts
              if (part.type === "reasoning" || part.type === "step-start") {
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
                  <Tool key={`tool-${partIndex}`} state="output-available">
                    <ToolHeader type="response-plan" state="output-available" />
                    <ToolContent>
                      <ToolOutput output={part.plan} />
                    </ToolContent>
                  </Tool>
                )
              }

              // Handle tool parts
              const isDynamic = part.type === "dynamic-tool"
              const isTool =
                typeof part.type === "string" && part.type.startsWith("tool-")
              const isInvocation = part.type === "tool-invocation"
              const isSavedToolCall = part.type === "tool-call"

              if (isDynamic || isTool || isInvocation || isSavedToolCall) {
                const toolName = isInvocation
                  ? (part.toolInvocation?.toolName ?? "tool")
                  : isDynamic
                    ? part.toolName
                    : part.type === "tool-call" && part.toolName
                      ? part.toolName
                      : getToolName(part)

                const rawState =
                  part.state ??
                  (isInvocation ? part.toolInvocation?.state : undefined) ??
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
                  (state === "input-streaming" || state === "input-available")
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

                        {(() => {
                          const hideOutput = toolName === "responseIntelligence"
                          const finalResult = hideOutput ? undefined : result
                          const finalError = hideOutput ? undefined : errorText
                          if (
                            state === "input-streaming" ||
                            state === "input-available"
                          ) {
                            return null
                          }
                          if (finalResult || finalError) {
                            return (
                              <ToolOutput
                                output={finalResult}
                                errorText={finalError}
                              />
                            )
                          }
                          if (displaySummaryMessage) {
                            return <ToolLogs logs={displaySummaryMessage} />
                          }
                          const doneLabel =
                            toolName === "responseIntelligence"
                              ? "✓ Response Plan generated"
                              : `✓ Completed ${toolName}`
                          return (
                            <div className="text-muted-foreground p-4 text-xs">
                              {doneLabel}
                            </div>
                          )
                        })()}
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
}
export function Conversation({
  messages,
  status = "ready",
  displaySummaryMessage = "",
  renderPlanPreview,
}: ConversationProps) {
  // Filter out hidden messages
  const visibleMessages = messages.filter((msg: any) => !msg.hidden)
  const filtered = visibleMessages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  )

  return (
    <AIConversation className="relative flex h-full w-full overflow-x-hidden overflow-y-auto">
      <ConversationContent className="flex w-full flex-col">
        {filtered?.map((message, index) => {
          const isLast = index === filtered.length - 1 && status !== "submitted"
          const messageId = message.id
          return (
            <VisibleMessage
              key={messageId}
              renderPlanPreview={renderPlanPreview}
              message={message}
              messageId={messageId}
              isLast={isLast}
              displaySummaryMessage={displaySummaryMessage}
            />
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
