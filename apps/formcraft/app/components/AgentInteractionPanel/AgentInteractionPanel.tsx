import Chat from "@/app/components/chat/chat"
import { useFormStore } from "@/app/dashboard/forms/[formId]/stores/useFormStore"
import { cn } from "@/app/lib"
import { analytics } from "@/app/lib/analytics"
import { MODEL_DEFAULT } from "@/app/lib/config"
import {
  ErrorEvent as AgentErrorEvent,
  AgentEvent,
} from "@/app/lib/types/agent-events"
// Renamed to avoid conflict
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import { useMobile } from "@/hooks/use-mobile"
import { useChat, type Message as VercelChatMessage } from "@ai-sdk/react"
import { useSidebar } from "@formlink/ui"
import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid" // For generating event IDs
import { CollapsedPanel, ExpandedPanel, FailedState } from "./components"
import { useAutoScroll, useFormattedEvents, usePanelState } from "./hooks"
import type { AgentInteractionPanelProps, ChatMessage } from "./types"
import { getLastUserMessage } from "./utils"

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
    // TODO: Remove connectionStatus and agentStreamConnectionStatus we can use chatStatus
    progress,
    // setAgentStreamConnectionStatus, // No longer needed for useChat's direct lifecycle
    processEvent,
    totalTaskCount, // Get the new totalTaskCount from the store
    completedTaskCount, // Get the new completedTaskCount from the store
  } = useFormAgentStore()
  const shortId = useFormStore((state) => state.form?.short_id) || ""

  const currentTask = completedTaskCount ?? 0 // Use completedTaskCount from the store
  // const totalTasks = progress?.total ?? 0; // We will now use totalTaskCount from the store

  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)

  // Store initial message locally to prevent timing issues
  const [storedInitialMessage] = useState<string | undefined>(
    () => initialMessage
  )
  // const [initialMessages, setInitialMessages] = useState<VercelChatMessage[]>([]); // Removed

  // useEffect for initialMessages removed

  const {
    messages: vercelChatMessages,
    append,
    status: chatStatus, // Directly from useChat
    data: chatData,
    setMessages, // Get setMessages from useChat
  } = useChat({
    id: formId, // Associate chat with formId
    api: "/api/chat",
    body: { formId, userId: userId || "anonymous", selectedModel },
    // initialMessages prop removed
    onError: (error) => {
      // Chat API error - keeping console.error for production debugging
      const lastEvent =
        eventsLog.length > 0 ? eventsLog[eventsLog.length - 1] : null
      const errorEvent: AgentErrorEvent = {
        id: uuidv4(),
        category: "error",
        type: "agent_error", // Generic agent error type for chat issues
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
        setMessages([]) // Clear messages if no formId
        return
      }
      try {
        const response = await fetch(`/api/chat?formId=${formId}`) // Updated endpoint
        if (!response.ok) {
          if (response.status === 404) {
            // Not an error, just no history
            setMessages([])
            return
          }
          throw new Error(
            `Failed to fetch chat history: ${response.statusText}`
          )
        }
        const historyMessages = await response.json()
        // Chat history loaded successfully

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
          setMessages([]) // If response is not an array (e.g. error object from API)
        }
      } catch (error) {
        // Error fetching chat history - handled silently
        setMessages([]) // Set to empty on error
      }
    }
    fetchChatHistoryAndSet()
  }, [formId, userId, setMessages]) // Add setMessages to dependency array

  // Send initial message if provided
  useEffect(() => {
    let isMounted = true

    if (
      storedInitialMessage &&
      vercelChatMessages.length === 0 &&
      !hasUserInteracted
    ) {
      // Small delay just to ensure UI is ready
      const timer = setTimeout(() => {
        if (isMounted) {
          append({
            role: "user",
            content: storedInitialMessage,
          })
          setHasUserInteracted(true)
        }
      }, 200) // Minimal delay for UI readiness

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
  // Pass chatStatus to usePanelState if it needs to react to chat loading state
  const { showChatInput, displaySummaryMessage } = usePanelState(
    agentState,
    formattedEventsForLogView
    // chatStatus // Potentially pass chatStatus here if usePanelState needs it
  )

  const logsContainerRef = useAutoScroll(
    formattedEventsForLogView,
    isPanelExpanded
  )
  const chatContainerRef = React.useRef<HTMLDivElement>(null)
  const lastProcessedEventIndexRef = useRef(0) // Added for tracking processed events

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

          // Track agent events
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
    // Check message structure for parts/toolInvocations

    return vercelChatMessages.map(
      (msg: any): ChatMessage => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
        // Pass through parts if available (AI SDK 4.3.16)
        ...(msg.parts ? { parts: msg.parts } : {}),
        // Pass through toolInvocations for backward compatibility
        ...(msg.toolInvocations
          ? { toolInvocations: msg.toolInvocations }
          : {}),
      })
    )
  }, [vercelChatMessages])

  const handleSendMessageForChatComponent = useCallback(
    async (message: string, model: string) => {
      setSelectedModel(model)

      // Track form creation started if this is the first message on dashboard
      if (isDashboard && chatMessages.length === 0) {
        analytics.formCreationStarted("ai_chat")
        analytics.aiAgentStarted("text", message.length)
      }

      // `useChat` handles its own loading state via `isLoading` or `status`
      await append({ role: "user", content: message })
    },
    [append, isDashboard, chatMessages.length] // Removed setAgentStreamConnectionStatus
  )

  const handleRetryClick = useCallback(() => {
    const lastUserMsg = getLastUserMessage(chatMessages)
    const messageToRetry = lastUserMsg?.content || agentState?.originalInput
    if (messageToRetry) {
      handleSendMessageForChatComponent(messageToRetry, selectedModel)
    } else {
      // Retry clicked, but no previous input found to retry with
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
                totalTasks={totalTaskCount ?? 0} // Use totalTaskCount from store, default to 0
                isStreaming={isStreaming}
              />
            )}
          </div>
        ) : null}
        {agentState?.status === "FAILED" && !isStreaming ? ( // Show retry only if agent failed and chat is not loading
          <FailedState onRetry={handleRetryClick} />
        ) : showChatInput ? (
          <div className={cn("flex items-center justify-center")}>
            <Chat
              onSubmit={handleSendMessageForChatComponent}
              isLoading={isStreaming} // Use direct loading state from useChat
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
