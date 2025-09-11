import { MODEL_DEFAULT } from "@/app/lib/config"
import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import { useChat } from "@ai-sdk/react"
import { Button, PromptSuggestion } from "@formlink/ui"
import { DefaultChatTransport } from "ai"
import { AlertTriangle } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useChatHistoryQuery } from "../../hooks/useChatHistoryQuery"
import { AgentEvent } from "../../lib/types/agent-events"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"
import Chat from "./chat-components/chat"
import { Conversation } from "./conversation"
import { useAutoScroll, useFormattedEvents } from "./hooks"
import { normalizePersistedParts } from "./parts"
import { computeChatStatus } from "./status"
import type { ChatMessage, ChatPanelProps } from "./types"
import { getDisplaySummaryMessage, getLastUserMessage } from "./utils"

const ChatPanel: React.FC<ChatPanelProps> = ({
  formId,
  userId,
  initialMessage,
}) => {
  // Group all store hooks together at the start to maintain consistent order
  const { agentState, eventsLog, processEvent, setInitialPrompt } =
    useFormGenerationStore((state) => ({
      agentState: state.agentState,
      eventsLog: state.eventsLog,
      processEvent: state.processEvent,
      setInitialPrompt: state.setInitialPrompt,
      errorDetails: state.errorDetails,
    }))

  const editorForm = useFormEditorStore((s) => s.form)
  const generationForm = useFormGenerationStore((s) => s.currentForm)

  // All refs together
  const eventHandlerRef = useRef<FormGenerationEventHandler | null>(null)
  const chatHistoryLoadedRef = useRef(false)

  // All state hooks together
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)
  const [storedInitialMessage, setStoredInitialMessage] = useState<
    string | undefined
  >(() => initialMessage)

  // All queries and hooks together
  const chatHistoryQuery = useChatHistoryQuery(formId, Boolean(formId))

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

  // Derived state and constants - after all hooks
  const memoizedProcessEvent = useCallback(processEvent, [processEvent])
  const formReady = Boolean(editorForm?.id) || Boolean(generationForm?.id)
  const historyLoading =
    chatHistoryQuery.isFetching && !chatHistoryLoadedRef.current

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

  useEffect(() => {
    if (
      chatHistoryQuery.isSuccess &&
      chatHistoryQuery.data &&
      !chatHistoryLoadedRef.current
    ) {
      const historyMessages = chatHistoryQuery.data

      if (Array.isArray(historyMessages)) {
        const formattedMessages = historyMessages
          .filter((msg) => ["user", "assistant", "system"].includes(msg.role))
          .map((msg) => {
            const id = msg.id?.toString() ?? uuidv4()
            const fallbackText =
              typeof msg.content === "string" ? msg.content : ""
            const parts = normalizePersistedParts(
              Array.isArray(msg.parts) ? msg.parts : [],
              fallbackText
            )
            return { id, role: msg.role, parts }
          })
        setMessages(formattedMessages as any)
        chatHistoryLoadedRef.current = true
      }
    }
  }, [chatHistoryQuery.isSuccess, chatHistoryQuery.data, setMessages])

  useEffect(() => {
    let isMounted = true

    if (
      storedInitialMessage &&
      vercelChatMessages.length === 0 &&
      !hasUserInteracted &&
      !historyLoading
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
    historyLoading,
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

  const displaySummaryMessage =
    formattedEventsForLogView && formattedEventsForLogView.length > 0
      ? getDisplaySummaryMessage(formattedEventsForLogView, null)
      : ""

  const suggestionsVisible =
    !historyLoading &&
    !formReady &&
    !storedInitialMessage &&
    !hasUserInteracted &&
    chatMessages.length === 0

  const lastAssistantMessage = chatMessages.find(
    (m) => m.role === "assistant" && Array.isArray(m.parts)
  )
  const lastAssistantParts = lastAssistantMessage?.parts
  const uiStatus = computeChatStatus({
    chatStatus,
    lastAssistantParts,
    agentFailed: agentState?.status === "FAILED",
  })

  return (
    <div className="flex h-full flex-col">
      <div ref={chatContainerRef} className="min-h-0 flex-1 overflow-hidden">
        {chatMessages.length > 0 ? (
          <Conversation
            messages={chatMessages}
            status={
              uiStatus === "streaming"
                ? "streaming"
                : uiStatus === "preparing"
                  ? "submitted"
                  : uiStatus === "error"
                    ? "error"
                    : "ready"
            }
            displaySummaryMessage={displaySummaryMessage}
          />
        ) : suggestionsVisible ? (
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
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  highlight=""
                >
                  {prompt}
                </PromptSuggestion>
              ))}
            </div>
          </div>
        ) : null}
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
            isLoading={
              uiStatus === "streaming" ||
              uiStatus === "preparing" ||
              uiStatus === "tool-running"
            }
            showSuggestions={false}
            onInputChange={handleInputChange}
          />
        </div>
      )}
    </div>
  )
}

export default ChatPanel
