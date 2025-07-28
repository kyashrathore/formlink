import { useCallback } from "react"
import { AgentEvent } from "../lib/types/agent-events"

export function useFormGenerationEventBridge(store: any) {
  const bridgeEvent = useCallback(
    (event: AgentEvent) => {
      // Remove duplicate question processing - already handled in processEvent
      switch (event.type) {
        default:
          break
      }
    },
    [store]
  )

  return { bridgeEvent }
}
