"use client"

import { Form } from "@formlink/schema"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getFormFillerPreviewBasePath } from "../../lib/config"

interface FormPreviewProps {
  form: Form
  className?: string
  formMode?: "chat" | "typeform"
  onFormModeChange?: (mode: "chat" | "typeform") => void
  shadcnCSSData?: {
    cssText: string
    version: number // Increment to trigger updates
  }
  onShadcnApplied?: (result: {
    success: boolean
    error?: string
    appliedRootVariables: string[]
    appliedDarkVariables: string[]
    warnings: string[]
  }) => void
}

interface PreviewState {
  type: "loading" | "ready" | "error" | "timeout"
  error?: {
    message: string
    code: string
    recoverable: boolean
  }
}

interface FormUpdateMessage {
  type: "FORMCRAFT_FORM_UPDATE"
  payload: Form
}

interface FormModeUpdateMessage {
  type: "FORMCRAFT_MODE_UPDATE"
  payload: {
    formMode: "chat" | "typeform"
    timestamp: number
  }
}

interface ShadcnCSSUpdateMessage {
  type: "FORMCRAFT_SHADCN_CSS_UPDATE"
  payload: {
    cssText: string
    timestamp: number
  }
}

interface PreviewReadyMessage {
  type: "FORMFILLER_PREVIEW_READY"
  formId: string
}

interface ShadcnCSSAppliedMessage {
  type: "FORMFILLER_SHADCN_CSS_APPLIED"
  payload: {
    success: boolean
    error?: string
    appliedRootVariables: string[]
    appliedDarkVariables: string[]
    warnings: string[]
    timestamp: number
  }
}

type PostMessage =
  | FormUpdateMessage
  | FormModeUpdateMessage
  | ShadcnCSSUpdateMessage

export default function FormPreview({
  form,
  className = "",
  formMode = "chat",
  onFormModeChange,
  shadcnCSSData,
  onShadcnApplied,
}: FormPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [previewState, setPreviewState] = useState<PreviewState>({
    type: "loading",
  })

  const [retryCount, setRetryCount] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isReadyRef = useRef(false)

  // Stable form identifier - prefer shortId but keep it stable once set
  const stableFormId = useMemo(() => {
    // Once we have a shortId, always use it. Otherwise use the full ID.
    // This prevents the URL from changing when shortId gets loaded async
    return form.short_id || form.id
  }, [form.short_id ? form.short_id : form.id])

  // Stable preview URL - only changes if the stable form ID changes
  const stablePreviewUrl = useMemo(() => {
    const previewBasePath = getFormFillerPreviewBasePath()
    const finalUrl = `${previewBasePath}/${stableFormId}`
    return finalUrl
  }, [stableFormId])

  // Get the FormFiller preview URL (stable reference)
  const getPreviewUrl = useCallback(() => stablePreviewUrl, [stablePreviewUrl])

  // Immediate function to send form updates
  const sendFormUpdate = useCallback(
    (formData: Form) => {
      if (!iframeRef.current?.contentWindow || !isReadyRef.current) {
        return
      }

      const message: FormUpdateMessage = {
        type: "FORMCRAFT_FORM_UPDATE",
        payload: formData,
      }

      try {
        const targetOrigin = new URL(getPreviewUrl()).origin
        iframeRef.current.contentWindow.postMessage(message, targetOrigin)
      } catch (error) {
        console.error("Failed to send form update:", error)
        setPreviewState({
          type: "error",
          error: {
            message: "Failed to send form update",
            code: "COMMUNICATION_ERROR",
            recoverable: true,
          },
        })
      }
    },
    [getPreviewUrl]
  )

  // Function to send form mode updates
  const sendFormModeUpdate = useCallback(
    (mode: "chat" | "typeform") => {
      if (!iframeRef.current?.contentWindow || !isReadyRef.current) {
        return
      }

      const message: FormModeUpdateMessage = {
        type: "FORMCRAFT_MODE_UPDATE",
        payload: {
          formMode: mode,
          timestamp: Date.now(),
        },
      }

      try {
        const targetOrigin = new URL(getPreviewUrl()).origin
        iframeRef.current.contentWindow.postMessage(message, targetOrigin)
      } catch (error) {
        console.error("Failed to send form mode update:", error)
        setPreviewState({
          type: "error",
          error: {
            message: "Failed to send form mode update",
            code: "COMMUNICATION_ERROR",
            recoverable: true,
          },
        })
      }
    },
    [getPreviewUrl]
  )

  // Function to send shadcn CSS updates
  const sendShadcnCSSUpdate = useCallback(
    (cssText: string) => {
      if (!iframeRef.current?.contentWindow || !isReadyRef.current) {
        return
      }

      const message: ShadcnCSSUpdateMessage = {
        type: "FORMCRAFT_SHADCN_CSS_UPDATE",
        payload: {
          cssText,
          timestamp: Date.now(),
        },
      }

      try {
        const targetOrigin = new URL(getPreviewUrl()).origin
        iframeRef.current.contentWindow.postMessage(message, targetOrigin)
      } catch (error) {
        console.error("Failed to send shadcn CSS update:", error)
        setPreviewState({
          type: "error",
          error: {
            message: "Failed to send shadcn CSS update",
            code: "COMMUNICATION_ERROR",
            recoverable: true,
          },
        })
      }
    },
    [getPreviewUrl]
  )

  // Handle messages from the iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Validate origin
      const expectedOrigin = new URL(getPreviewUrl()).origin

      if (event.origin !== expectedOrigin) {
        console.warn("Received message from untrusted origin:", event.origin)
        return
      }

      const message = event.data as
        | PreviewReadyMessage
        | ShadcnCSSAppliedMessage

      if (message.type === "FORMFILLER_PREVIEW_READY") {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        isReadyRef.current = true
        setPreviewState({ type: "ready" })

        // Send initial form data and mode
        sendFormUpdate(form)
        sendFormModeUpdate(formMode)
      } else if (message.type === "FORMFILLER_SHADCN_CSS_APPLIED") {
        // Handle shadcn CSS application feedback
        if (onShadcnApplied) {
          onShadcnApplied({
            success: message.payload.success,
            error: message.payload.error,
            appliedRootVariables: message.payload.appliedRootVariables,
            appliedDarkVariables: message.payload.appliedDarkVariables,
            warnings: message.payload.warnings,
          })
        }
      }
    },
    [
      getPreviewUrl,
      sendFormUpdate,
      sendFormModeUpdate,
      form,
      formMode,
      onShadcnApplied,
    ]
  )

  // Initialize preview
  const initializePreview = useCallback(() => {
    setPreviewState({ type: "loading" })
    isReadyRef.current = false

    // Set up timeout for preview initialization
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (!isReadyRef.current) {
        console.error("Preview initialization timed out. URL:", getPreviewUrl())
        setPreviewState({
          type: "timeout",
          error: {
            message: "Preview failed to initialize within 10 seconds",
            code: "TIMEOUT_ERROR",
            recoverable: true,
          },
        })
      }
    }, 10000)

    // Add message listener
    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [handleMessage])

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    // The iframe has loaded, but we still need to wait for the FORMFILLER_PREVIEW_READY message
    // The timeout and message handling will take care of the rest
  }, [])

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.error("Iframe failed to load")
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setPreviewState({
      type: "error",
      error: {
        message: "Failed to load preview iframe",
        code: "IFRAME_LOAD_ERROR",
        recoverable: true,
      },
    })
  }, [])

  // Retry functionality
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
    initializePreview()
  }, [initializePreview])

  // Initialize on mount and retries only - not on form changes
  useEffect(() => {
    const cleanup = initializePreview()
    return cleanup
  }, [retryCount]) // Removed initializePreview dependency to prevent re-init on form updates

  // Send form updates when form changes (only if preview is ready)
  useEffect(() => {
    if (isReadyRef.current) {
      sendFormUpdate(form)
    }
  }, [form, sendFormUpdate])

  // Send form mode updates when mode changes (only if preview is ready)
  useEffect(() => {
    if (isReadyRef.current) {
      sendFormModeUpdate(formMode)
    }
  }, [formMode, sendFormModeUpdate])

  // Send shadcn CSS updates when shadcnCSSData changes (only if preview is ready)
  useEffect(() => {
    if (isReadyRef.current && shadcnCSSData) {
      sendShadcnCSSUpdate(shadcnCSSData.cssText)
    }
  }, [shadcnCSSData?.version, shadcnCSSData?.cssText, sendShadcnCSSUpdate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Render error state (only for non-recoverable errors)
  if (previewState.type === "error" || previewState.type === "timeout") {
    const error = previewState.error!
    return (
      <div
        className={`bg-muted flex h-full items-center justify-center rounded-xl border ${className}`}
      >
        <div className="max-w-md space-y-4 text-center">
          <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="text-destructive h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-foreground text-lg font-semibold">
              Preview Error
            </h3>
            <p className="text-muted-foreground text-sm">{error.message}</p>
            {error.code && (
              <p className="text-muted-foreground text-xs">
                Error Code: {error.code}
              </p>
            )}
          </div>
          {error.recoverable && (
            <button
              onClick={handleRetry}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // Always render iframe, with loading overlay when needed
  return (
    <div
      className={`bg-muted flex h-full items-center justify-center rounded-xl border ${className} relative`}
    >
      {/* Loading overlay */}
      {previewState.type === "loading" && (
        <div className="bg-muted/80 absolute inset-0 z-10 flex items-center justify-center rounded-xl">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            <div className="text-center">
              <p className="text-foreground text-sm font-medium">
                Loading preview...
              </p>
              <p className="text-muted-foreground text-xs">
                Initializing form preview
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Iframe - always present */}
      <div className="flex h-full w-full items-center justify-center">
        <iframe
          ref={iframeRef}
          src={getPreviewUrl()}
          title="Form Preview"
          className="bg-background h-full w-full rounded-xl border"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    </div>
  )
}
