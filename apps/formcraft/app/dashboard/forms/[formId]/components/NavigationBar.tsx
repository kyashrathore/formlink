"use client"

import { useMutation } from "@tanstack/react-query"
import { Check, Loader2, X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { usePanelState } from "../hooks/usePanelState"
import { selectIsDirty, useFormEditorStore } from "../stores/useFormEditorStore"
import { useFormGenerationStore } from "../stores/useFormGenerationStore"
import { useResponseViewsStore } from "../stores/useResponseViewsStore"

type ButtonState = "normal" | "loading" | "success" | "error"

const CODEGEN_PREVIEW = process.env.NEXT_PUBLIC_CODEGEN_PREVIEW_UI === "true"

interface NavigationBarProps {
  formId: string
  onSaveForm?: () => void
  onPublishForm?: () => void
}

export default function NavigationBar({
  formId,
  onSaveForm,
  onPublishForm,
}: NavigationBarProps) {
  const { activeMainTab, setActiveMainTab } = usePanelState()
  const [saveState, setSaveState] = useState<ButtonState>("normal")
  const [lastSaveWasAuto, setLastSaveWasAuto] = useState<boolean>(false)
  const [publishState, setPublishState] = useState<ButtonState>("normal")

  const formFromStore = useFormEditorStore((state) => state.form)
  const isDirty = useFormEditorStore(selectIsDirty)
  const updateSnapshot = useFormEditorStore((state) => state.updateSnapshot)
  const hasShortId = Boolean(formFromStore?.short_id)
  const isFormGenerating = useFormGenerationStore(
    (state) => state.isFormGenerating
  )
  const hasBlockingUnsavedPlan = useResponseViewsStore((s) => {
    const id = s.activeViewIdMap[formId] || "default"
    const view = s.views.find((v) => v.id === id && v.formId === formId)
    return Boolean(view && view.plan && !view.saved)
  })

  function guardNav(target: Parameters<typeof setActiveMainTab>[0]) {
    if (hasBlockingUnsavedPlan && target !== "responses") {
      toast.warning("Save response plan first", {
        description: "Save or dismiss the Response Plan to leave Responses.",
      })
      return
    }
    setActiveMainTab(target)
  }

  const updateFormMutation = useMutation({
    mutationFn: async (updates: unknown) => {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Failed to update form")
      }
      return data
    },
    onSuccess: () => {
      updateSnapshot()
      setSaveState("success")
      onSaveForm?.()
      setTimeout(() => setSaveState("normal"), 2000)
    },
    onError: (error: Error) => {
      setSaveState("error")
      setTimeout(() => setSaveState("normal"), 2000)
      toast.error("Failed to update form", { description: error.message })
    },
  })

  const publishFormMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/forms/${formId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish form")
      }
      return data
    },
    onSuccess: () => {
      setPublishState("success")
      onPublishForm?.()
      setTimeout(() => setPublishState("normal"), 2000)
      toast.success("Form published successfully!", {
        description: "Your form is now live.",
      })
    },
    onError: (error: Error) => {
      setPublishState("error")
      setTimeout(() => setPublishState("normal"), 2000)
      toast.error("Failed to publish form", { description: error.message })
    },
  })

  const handleSave = async () => {
    setSaveState("loading")
    setLastSaveWasAuto(false)
    if (formFromStore) {
      updateFormMutation.mutate(formFromStore)
    } else {
      setSaveState("error")
      setTimeout(() => setSaveState("normal"), 2000)
    }
  }

  const handlePublish = async () => {
    setPublishState("loading")
    publishFormMutation.mutate()
  }

  // Autosave: save dirty form every 8s and on window blur/visibility change (disabled during form generation)
  const lastAutosaveRef = useRef<number>(0)
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      if (
        isDirty &&
        !updateFormMutation.isPending &&
        !isFormGenerating &&
        formFromStore &&
        now - lastAutosaveRef.current > 4000 // min 4s between saves
      ) {
        lastAutosaveRef.current = now
        setLastSaveWasAuto(true)
        updateFormMutation.mutate(formFromStore)
      }
    }
    const i = window.setInterval(tick, 8000)
    const onBlur = () => tick()
    const onVisibilityChange = () => {
      if (document.hidden) tick()
    }
    window.addEventListener("blur", onBlur)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.clearInterval(i)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [isDirty, updateFormMutation.isPending, isFormGenerating, formFromStore])

  const getButtonContent = (
    state: ButtonState,
    normalContent: ReactNode,
    loadingText: string
  ) => {
    switch (state) {
      case "loading":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText}
          </>
        )
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            Success
          </>
        )
      case "error":
        return (
          <>
            <X className="h-4 w-4" />
            Error
          </>
        )
      default:
        return normalContent
    }
  }

  const getButtonStyles = (state: ButtonState, baseStyles: string) => {
    switch (state) {
      case "loading":
        return `${baseStyles} opacity-75 cursor-not-allowed`
      case "success":
        // Subtle themed feedback using ring tokens; no custom greens
        return `${baseStyles} ring-2 ring-ring/40`
      case "error":
        // Use destructive ring from theme instead of custom reds
        return `${baseStyles} ring-2 ring-destructive/40`
      default:
        return baseStyles
    }
  }

  return (
    <div className="bg-card border-border flex items-center justify-between rounded-t-lg border-b px-4 py-2">
      <div className="flex space-x-1">
        <button
          onClick={() => guardNav("form")}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMainTab === "form"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>{CODEGEN_PREVIEW ? "Preview" : "Form"}</span>
        </button>

        {!CODEGEN_PREVIEW && (
          <button
            onClick={() => guardNav("preview")}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeMainTab === "preview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            } `}
          >
            <span>Preview</span>
          </button>
        )}

        <button
          onClick={() => setActiveMainTab("responses")}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMainTab === "responses"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>Responses</span>
        </button>

        <button
          onClick={() => hasShortId && guardNav("share")}
          disabled={!hasShortId}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !hasShortId
              ? "text-muted-foreground/50 cursor-not-allowed"
              : activeMainTab === "share"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>Share</span>
        </button>

        <button
          onClick={() => guardNav("settings")}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMainTab === "settings"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>Settings</span>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {!isDirty && !updateFormMutation.isPending ? (
          <div
            className="text-muted-foreground bg-background border-border flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
            aria-live="polite"
            title={lastSaveWasAuto ? "Autosaved" : "Saved"}
          >
            <Check className="h-4 w-4" />
            {lastSaveWasAuto ? "Autosaved" : "Saved"}
          </div>
        ) : (
          <button
            onClick={handleSave}
            disabled={
              saveState === "loading" ||
              updateFormMutation.isPending ||
              !formFromStore
            }
            className={getButtonStyles(
              saveState,
              "text-muted-foreground bg-background border-border hover:bg-accent flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
            )}
          >
            {getButtonContent(
              saveState,
              <>
                {updateFormMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>Save Form</>
                )}
                {isDirty && !updateFormMutation.isPending && (
                  <span
                    className="ml-1 inline-block h-2 w-2 rounded-full bg-blue-500"
                    title="You have unsaved changes"
                  ></span>
                )}
              </>,
              "Saving..."
            )}
          </button>
        )}

        <button
          onClick={handlePublish}
          disabled={publishState === "loading" || publishFormMutation.isPending}
          className={getButtonStyles(
            publishState,
            "text-primary-foreground bg-primary border-primary hover:bg-primary/90 flex items-center space-x-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
          )}
        >
          {getButtonContent(
            publishState,
            <>
              {publishFormMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
                </>
              ) : (
                <>Publish Form</>
              )}
            </>,
            "Publishing..."
          )}
        </button>
      </div>
    </div>
  )
}
