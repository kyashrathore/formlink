import { useChat, type Message as VercelChatMessage } from "@ai-sdk/react"
import { Button, PromptSuggestion } from "@formlink/ui"
import { AlertTriangle } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useMobile } from "../../hooks/use-mobile"
import { MODEL_DEFAULT } from "../../lib/config"
import {
  ErrorEvent as AgentErrorEvent,
  AgentEvent,
} from "../../lib/types/agent-events"
import { useFormAgentStore } from "../../stores/formAgentStore"
import Chat from "./chat-components/chat"
import { useAutoScroll, useFormattedEvents } from "./hooks"
import { MessageWithParts } from "./MessageWithParts"
import type { AgentInteractionPanelProps, ChatMessage } from "./types"
import { getDisplaySummaryMessage, getLastUserMessage } from "./utils"

const ChatPanel: React.FC<AgentInteractionPanelProps> = ({
  formId,
  userId,
  showSuggestions,
  initialMessage,
}) => {
  const isMobile = useMobile()
  const pathname = usePathname()
  const isDashboard = pathname === "/dashboard"
  const { agentState, eventsLog, processEvent } = useFormAgentStore()

  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)

  const [storedInitialMessage] = useState<string | undefined>(
    () => initialMessage
  )

  const {
    messages: vercelChatMessages,
    append,
    status: chatStatus,
    data: chatData,
    setMessages,
  } = useChat({
    id: formId,
    api: "/api/chat",
    body: { formId, userId: userId || "anonymous", selectedModel },
    onError: (error) => {
      const lastEvent =
        eventsLog.length > 0 ? eventsLog[eventsLog.length - 1] : null
      const errorEvent: AgentErrorEvent = {
        id: uuidv4(),
        category: "error",
        type: "agent_error",
        timestamp: new Date().toISOString(),
        formId: formId,
        userId: userId || "anonymous",
        sequence: lastEvent ? lastEvent.sequence + 1 : 0,
        data: {
          message: "Chat Connection Error: " + error.message,
          details: error,
          recoverable: false,
        },
      }
      processEvent(errorEvent)
    },
  })

  useEffect(() => {
    async function fetchChatHistoryAndSet() {
      if (!formId) {
        setMessages([])
        return
      }
      try {
        const response = await fetch(`/api/chat?formId=${formId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setMessages([])
            return
          }
          throw new Error(
            `Failed to fetch chat history: ${response.statusText}`
          )
        }
        const historyMessages = await response.json()

        if (Array.isArray(historyMessages)) {
          const validRoles = ["user", "assistant", "system"]
          const formattedMessages: VercelChatMessage[] = historyMessages
            .filter((msg: any) => validRoles.includes(msg.role))
            .map((msg: any) => ({
              id: msg.id?.toString() || uuidv4(),
              role: msg.role as "user" | "assistant" | "system",
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content || ""),
              createdAt: msg.created_at ? new Date(msg.created_at) : new Date(),
            }))
          setMessages(formattedMessages)
        } else {
          setMessages([])
        }
      } catch (error) {
        setMessages([])
      }
    }
    fetchChatHistoryAndSet()
  }, [formId, userId, setMessages])

  useEffect(() => {
    let isMounted = true

    if (
      storedInitialMessage &&
      vercelChatMessages.length === 0 &&
      !hasUserInteracted
    ) {
      const timer = setTimeout(() => {
        if (isMounted) {
          append({
            role: "user",
            content: storedInitialMessage,
          })
          setHasUserInteracted(true)
        }
      }, 200)

      return () => {
        isMounted = false
        clearTimeout(timer)
      }
    }
  }, [
    storedInitialMessage,
    vercelChatMessages.length,
    hasUserInteracted,
    append,
    formId,
  ])

  const { formattedEventsForLogView } = useFormattedEvents(eventsLog)
  const lastProcessedEventIndexRef = useRef(0)

  const chatMessages: ChatMessage[] = useMemo(() => {
    return vercelChatMessages.map(
      (msg: any): ChatMessage => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
        ...(msg.parts ? { parts: msg.parts } : {}),
        ...(msg.toolInvocations
          ? { toolInvocations: msg.toolInvocations }
          : {}),
      })
    )
  }, [vercelChatMessages])
  const isStreaming = chatStatus === "streaming"

  // Auto-scroll to latest messages
  const chatContainerRef = useAutoScroll([chatMessages, isStreaming], true)

  useEffect(() => {
    if (chatData && chatData.length > lastProcessedEventIndexRef.current) {
      const newEvents = chatData.slice(lastProcessedEventIndexRef.current)
      newEvents.forEach((dataItem: any) => {
        if (
          dataItem &&
          typeof dataItem === "object" &&
          "category" in dataItem &&
          "type" in dataItem
        ) {
          processEvent(dataItem as AgentEvent)
        } else if (
          dataItem &&
          dataItem.type === "custom_agent_event" &&
          dataItem.payload
        ) {
          processEvent(dataItem.payload as AgentEvent)
        }
      })
      lastProcessedEventIndexRef.current = chatData.length
    }
  }, [chatData, processEvent])

  const handleSendMessageForChatComponent = useCallback(
    async (message: string, model: string) => {
      setSelectedModel(model)
      await append({ role: "user", content: message })
    },
    [append]
  )

  const handleRetryClick = useCallback(() => {
    const lastUserMsg = getLastUserMessage(chatMessages)
    const messageToRetry = lastUserMsg?.content || agentState?.originalInput
    if (messageToRetry) {
      handleSendMessageForChatComponent(messageToRetry, selectedModel)
    }
  }, [
    chatMessages,
    agentState?.originalInput,
    selectedModel,
    handleSendMessageForChatComponent,
  ])

  const handleInputChange = useCallback((value: string) => {
    setHasUserInteracted(true)
  }, [])

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleSendMessageForChatComponent(suggestion, selectedModel)
    },
    [handleSendMessageForChatComponent, selectedModel]
  )

  // Initial suggestions for form creation
  const initialFormPrompts = [
    "Quick contact form (Name, Email)?",
    "Survey: 'Coffee vs Tea' poll ☕🍵",
    "Fun quiz: 3 quick questions!",
    "Event sign-up form (easy RSVP)",
    "Need a job form? (CV upload ready)",
  ]

  const displaySummaryMessage = getDisplaySummaryMessage(
    formattedEventsForLogView,
    agentState
  )

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages area */}
      <div
        ref={chatContainerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
      >
        {chatMessages.map((message, index) => (
          <MessageWithParts
            key={index}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            parts={(message as any).parts}
            isLastMessage={index === chatMessages.length - 1}
            displaySummaryMessage={displaySummaryMessage}
            isStreaming={isStreaming}
          />
        ))}

        {chatMessages.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-muted-foreground mb-6">
              <div className="mb-2 text-lg font-medium">
                Start a conversation
              </div>
              <div className="text-sm">
                Choose a suggestion below or ask me anything about forms
              </div>
            </div>

            {/* Suggestions */}
            <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
              {initialFormPrompts.map((prompt, index) => (
                <PromptSuggestion
                  key={index}
                  onClick={() => handleSuggestionClick(prompt)}
                >
                  {prompt}
                </PromptSuggestion>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Failed state */}
      {agentState?.status === "FAILED" && !isStreaming && (
        <div className="border-border flex-shrink-0 border-t p-4">
          <div className="border-destructive/20 bg-destructive/10 flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center">
              <AlertTriangle className="text-destructive mr-2 h-4 w-4" />
              <span className="text-sm">Form generation failed.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryClick}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Chat input - always at bottom */}
      {agentState?.status !== "FAILED" && (
        <div className="border-border bg-background flex-shrink-0 border-t p-4">
          <Chat
            onSubmit={handleSendMessageForChatComponent}
            isLoading={isStreaming}
            showSuggestions={false}
            onInputChange={handleInputChange}
          />
        </div>
      )}
    </div>
  )
}

export default ChatPanel
