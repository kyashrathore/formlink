import { useEffect, useMemo, useRef } from "react"
import type { AgentState, FormattedLogEvent } from "./types"
import {
  calculatePanelState,
  filterLogsForEventView,
  findFirstAgentInitTimestamp,
  formatEventsForLogView,
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
