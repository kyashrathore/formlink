import { MODEL_DEFAULT } from "@/app/lib/config"
import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import type { RIPlanResponse } from "@/app/lib/ri/types"
import { useChat } from "@ai-sdk/react"
import { Button, PromptSuggestion } from "@formlink/ui"
import { Suggestion, Suggestions } from "@formlink/ui/ai-elements"
import { DefaultChatTransport } from "ai"
import { AlertTriangle } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useChatHistoryQuery } from "../../hooks/useChatHistoryQuery"
import { usePanelState } from "../../hooks/usePanelState"
import { applyRIPlanToUI } from "../../lib/responses/ri-adapter"
import { AgentEvent } from "../../lib/types/agent-events"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"
import { useResponseViewsStore } from "../../stores/useResponseViewsStore"
import Chat from "./chat-components/chat"
import { Conversation } from "./conversation"
import { useAutoScroll, useFormattedEvents } from "./hooks"
import { normalizePersistedParts } from "./parts"
import RIPlanPreview from "./RIPlanPreview"
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
  const { activeMainTab } = usePanelState()
  const addOrUpdateFromPlan = useResponseViewsStore(
    (s) => s.addOrUpdateFromPlan
  )

  // All refs together
  const eventHandlerRef = useRef<FormGenerationEventHandler | null>(null)
  const chatHistoryLoadedRef = useRef(false)

  // All state hooks together
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)
  const [storedInitialMessage, setStoredInitialMessage] = useState<
    string | undefined
  >(() => initialMessage)
  type RISuggestion = { label: string; message: string }
  const [riSuggestions, setRiSuggestions] = useState<RISuggestion[]>([])
  const responseViewsStore = useResponseViewsStore()
  const [riPlanPreview, setRiPlanPreview] = useState<RIPlanResponse | null>(
    null
  )

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
      body: () => ({
        formId,
        userId: userId || "anonymous",
        selectedModel,
        options: {
          intent:
            activeMainTab === "responses" ? "response_intelligence" : "general",
          responseIntelligence: activeMainTab === "responses",
        },
      }),
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
          const raw = (dataPart as any).data as any
          // Intercept Response Intelligence plan events (not part of standard AgentEvent union)
          if (raw?.type === "response_intelligence_plan" && raw?.plan) {
            try {
              applyRIPlanToUI(raw.plan, editorForm || generationForm)
              // Create/activate ephemeral view for this plan
              addOrUpdateFromPlan(raw.plan, editorForm || generationForm)
              const followups = raw?.plan?.plan?.meta?.followups
              if (Array.isArray(followups) && followups.length) {
                const items: RISuggestion[] = followups.map((f: any) => {
                  if (typeof f === "string") {
                    return { label: f, message: f }
                  }
                  const kind = String(f?.kind || "insight").toLowerCase()
                  const title = typeof f?.title === "string" ? f.title : ""
                  const prefix =
                    kind === "column"
                      ? "Column"
                      : kind === "action"
                        ? "Action"
                        : kind === "chart"
                          ? "Chart"
                          : kind === "filter"
                            ? "Filter"
                            : "Insight"
                  const label = title ? `${prefix}: ${title}` : prefix
                  const message =
                    kind === "column"
                      ? `Add column ${title}`
                      : kind === "action"
                        ? `Add action ${title}`
                        : kind === "chart"
                          ? `Add chart ${title}`
                          : kind === "filter"
                            ? `Apply filter ${title}`
                            : `Add insight ${title}`
                  return { label, message }
                })
                setRiSuggestions(items)
              }
              setRiPlanPreview(raw.plan)
              // Optionally switch to Responses tab
              if (activeMainTab !== "responses") {
                // defer switch; avoid importing setter to keep minimal changes
              }
            } catch (e) {
              console.error("Failed to apply RI plan", e)
            }
            return
          }

          const event = raw as AgentEvent

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
          body: {
            formId,
            userId: userId || "anonymous",
            selectedModel: model,
            options: {
              intent:
                activeMainTab === "responses"
                  ? "response_intelligence"
                  : "general",
              responseIntelligence: activeMainTab === "responses",
            },
          },
        }
      )
    },
    [sendMessage, formId, userId, activeMainTab]
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
          {riPlanPreview && (
            <RIPlanPreview
              plan={riPlanPreview}
              saved={(() => {
                const id = responseViewsStore.activeViewId
                const v = responseViewsStore.views.find((x) => x.id === id)
                return v?.saved
              })()}
              onSave={() => {
                try {
                  // mark saved
                  const id = responseViewsStore.activeViewId
                  const v = responseViewsStore.views.find((x) => x.id === id)
                  if (v && !v.saved) {
                    // saveActiveView modifies store in place (import at top-level creates cycles), so inline update
                    v.saved = true
                    useResponseViewsStore.setState({
                      views: [...responseViewsStore.views],
                    })
                  }
                } catch (e) {
                  console.error(e)
                }
              }}
              onOpenResponses={() => {
                // Switch right panel tab to Responses
                try {
                  const { setActiveMainTab } = usePanelState.getState() as any
                  setActiveMainTab && setActiveMainTab("responses")
                } catch {}
              }}
              onCopyJson={() => {
                try {
                  navigator.clipboard.writeText(
                    JSON.stringify(riPlanPreview, null, 2)
                  )
                } catch (e) {
                  console.error(e)
                }
              }}
            />
          )}
          {riSuggestions.length > 0 && (
            <div className="mb-2">
              <Suggestions>
                {riSuggestions.map((s) => (
                  <Suggestion
                    key={s.label}
                    suggestion={s.label}
                    onClick={() => {
                      // Refine current in-flight view if one is active and unsaved
                      const activeId = responseViewsStore.activeViewId
                      const activeView = responseViewsStore.views.find(
                        (v) => v.id === activeId
                      )
                      const refineContext =
                        activeView &&
                        activeView.id !== "default" &&
                        !activeView.saved
                          ? {
                              mode: "refine",
                              correlationId:
                                activeView.correlationId || activeView.id,
                              currentPlan: activeView.plan,
                            }
                          : undefined

                      sendMessage(
                        { parts: [{ type: "text", text: s.message }] },
                        {
                          body: {
                            formId,
                            userId: userId || "anonymous",
                            selectedModel,
                            options: {
                              intent:
                                activeMainTab === "responses"
                                  ? "response_intelligence"
                                  : "general",
                              responseIntelligence:
                                activeMainTab === "responses",
                              planContext: refineContext,
                            },
                          },
                        }
                      )
                    }}
                  />
                ))}
              </Suggestions>
            </div>
          )}
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
