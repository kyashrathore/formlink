import { useEffect, useMemo, useRef } from "react"
import type { AgentState, FormattedLogEvent } from "./types" // Removed ChatMessage
import {
  calculatePanelState,
  filterLogsForEventView,
  findFirstAgentInitTimestamp,
  formatEventsForLogView,
  // getLastUserMessage // No longer needed here
} from "./utils"

export const useFormattedEvents = (
  eventsLog: any[]
): {
  firstAgentInitTimestamp: number | null
  formattedEventsForLogView: FormattedLogEvent[]
  logsToShowInEventView: FormattedLogEvent[]
} => {
  const firstAgentInitTimestamp = useMemo(
    () => findFirstAgentInitTimestamp(eventsLog),
    [eventsLog]
  )

  const formattedEventsForLogView = useMemo(
    () => formatEventsForLogView(eventsLog, firstAgentInitTimestamp),
    [eventsLog, firstAgentInitTimestamp]
  )

  const logsToShowInEventView = useMemo(
    () => filterLogsForEventView(formattedEventsForLogView),
    [formattedEventsForLogView]
  )

  return {
    firstAgentInitTimestamp,
    formattedEventsForLogView,
    logsToShowInEventView,
  }
}

export const usePanelState = (
  agentState: AgentState | null,
  formattedEvents: FormattedLogEvent[]
  // chatStatus?: ReturnType<typeof useChat>['status'] // Optional: if panel state needs to react to chat status
) => {
  return useMemo(
    () => calculatePanelState(agentState, formattedEvents),
    [agentState, formattedEvents]
  )
}

export const useAutoScroll = (dependency: any[], isPanelExpanded: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPanelExpanded && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [dependency, isPanelExpanded])

  return containerRef
}

// useAgentActions has been removed as its functionality is now integrated
// into AgentInteractionPanel.tsx using the useChat hook.
