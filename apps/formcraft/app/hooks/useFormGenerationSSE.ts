/**
 * Hook for managing SSE connection for form generation
 */

"use client"

import { formGenerationAnalytics } from "@/app/lib/analytics/form-generation-analytics"
import { FormGenerationEventHandler } from "@/app/lib/handlers/FormGenerationEventHandler"
import { SSEConnection } from "@/app/lib/sse/SSEConnection"
import { useFormGenerationStore } from "@/app/stores/formGenerationStore"
import { useCallback, useEffect, useRef } from "react"

interface UseFormGenerationSSEOptions {
  formId: string
  apiUrl?: string
  enabled?: boolean
}

export function useFormGenerationSSE({
  formId,
  apiUrl = "/api/agent/stream",
  enabled = true,
}: UseFormGenerationSSEOptions) {
  const store = useFormGenerationStore()
  const eventHandlerRef = useRef<FormGenerationEventHandler>(null as any)
  const connectionRef = useRef<SSEConnection>(null as any)
  const isUsingNewStore = true // Default to true

  // Initialize event handler
  useEffect(() => {
    if (isUsingNewStore) {
      eventHandlerRef.current = new FormGenerationEventHandler()
    }
  }, [store, isUsingNewStore])

  // Handle incoming SSE messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!eventHandlerRef.current || !isUsingNewStore) {
        return
      }

      try {
        const data = JSON.parse(event.data)
        eventHandlerRef.current.handleRawEvent(data)
      } catch (error) {
        console.error("[SSE] Failed to parse event:", error)
      }
    },
    [isUsingNewStore]
  )

  // Handle connection events
  const handleOpen = useCallback(() => {
    formGenerationAnalytics.trackGenerationStart(formId)
  }, [formId])

  const handleError = useCallback((error: Error) => {
    console.error("[SSE] Connection error:", error)
    formGenerationAnalytics.trackError("connection", error)
  }, [])

  const handleClose = useCallback(() => {
    // do nothing
  }, [])

  // Set up SSE connection
  useEffect(() => {
    if (!enabled || !formId || !isUsingNewStore) {
      return
    }

    // Build URL with form ID
    const url = `${apiUrl}?formId=${encodeURIComponent(formId)}`

    // Create connection
    const connection = new SSEConnection({
      url,
      onMessage: handleMessage,
      onOpen: handleOpen,
      onError: handleError,
      onClose: handleClose,
      maxRetries: 5,
      baseDelay: 1000,
    })

    connectionRef.current = connection
    connection.connect()

    // Start generation in store
    store.startGeneration(formId)

    return () => {
      connection.close()
    }
  }, [
    formId,
    apiUrl,
    enabled,
    isUsingNewStore,
    handleMessage,
    handleOpen,
    handleError,
    handleClose,
    store,
  ])

  // Expose connection controls
  return {
    reconnect: () => connectionRef.current?.connect(),
    close: () => connectionRef.current?.close(),
    getState: () =>
      connectionRef.current?.getState() || {
        readyState: null,
        retryCount: 0,
        isConnected: false,
      },
  }
}

/**
 * Hook that combines SSE connection with store state
 */
export function useFormGeneration(
  formId: string,
  options?: {
    enabled?: boolean
    apiUrl?: string
  }
) {
  const store = useFormGenerationStore()
  const connection = useFormGenerationSSE({
    formId,
    enabled: options?.enabled ?? true,
    apiUrl: options?.apiUrl,
  })

  return {
    // Store state
    ...store,

    // Connection controls
    connection,

    // Computed helpers
    isConnected: connection.getState().isConnected,
    canRetry: connection.getState().retryCount < 5,
  }
}
