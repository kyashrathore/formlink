import { formatEventData } from "@/app/lib/utils/formatEventData"
import type {
  AgentState,
  ChatMessage,
  FormattedLogEvent,
  PanelState,
} from "./types"

export const findFirstAgentInitTimestamp = (
  eventsLog: any[]
): number | null => {
  const agentInitEvent = eventsLog.find(
    (log) => log.name === "agent_init" || log.name === "agent_start"
  )
  return agentInitEvent ? new Date(agentInitEvent.timestamp).getTime() : null
}

export const formatTimeDisplay = (
  currentEventTime: number,
  firstAgentInitTimestamp: number | null
): string => {
  if (
    firstAgentInitTimestamp !== null &&
    currentEventTime >= firstAgentInitTimestamp
  ) {
    const diffMs = currentEventTime - firstAgentInitTimestamp
    const totalSeconds = Math.floor(diffMs / 1000)
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
    const seconds = String(totalSeconds % 60).padStart(2, "0")
    return `${minutes}:${seconds}`
  }

  return new Date(currentEventTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export const formatEventsForLogView = (
  eventsLog: any[],
  firstAgentInitTimestamp: number | null
): FormattedLogEvent[] => {
  return eventsLog.map((log) => {
    const currentEventTime = new Date(log.timestamp).getTime()
    const timeDisplay = formatTimeDisplay(
      currentEventTime,
      firstAgentInitTimestamp
    )
    const eventName = log.type // Use log.type from AgentEvent

    return {
      ...log, // Spread the original log (which includes 'type', 'category', etc.)
      name: eventName, // Explicitly set the 'name' property for FormattedLogEvent
      displayTime: timeDisplay,
      formattedContent: `[${eventName}] ${formatEventData(eventName, log.data)} (+${timeDisplay})`,
    }
  })
}

export const filterLogsForEventView = (
  formattedEvents: FormattedLogEvent[]
): FormattedLogEvent[] => {
  return formattedEvents.filter(
    (log) =>
      log.name !== "assistant_message_generated" &&
      log.name !== "user_message_generated"
  )
}

export const getDisplaySummaryMessage = (
  formattedEvents: FormattedLogEvent[],
  agentState: AgentState | null
): string => {
  const latestEvent =
    formattedEvents.length > 0
      ? formattedEvents[formattedEvents.length - 1]
      : null

  if (latestEvent) {
    const content = latestEvent.formattedContent
    return content.length > 60 ? content.substring(0, 60) + "..." : content
  }

  if (agentState?.status === "FAILED") {
    return "Process Failed"
  }

  return "Agent Idle"
}

export const calculatePanelState = (
  agentState: AgentState | null,
  formattedEvents: FormattedLogEvent[]
): PanelState => {
  const showChatInput = agentState?.status !== "FAILED"
  const displaySummaryMessage = getDisplaySummaryMessage(
    formattedEvents,
    agentState
  )

  return {
    isExpanded: true, // Default state, will be managed by component
    showChatInput,
    displaySummaryMessage,
  }
}

export const getLastUserMessage = (
  chatMessages: ChatMessage[]
): ChatMessage | undefined => {
  return chatMessages.filter((m) => m.role === "user").pop()
}

export const formatChatMessageTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}
