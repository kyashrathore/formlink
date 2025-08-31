/**
 * Hook for using SSE connection in React components
 */
import React from "react"

/**
 * SSE Connection management with retry logic and resilience
 */

export interface SSEConnectionOptions {
  url: string
  onMessage?: (event: MessageEvent) => void
  onError?: (error: Error) => void
  onOpen?: () => void
  onClose?: () => void
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  headers?: Record<string, string>
}

export class SSEConnection {
  private eventSource: EventSource | null = null
  private retryCount = 0
  private retryTimer: NodeJS.Timeout | null = null
  private isClosing = false
  private connectionStartTime: number | null = null

  private readonly options: Required<SSEConnectionOptions>

  constructor(options: SSEConnectionOptions) {
    this.options = {
      onMessage: () => {},
      onError: () => {},
      onOpen: () => {},
      onClose: () => {},
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      headers: {},
      ...options,
    }
  }

  /**
   * Connect to SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      this.close()
    }

    this.isClosing = false
    this.connectionStartTime = Date.now()

    try {
      // EventSource doesn't support custom headers, so we'll add them as query params
      const url = new URL(this.options.url)
      Object.entries(this.options.headers).forEach(([key, value]) => {
        url.searchParams.append(`header_${key}`, value)
      })

      this.eventSource = new EventSource(url.toString())
      this.setupEventHandlers()
    } catch (error) {
      this.handleError(new Error(`Failed to create EventSource: ${error}`))
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.eventSource) return

    this.eventSource.onopen = () => {
      this.retryCount = 0
      this.options.onOpen()
      this.logConnectionMetrics("connected")
    }

    this.eventSource.onmessage = (event) => {
      try {
        this.options.onMessage(event)
      } catch (error) {
        console.error("[SSE] Error handling message:", error)
      }
    }

    this.eventSource.onerror = () => {
      if (this.isClosing) {
        return
      }

      // Log connection duration if we were connected
      if (
        this.eventSource?.readyState === EventSource.CLOSED &&
        this.connectionStartTime
      ) {
        const duration = Date.now() - this.connectionStartTime
        this.logConnectionMetrics("disconnected", { duration })
      }

      this.handleError(new Error("SSE connection error"))
      this.attemptReconnect()
    }

    // Listen for specific event types if needed
    this.eventSource.addEventListener(
      "heartbeat",
      this.handleHeartbeat.bind(this)
    )
  }

  /**
   * Handle heartbeat events to detect stale connections
   */
  private handleHeartbeat(): void {
    // Reset any stale connection timers
    // Could implement connection health monitoring here
  }

  /**
   * Handle connection errors
   */
  private handleError(error: Error): void {
    this.options.onError(error)

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[SSE] Connection error:", error)
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.retryCount >= this.options.maxRetries) {
      this.handleMaxRetriesExceeded()
      return
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.baseDelay * Math.pow(2, this.retryCount),
      this.options.maxDelay
    )

    this.retryCount++

    this.retryTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * Handle max retries exceeded
   */
  private handleMaxRetriesExceeded(): void {
    const error = new Error(
      `SSE connection failed after ${this.options.maxRetries} attempts`
    )
    this.options.onError(error)
    this.options.onClose()

    // Could trigger fallback mechanism here
    if (typeof window !== "undefined" && (window as any).analytics) {
      ;(window as any).analytics.track("sse_max_retries_exceeded", {
        url: this.options.url,
        attempts: this.retryCount,
      })
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    this.isClosing = true

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.options.onClose()
  }

  /**
   * Get connection state
   */
  getState(): {
    readyState: number | null
    retryCount: number
    isConnected: boolean
  } {
    return {
      readyState: this.eventSource?.readyState ?? null,
      retryCount: this.retryCount,
      isConnected: this.eventSource?.readyState === EventSource.OPEN,
    }
  }

  /**
   * Log connection metrics
   */
  private logConnectionMetrics(
    event: string,
    data?: Record<string, any>
  ): void {
    if (typeof window !== "undefined" && (window as any).analytics) {
      ;(window as any).analytics.track(`sse_connection_${event}`, {
        url: this.options.url,
        retryCount: this.retryCount,
        timestamp: new Date().toISOString(),
        ...data,
      })
    }
  }
}

export function useSSEConnection(options: SSEConnectionOptions) {
  const connectionRef = React.useRef<SSEConnection>(null as any)
  const [connectionState, setConnectionState] = React.useState({
    isConnected: false,
    retryCount: 0,
  })

  React.useEffect(() => {
    const connection = new SSEConnection({
      ...options,
      onOpen: () => {
        setConnectionState({ isConnected: true, retryCount: 0 })
        options.onOpen?.()
      },
      onClose: () => {
        setConnectionState((prev) => ({ ...prev, isConnected: false }))
        options.onClose?.()
      },
      onError: (error) => {
        setConnectionState((prev) => ({
          ...prev,
          retryCount: connection.getState().retryCount,
        }))
        options.onError?.(error)
      },
    })

    connectionRef.current = connection
    connection.connect()

    return () => {
      connection.close()
    }
  }, [options.url]) // Only reconnect if URL changes

  return {
    connectionState,
    reconnect: () => connectionRef.current?.connect(),
    close: () => connectionRef.current?.close(),
  }
}
