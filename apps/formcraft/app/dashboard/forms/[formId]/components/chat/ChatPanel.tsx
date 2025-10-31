import { MODEL_DEFAULT } from "@/app/lib/config"
import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import type { LifecyclePlanProposal } from "@/app/lib/lifecycle/plan-types"
import type { RIPlanResponse } from "@/app/lib/ri/types"
import { useChat } from "@ai-sdk/react"
import { Button, PromptSuggestion } from "@formlink/ui"
import { Suggestion, Suggestions } from "@formlink/ui/ai-elements"
import { DefaultChatTransport } from "ai"
import { AlertTriangle } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useChatHistoryQuery } from "../../hooks/useChatHistoryQuery"
import { usePanelState } from "../../hooks/usePanelState"
import { applyRIPlanToUI } from "../../lib/responses/ri-adapter"
import { AgentEvent, createAgentEvent } from "../../lib/types/agent-events"
import { useAutomationsPlanStore } from "../../stores/useAutomationsPlanStore"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"
import { useResponseViewsStore } from "../../stores/useResponseViewsStore"
import Chat from "./chat-components/chat"
import { Conversation } from "./conversation"
import { useAutoScroll, useFormattedEvents } from "./hooks"
import { normalizePersistedParts } from "./parts"
// RIPlanPreview is no longer rendered inside chat history; plans are shown in the right panel
// import RIPlanPreview from "./RIPlanPreview"
import { computeChatStatus } from "./status"
import type { ChatPanelProps } from "./types"
import { getDisplaySummaryMessage } from "./utils"

const ChatPanel: React.FC<ChatPanelProps> = ({
  formId,
  userId,
  initialMessage,
  initialModel,
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
  const [selectedModel, setSelectedModel] = useState(
    initialModel || MODEL_DEFAULT
  )
  useEffect(() => {
    if (initialModel && initialModel !== selectedModel) {
      setSelectedModel(initialModel)
    }
  }, [initialModel])
  const [storedInitialMessage, setStoredInitialMessage] = useState<
    string | undefined
  >(() => initialMessage)
  type RISuggestion = { label: string; message: string }
  const [riSuggestions, setRiSuggestions] = useState<RISuggestion[]>([])
  const responseViewsStore = useResponseViewsStore()
  const [responsePlanSuggestions, setResponsePlanSuggestions] = useState<
    string[]
  >([])
  const [responsePlanSuggestionsLoading, setResponsePlanSuggestionsLoading] =
    useState(false)
  const [responsePlanSuggestionsError, setResponsePlanSuggestionsError] =
    useState<string | null>(null)
  const suggestionSignatureRef = useRef<string | null>(null)

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
              const plan = raw.plan as RIPlanResponse
              applyRIPlanToUI(plan, editorForm || generationForm)
              // Create/activate ephemeral view for this plan
              addOrUpdateFromPlan(plan, editorForm || generationForm, formId)
              const followups = plan?.plan?.meta?.followups
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
              const correlationId =
                plan.correlationId ||
                plan.plan?.meta?.view_name ||
                `plan-${Date.now()}`
              // Do not render the plan inside chat history; rely on right-panel rendering
              // Switch to Responses tab to reveal the plan card instantly
              try {
                const { setActiveMainTab } = usePanelState.getState() as any
                if (setActiveMainTab) setActiveMainTab("responses")
              } catch (e) {
                console.error(e)
              }
            } catch (e) {
              console.error("Failed to apply RI plan", e)
            }
            return
          }

          // Intercept Lifecycle Automation plan events; do NOT create a Response View
          if (raw?.type === "lifecycle_automation_plan" && raw?.plan) {
            try {
              const plan = raw.plan as LifecyclePlanProposal
              const { setActiveMainTab } = usePanelState.getState() as any
              if (setActiveMainTab) setActiveMainTab("responses")
              // Store the lifecycle plan and open the drawer via store
              useAutomationsPlanStore.getState().set(plan, true)
            } catch (e) {
              console.error("Failed to process lifecycle plan", e)
            }
            return
          }

          const event = raw as AgentEvent

          if (eventHandlerRef.current) {
            eventHandlerRef.current.handleRawEvent(event)
          }
          memoizedProcessEvent(event)
          return
        }

        // Bridge codegen SSE events into our AgentEvent log + update preview URL
        if (
          dataPart &&
          typeof dataPart === "object" &&
          (dataPart as any).type === "data" &&
          Array.isArray((dataPart as any).value)
        ) {
          const arr = (dataPart as any).value as any[]
          for (const item of arr) {
            if (item?.eventName === "codegen") {
              const et = String(item.eventType || "log")
              const payload = item.data || {}
              const seq = Date.now()

              // Map to AgentEvent
              if (et === "error") {
                const ev = createAgentEvent(
                  "agent_error",
                  "error",
                  {
                    message: payload?.message || "Codegen error",
                    details: payload,
                    recoverable: true,
                  },
                  formId,
                  userId || "anonymous",
                  seq
                )
                memoizedProcessEvent(ev as any)
              } else if (et === "status" || et === "log" || et === "command") {
                const ev = createAgentEvent(
                  "task_started",
                  "progress",
                  {
                    taskId: et,
                    taskType: "codegen",
                    current: 0,
                    total: 0,
                    message:
                      payload?.message ||
                      payload?.cmd ||
                      payload?.status ||
                      JSON.stringify(payload),
                  },
                  formId,
                  userId || "anonymous",
                  seq
                )
                memoizedProcessEvent(ev as any)
              } else if (et === "preview") {
                const url = payload?.url as string | undefined
                const sid = payload?.sandboxId as string | undefined
                if (url) {
                  // Update the form editor store so Preview tab swaps immediately
                  useFormEditorStore
                    .getState()
                    .updateFormField("preview_url", url as any)
                }
                if (sid) {
                  useFormEditorStore
                    .getState()
                    .updateFormField("sandbox_id", sid as any)
                }
                const ev = createAgentEvent(
                  "task_completed",
                  "progress",
                  {
                    taskId: "preview",
                    taskType: "codegen",
                    current: 1,
                    total: 1,
                    message: url
                      ? `Preview available: ${url}`
                      : "Preview updated",
                  },
                  formId,
                  userId || "anonymous",
                  seq
                )
                memoizedProcessEvent(ev as any)
              } else if (et === "push") {
                const branch = payload?.branchName as string | undefined
                if (branch) {
                  useFormEditorStore
                    .getState()
                    .updateFormField("branch_name", branch as any)
                }
              } else if (et === "complete") {
                const branch = payload?.branchName as string | undefined
                const url = payload?.previewUrl as string | undefined
                if (branch) {
                  useFormEditorStore
                    .getState()
                    .updateFormField("branch_name", branch as any)
                }
                if (url) {
                  useFormEditorStore
                    .getState()
                    .updateFormField("preview_url", url as any)
                }
                const ev = createAgentEvent(
                  "agent_finalized",
                  "system",
                  { message: "Codegen complete", details: payload },
                  formId,
                  userId || "anonymous",
                  seq
                )
                memoizedProcessEvent(ev as any)
              }
            }
          }
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

  const fallbackResponsePrompts = [
    "Show a view of incomplete responses this week",
    "Compare submissions by source channel",
    "Highlight responses requiring manual follow-up",
  ]

  const responsePlanPromptIntro =
    "Ask for smart views, applied filters, or charts to explore your submissions."

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

  const isResponsesTab = activeMainTab === "responses"

  useEffect(() => {
    if (!isResponsesTab) {
      setResponsePlanSuggestionsLoading(false)
      return
    }

    const form = editorForm || generationForm
    if (!form) {
      setResponsePlanSuggestions([])
      setResponsePlanSuggestionsError(null)
      return
    }

    const questionSignature = Array.isArray(form.questions)
      ? form.questions.map((q: any) => q?.id || q?.title || "").join("|")
      : ""
    const signature = `${form.id || "no-form"}|${questionSignature}`
    if (suggestionSignatureRef.current === signature) {
      return
    }
    suggestionSignatureRef.current = signature

    setResponsePlanSuggestionsLoading(true)
    setResponsePlanSuggestionsError(null)

    const controller = new AbortController()

    const payload = {
      operationType: "response-plan-suggestions" as const,
      prompt: `Provide several short prompt ideas to analyze responses for the form titled "${
        form.title || "Untitled Form"
      }". Focus on filters, segments, comparisons, and insights.`,
      form_details: {
        title: form.title || "",
        description: form.description || "",
        questions: form.questions || [],
      },
    }

    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json()
        if (res.ok && !json.error && Array.isArray(json.data?.suggestions)) {
          setResponsePlanSuggestions(json.data.suggestions)
        } else {
          throw new Error(json.message || "Failed to generate suggestions")
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error("Failed to load response plan suggestions", error)
        setResponsePlanSuggestions([])
        setResponsePlanSuggestionsError(
          "Unable to generate response suggestions right now."
        )
        suggestionSignatureRef.current = null
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setResponsePlanSuggestionsLoading(false)
        }
      })

    return () => controller.abort()
  }, [isResponsesTab, editorForm, generationForm])

  const { formattedEventsForLogView } = useFormattedEvents(eventsLog)
  const isStreaming = chatStatus === "streaming"
  const chatContainerRef = useAutoScroll(
    [vercelChatMessages, isStreaming],
    true
  )

  const handleSendMessageForChatComponent = useCallback(
    async (message: string, model: string) => {
      setSelectedModel(model)
      // If on Responses tab, include refine context for active view so agent can update it
      let refineContext: any = undefined
      if (activeMainTab === "responses") {
        const currentForm = editorForm || generationForm
        const activeId = currentForm?.id
          ? responseViewsStore.activeViewIdMap[currentForm.id] || "default"
          : "default"
        const activeView = responseViewsStore.views.find(
          (v) =>
            v.id === activeId &&
            (v.formId === currentForm?.id || v.id === "default")
        )
        if (activeView && activeView.id !== "default") {
          refineContext = {
            mode: "refine" as const,
            correlationId: activeView.correlationId || activeView.id,
            currentPlan: activeView.plan,
            saved: Boolean(activeView.saved),
          }
        }
        // Provide last plan disposition (saved/discarded/unsaved) for AI context
        if (currentForm?.id) {
          const last =
            useResponseViewsStore.getState().lastPlanStatusMap[currentForm.id]
          if (last) {
            refineContext = { ...(refineContext || {}), previousPlan: last }
          }
        }
      }
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
              planContext: refineContext,
            },
          },
        }
      )
    },
    [sendMessage, formId, userId, activeMainTab, editorForm, generationForm]
  )

  const handleRetryClick = useCallback(() => {
    const lastUserUi = [...vercelChatMessages]
      .filter((m: any) => m.role === "user")
      .pop() as any
    const textPart = (lastUserUi?.parts || []).find(
      (p: any) => p?.type === "text" && typeof p.text === "string"
    ) as any
    const messageToRetry = textPart?.text || storedInitialMessage || ""
    if (messageToRetry) {
      handleSendMessageForChatComponent(messageToRetry, selectedModel)
    }
  }, [
    vercelChatMessages,
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
    !storedInitialMessage &&
    !hasUserInteracted &&
    vercelChatMessages.length === 0 &&
    (isResponsesTab || !formReady)

  const responseSuggestionsToShow = isResponsesTab
    ? responsePlanSuggestions.length > 0
      ? responsePlanSuggestions
      : fallbackResponsePrompts
    : initialFormPrompts

  // No inline plan preview renderer; plans are presented on the right panel

  const lastAssistantMessage = vercelChatMessages.find(
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
        {vercelChatMessages.length > 0 ? (
          <Conversation
            messages={vercelChatMessages as any}
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
            // Plan previews are hidden in chat; shown in right panel
          />
        ) : suggestionsVisible ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div className="flex w-full max-w-md flex-col items-center gap-3">
              <div className="text-muted-foreground">
                <div className="mb-2 text-lg font-medium">
                  Start a conversation
                </div>
                <div className="text-sm">
                  Choose a suggestion below or ask me anything about forms
                </div>
              </div>

              <div className="flex w-full flex-col gap-2">
                {isResponsesTab && (
                  <PromptSuggestion
                    variant="ghost"
                    size="sm"
                    disabled
                    className="border-primary/20 bg-primary/5 w-full cursor-default items-start justify-start gap-1 rounded-xl border px-4 py-3 text-left"
                  >
                    <span className="text-primary text-sm font-semibold">
                      Explore Response Intelligence
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {responsePlanPromptIntro}
                    </span>
                  </PromptSuggestion>
                )}

                {isResponsesTab && responsePlanSuggestionsLoading && (
                  <div className="text-muted-foreground text-xs">
                    Generating tailored suggestions…
                  </div>
                )}

                {isResponsesTab && responsePlanSuggestionsError && (
                  <div className="text-destructive text-xs">
                    {responsePlanSuggestionsError}
                  </div>
                )}

                {responseSuggestionsToShow.map((prompt, index) => (
                  <PromptSuggestion
                    key={`${prompt}-${index}`}
                    onClick={() => handleSuggestionClick(prompt)}
                    variant={isResponsesTab ? "ghost" : "outline"}
                    size="sm"
                    className={
                      isResponsesTab
                        ? "w-full justify-start text-left"
                        : "text-sm"
                    }
                    highlight={isResponsesTab ? "view" : ""}
                  >
                    {prompt}
                  </PromptSuggestion>
                ))}
              </div>
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
          {riSuggestions.length > 0 && (
            <div className="mb-2">
              <Suggestions>
                {riSuggestions.map((s) => (
                  <Suggestion
                    key={s.label}
                    suggestion={s.label}
                    onClick={() => {
                      // Refine current active view (saved or unsaved)
                      const currentForm = editorForm || generationForm
                      const activeId = currentForm?.id
                        ? responseViewsStore.activeViewIdMap[currentForm.id] ||
                          "default"
                        : "default"
                      const activeView = responseViewsStore.views.find(
                        (v) =>
                          v.id === activeId &&
                          (v.formId === currentForm?.id || v.id === "default")
                      )
                      const refineContext =
                        activeView && activeView.id !== "default"
                          ? {
                              mode: "refine" as const,
                              correlationId:
                                activeView.correlationId || activeView.id,
                              currentPlan: activeView.plan,
                              saved: Boolean(activeView.saved),
                            }
                          : undefined
                      if (currentForm?.id) {
                        const last =
                          useResponseViewsStore.getState().lastPlanStatusMap[
                            currentForm.id
                          ]
                        if (last) {
                          ;(refineContext as any) = {
                            ...(refineContext || {}),
                            previousPlan: last,
                          }
                        }
                      }

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
          {isResponsesTab && !suggestionsVisible && (
            <div className="mb-2">
              <div className="border-primary/30 bg-primary/10 mb-3 rounded-xl border px-4 py-3 shadow-sm">
                <div className="text-primary text-sm font-semibold">
                  Response intelligence starter
                </div>
                <div className="text-muted-foreground text-xs leading-snug">
                  Explore the prompts below to segment results, compare groups,
                  and surface key insights from your submissions.
                </div>
              </div>
              {responsePlanSuggestionsLoading && (
                <div className="text-muted-foreground text-xs">
                  Generating tailored suggestions…
                </div>
              )}
              {responsePlanSuggestionsError && (
                <div className="text-destructive text-xs">
                  {responsePlanSuggestionsError}
                </div>
              )}
              <Suggestions>
                {responseSuggestionsToShow.map((prompt, index) => (
                  <Suggestion
                    key={`${prompt}-${index}`}
                    suggestion={prompt}
                    onClick={handleSuggestionClick}
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
            initialModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      )}
    </div>
  )
}

export default ChatPanel
