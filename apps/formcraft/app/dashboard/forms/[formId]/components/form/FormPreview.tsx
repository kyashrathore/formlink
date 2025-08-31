"use client"

import { getFormFillerPreviewBasePath } from "@/app/lib/config"
import { Form } from "@formlink/schema"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"

interface FormPreviewProps {
  form: Form
  className?: string
  formMode?: "chat" | "typeform" | "classic"
  shadcnCSSData?: {
    cssText: string
    version: number
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
    formMode: "chat" | "typeform" | "classic"
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

export default function FormPreview({
  form,
  className = "",
  formMode = "chat",
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

  const stableFormId = useMemo(() => {
    return form.short_id || form.id
  }, [form.short_id, form.id])

  const stablePreviewUrl = useMemo(() => {
    const previewBasePath = getFormFillerPreviewBasePath()
    const finalUrl = `${previewBasePath}/${stableFormId}`
    return finalUrl
  }, [stableFormId])

  // Build an effective form that includes incrementally generated questions/journey while the agent runs.
  const {
    generatedQuestions,
    currentForm: genCurrentForm,
    loadingPhase,
    agentState,
  } = useFormGenerationStore()

  const effectiveForm: Form = useMemo(() => {
    // Prefer generated questions (filtering out nulls) if present; otherwise use original form.questions
    const generated = Array.isArray(generatedQuestions)
      ? (generatedQuestions.filter(Boolean) as Form["questions"])
      : undefined

    const questions =
      generated && generated.length > 0 ? generated : (form.questions as any)

    // Prefer journeyScript from generation snapshot if available
    const journeyScript =
      genCurrentForm?.settings?.journeyScript ?? form.settings?.journeyScript

    return {
      ...form,
      questions: questions as any,
      settings: {
        ...(form.settings as any),
        ...(journeyScript ? { journeyScript } : {}),
      } as any,
    }
  }, [form, generatedQuestions, genCurrentForm])

  // Gate chat preview only during active form generation
  // Don't gate if the form already exists or we're just switching modes
  const gateChatPreview = useMemo(
    () =>
      formMode === "chat" &&
      loadingPhase !== "complete" && // Still loading
      (agentState as any)?.status === "IN_PROGRESS", // Agent is actively working
    [formMode, loadingPhase, agentState]
  )

  const getPreviewUrl = useCallback(() => stablePreviewUrl, [stablePreviewUrl])

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

  const sendFormModeUpdate = useCallback(
    (mode: "chat" | "typeform" | "classic") => {
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

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const expectedOrigin = new URL(getPreviewUrl()).origin

      if (event.origin !== expectedOrigin) {
        console.warn(
          "FormCraft: Received message from untrusted origin:",
          event.origin,
          "expected:",
          expectedOrigin
        )
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

        sendFormUpdate(effectiveForm)
        sendFormModeUpdate(formMode)
      } else if (message.type === "FORMFILLER_SHADCN_CSS_APPLIED") {
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

  const initializePreview = useCallback(() => {
    setPreviewState({ type: "loading" })
    isReadyRef.current = false

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

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [handleMessage])

  const handleIframeLoad = useCallback(() => {}, [])

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

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
    initializePreview()
  }, [initializePreview])

  useEffect(() => {
    const cleanup = initializePreview()
    return cleanup
  }, [retryCount])

  useEffect(() => {
    if (isReadyRef.current && !gateChatPreview) {
      sendFormUpdate(effectiveForm)
    }
  }, [effectiveForm, sendFormUpdate, gateChatPreview])

  useEffect(() => {
    if (isReadyRef.current && !gateChatPreview) {
      sendFormModeUpdate(formMode)
    }
  }, [formMode, sendFormModeUpdate, gateChatPreview])

  useEffect(() => {
    if (isReadyRef.current && shadcnCSSData) {
      sendShadcnCSSUpdate(shadcnCSSData.cssText)
    }
  }, [shadcnCSSData?.version, shadcnCSSData?.cssText, sendShadcnCSSUpdate])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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

  return (
    <div
      className={`bg-muted flex h-full items-center justify-center rounded-xl border ${className} relative`}
    >
      {}
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
      {gateChatPreview && (
        <div className="bg-muted/80 absolute inset-0 z-10 flex items-center justify-center rounded-xl">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <p className="text-foreground text-sm font-medium">
              Finalizing chat preview...
            </p>
            <p className="text-muted-foreground text-xs">
              The agent is completing the form. Preview will appear when ready.
            </p>
          </div>
        </div>
      )}

      {}
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
