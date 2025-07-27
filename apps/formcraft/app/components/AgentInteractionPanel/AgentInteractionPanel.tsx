import Chat from "@/app/components/chat/chat"
import { getLastUserMessage } from "@/app/dashboard/forms/[formId]/components/chat/utils"
import { useFormStore } from "@/app/dashboard/forms/[formId]/stores/useFormStore"
import { cn } from "@/app/lib"
import { analytics } from "@/app/lib/analytics"
import { MODEL_DEFAULT } from "@/app/lib/config"
import {
  ErrorEvent as AgentErrorEvent,
  AgentEvent,
} from "@/app/lib/types/agent-events"
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import { useMobile } from "@/hooks/use-mobile"
import { useChat, type Message as VercelChatMessage } from "@ai-sdk/react"
import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { CollapsedPanel, ExpandedPanel, FailedState } from "./components"
import { useAutoScroll, useFormattedEvents, usePanelState } from "./hooks"
import type { AgentInteractionPanelProps, ChatMessage } from "./types"

const AgentInteractionPanel: React.FC<AgentInteractionPanelProps> = ({
  formId,
  userId,
  layoutId,
  showSuggestions,
  initialMessage,
}) => {
  const isMobile = useMobile()
  const pathname = usePathname()
  const isDashboard = pathname === "/dashboard"
  const {
    agentState,
    eventsLog,
    processEvent,
    totalTaskCount,
    completedTaskCount,
  } = useFormAgentStore()
  const shortId = useFormStore((state) => state.form?.short_id) || ""

  const currentTask = completedTaskCount ?? 0

  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
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
            .filter((msg) =>
              validRoles.includes((msg as { role?: string }).role || "")
            )
            .map((msg) => ({
              id: msg.id?.toString() || uuidv4(),
              role: (msg as { role?: string }).role as
                | "user"
                | "assistant"
                | "system",
              content:
                typeof (msg as { content?: unknown }).content === "string"
                  ? (msg as { content?: string }).content || ""
                  : JSON.stringify(
                      (msg as { content?: unknown }).content || ""
                    ),
              createdAt: (msg as { created_at?: string }).created_at
                ? new Date((msg as { created_at?: string }).created_at!)
                : new Date(),
            }))
          setMessages(formattedMessages)
        } else {
          setMessages([])
        }
      } catch {
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

  const { formattedEventsForLogView, logsToShowInEventView } =
    useFormattedEvents(eventsLog)

  const { showChatInput, displaySummaryMessage } = usePanelState(
    agentState,
    formattedEventsForLogView
  )

  const logsContainerRef = useAutoScroll(
    formattedEventsForLogView,
    isPanelExpanded
  )
  const chatContainerRef = React.useRef<HTMLDivElement>(null)
  const lastProcessedEventIndexRef = useRef(0)

  useEffect(() => {
    if (chatData && chatData.length > lastProcessedEventIndexRef.current) {
      const newEvents = chatData.slice(lastProcessedEventIndexRef.current)
      newEvents.forEach((dataItem) => {
        if (
          dataItem &&
          typeof dataItem === "object" &&
          "category" in dataItem &&
          "type" in dataItem
        ) {
          processEvent(dataItem as AgentEvent)

          if (
            dataItem.type === "task_completed" ||
            dataItem.type === "agent_error"
          ) {
            analytics.aiAgentEventReceived(
              dataItem.type,
              dataItem.data?.task_name
            )
          }
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

  const chatMessages: ChatMessage[] = useMemo(() => {
    return vercelChatMessages.map(
      (msg): ChatMessage => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),

        ...((msg as { parts?: unknown }).parts
          ? { parts: (msg as { parts?: unknown }).parts }
          : {}),

        ...((msg as { toolInvocations?: unknown }).toolInvocations
          ? {
              toolInvocations: (msg as { toolInvocations?: unknown })
                .toolInvocations,
            }
          : {}),
      })
    )
  }, [vercelChatMessages])

  const handleSendMessageForChatComponent = useCallback(
    async (message: string, model: string) => {
      setSelectedModel(model)

      if (isDashboard && chatMessages.length === 0) {
        analytics.formCreationStarted("ai_chat")
        analytics.aiAgentStarted("text", message.length)
      }

      await append({ role: "user", content: message })
    },
    [append, isDashboard, chatMessages.length]
  )

  const handleRetryClick = useCallback(() => {
    const lastUserMsg = getLastUserMessage(chatMessages)
    const messageToRetry = lastUserMsg?.content || agentState?.originalInput
    if (messageToRetry) {
      handleSendMessageForChatComponent(messageToRetry, selectedModel)
    } else {
    }
  }, [
    chatMessages,
    agentState?.originalInput,
    selectedModel,
    handleSendMessageForChatComponent,
  ])

  const handleInputChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_value: string) => {
      setHasUserInteracted(true)
    },
    []
  )

  const isStreaming = chatStatus === "streaming"
  return (
    <motion.div
      className={cn(
        "fixed top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 p-2",
        isDashboard
          ? hasUserInteracted
            ? "top-auto bottom-0 -translate-y-0"
            : ""
          : "top-auto bottom-0 left-[calc(50%+8rem)] -translate-y-0",
        isMobile ? "right-0 left-0 translate-x-0" : "justify-center"
      )}
      layoutId={layoutId}
    >
      <motion.div
        layout="position"
        className={cn(
          "flex w-3xl w-full max-w-3xl flex-col space-y-2 sm:w-2xl"
        )}
      >
        {!isDashboard || hasUserInteracted ? (
          <div className="flex-1">
            {!isPanelExpanded ? (
              <CollapsedPanel
                displaySummaryMessage={displaySummaryMessage}
                onExpand={() => setIsPanelExpanded(true)}
                isStreaming={isStreaming}
              />
            ) : (
              <ExpandedPanel
                shortId={shortId}
                chatMessages={chatMessages}
                logsToShow={logsToShowInEventView}
                chatContainerRef={chatContainerRef}
                logsContainerRef={logsContainerRef}
                onCollapse={() => setIsPanelExpanded(false)}
                displaySummaryMessage={displaySummaryMessage}
                currentTask={currentTask}
                totalTasks={totalTaskCount ?? 0}
                isStreaming={isStreaming}
              />
            )}
          </div>
        ) : null}
        {agentState?.status === "FAILED" && !isStreaming ? (
          <FailedState onRetry={handleRetryClick} />
        ) : showChatInput ? (
          <div className={cn("flex items-center justify-center")}>
            <Chat
              onSubmit={handleSendMessageForChatComponent}
              isLoading={isStreaming}
              showSuggestions={isStreaming ? false : showSuggestions}
              onInputChange={handleInputChange}
            />
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

export default AgentInteractionPanel
