import { useFormGenerationEventBridge } from "@/app/hooks/useFormGenerationEventBridge"
import { MODEL_DEFAULT } from "@/app/lib/config"
import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import { useChat } from "@ai-sdk/react"
import { Button, PromptSuggestion } from "@formlink/ui"
import { DefaultChatTransport } from "ai"
import { AlertTriangle } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { AgentEvent } from "../../lib/types/agent-events"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"
import Chat from "./chat-components/chat"
import { useAutoScroll, useFormattedEvents } from "./hooks"
import { MessageWithParts } from "./MessageWithParts"
import type { ChatMessage, ChatPanelProps } from "./types"
import { getDisplaySummaryMessage, getLastUserMessage } from "./utils"

const ChatPanel: React.FC<ChatPanelProps> = ({
  formId,
  userId,
  initialMessage,
}) => {
  const { agentState, eventsLog, processEvent, setInitialPrompt } =
    useFormGenerationStore((state) => ({
      agentState: state.agentState,
      eventsLog: state.eventsLog,
      processEvent: state.processEvent,
      setInitialPrompt: state.setInitialPrompt,
      errorDetails: state.errorDetails,
    }))

  // Memoize event handlers to prevent re-renders
  const memoizedProcessEvent = useCallback(processEvent, [processEvent])
  const { bridgeEvent } = useFormGenerationEventBridge(useFormGenerationStore)
  const memoizedBridgeEvent = useCallback(bridgeEvent, [bridgeEvent])

  // Always use new architecture - handler is initialized lazily when needed
  const eventHandlerRef = useRef<FormGenerationEventHandler | null>(null)

  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)

  const [storedInitialMessage, setStoredInitialMessage] = useState<
    string | undefined
  >(() => initialMessage)

  const initialFormPrompts = [
    "Quick contact form (Name, Email)?",
    "Survey: 'Coffee vs Tea' poll",
    "Fun quiz: 3 quick questions!",
    "Event sign-up form (easy RSVP)",
    "Need a job form? (CV upload ready)",
  ]

  useEffect(() => {
    if (initialMessage && initialMessage !== storedInitialMessage) {
      setStoredInitialMessage(initialMessage)
    }
  }, [initialMessage, storedInitialMessage])

  const {
    messages: vercelChatMessages,
    sendMessage,
    status: chatStatus,
    setMessages,
  } = useChat({
    id: formId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ formId, userId: userId || "anonymous", selectedModel }),
    }),
    onData: (dataPart) => {
      try {
        if (
          dataPart &&
          typeof dataPart === "object" &&
          "type" in dataPart &&
          (dataPart as any).type === "data-agent_event" &&
          "data" in (dataPart as any)
        ) {
          const event = (dataPart as any).data as AgentEvent

          if (eventHandlerRef.current) {
            eventHandlerRef.current.handleRawEvent(event)
          }
          memoizedProcessEvent(event)
          memoizedBridgeEvent(event)
        }
      } catch (err) {
        console.error("[ChatPanel] onData handler error:", err)
      }
    },
    onError: (error) => {
      console.error("[ChatPanel] AI SDK Error:", error)
      processEvent({
        id: `error-${Date.now()}`,
        type: "agent_error",
        category: "error",
        data: {
          message: `Chat error: ${error.message}`,
          details: error,
          recoverable: true,
        },
        formId,
        userId: userId || "anonymous",
        sequence: Date.now(),
        timestamp: new Date().toISOString(),
      })
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
          const formattedMessages = historyMessages
            .filter((msg) => validRoles.includes(msg.role))
            .map((msg) => {
              const parts =
                Array.isArray(msg.parts) && msg.parts.length > 0
                  ? msg.parts
                  : typeof msg.content === "string" && msg.content.length > 0
                    ? [{ type: "text", text: msg.content }]
                    : []
              return {
                id: msg.id?.toString() || uuidv4(),
                role: msg.role as "user" | "assistant" | "system",
                parts,
              }
            })
          setMessages(formattedMessages as any)
        } else {
          setMessages([])
        }
      } catch (_error) {
        console.error("Failed to fetch chat history", _error)
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
          sendMessage(
            { parts: [{ type: "text", text: storedInitialMessage }] },
            { body: { formId, userId: userId || "anonymous", selectedModel } }
          )
          setHasUserInteracted(true)

          if (window.location.pathname.includes("/dashboard/forms/")) {
            setInitialPrompt(null)
          }
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
    sendMessage,
    formId,
    setInitialPrompt,
  ])

  const { formattedEventsForLogView } = useFormattedEvents(eventsLog)

  const messageTimestampRef = useRef<Map<string, string>>(new Map())

  const chatMessages: ChatMessage[] = useMemo(() => {
    return vercelChatMessages.map(
      (msg): ChatMessage => ({
        role: msg.role as "user" | "assistant",
        content: (Array.isArray((msg as any).parts) ? (msg as any).parts : [])
          .filter((p: any) => p?.type === "text" && typeof p.text === "string")
          .map((p: any) => p.text)
          .join(""),
        timestamp: (() => {
          const existing = messageTimestampRef.current.get((msg as any).id)
          if (existing) return existing
          const t = new Date().toISOString()
          messageTimestampRef.current.set((msg as any).id, t)
          return t
        })(),
        // In v5, messages have parts automatically populated by the SDK
        ...(msg.parts ? { parts: msg.parts } : {}),
      })
    )
  }, [vercelChatMessages])
  const isStreaming = chatStatus === "streaming"

  const chatContainerRef = useAutoScroll([chatMessages, isStreaming], true)

  const handleSendMessageForChatComponent = useCallback(
    async (message: string, model: string) => {
      setSelectedModel(model)
      await sendMessage(
        { parts: [{ type: "text", text: message }] },
        {
          body: { formId, userId: userId || "anonymous", selectedModel: model },
        }
      )
    },
    [sendMessage, formId, userId]
  )

  const handleRetryClick = useCallback(() => {
    const lastUserMsg = getLastUserMessage(chatMessages)
    const messageToRetry = lastUserMsg?.content || storedInitialMessage || ""
    if (messageToRetry) {
      handleSendMessageForChatComponent(messageToRetry, selectedModel)
    }
  }, [
    chatMessages,
    selectedModel,
    handleSendMessageForChatComponent,
    storedInitialMessage,
  ])

  const handleInputChange = useCallback(() => {
    setHasUserInteracted(true)
  }, [])

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleSendMessageForChatComponent(suggestion, selectedModel)
    },
    [handleSendMessageForChatComponent, selectedModel]
  )

  const displaySummaryMessage = getDisplaySummaryMessage(
    formattedEventsForLogView,
    null // agentState not available in new store
  )

  return (
    <div className="flex h-full flex-col">
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
            parts={"parts" in message ? (message as any).parts : undefined}
            isLastMessage={index === chatMessages.length - 1}
            displaySummaryMessage={displaySummaryMessage}
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
