"use client"

import { toast } from "@formlink/ui"
import { useMutation } from "@tanstack/react-query"
import { Check, Loader2, X } from "lucide-react"
import { useState } from "react"
import { usePanelState } from "../hooks/usePanelState"
import { selectIsDirty, useFormStore } from "../stores/useFormStore"

type ButtonState = "normal" | "loading" | "success" | "error"

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
  const [publishState, setPublishState] = useState<ButtonState>("normal")

  const formFromStore = useFormStore((state) => state.form)
  const isDirty = useFormStore(selectIsDirty)
  const updateSnapshot = useFormStore((state) => state.updateSnapshot)

  const updateFormMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const data = (await res.json()) as any
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
      console.error("Failed to update form:", error.message)
      setSaveState("error")
      setTimeout(() => setSaveState("normal"), 2000)
      toast({
        title: "Failed to update form",
        description: error.message,
        status: "error",
      })
    },
  })

  const publishFormMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/forms/${formId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = (await res.json()) as any
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish form")
      }
      return data
    },
    onSuccess: () => {
      setPublishState("success")
      onPublishForm?.()
      setTimeout(() => setPublishState("normal"), 2000)
      toast({
        title: "Form published successfully!",
        description: "Your form is now live.",
      })
    },
    onError: (error: Error) => {
      setPublishState("error")
      setTimeout(() => setPublishState("normal"), 2000)
      toast({
        title: "Failed to publish form",
        description: error.message,
        status: "error",
      })
    },
  })

  const handleSave = async () => {
    setSaveState("loading")
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

  const getButtonContent = (
    state: ButtonState,
    normalContent: React.ReactNode,
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
        return `${baseStyles} bg-green-500 hover:bg-green-600 border-green-500`
      case "error":
        return `${baseStyles} bg-red-500 hover:bg-red-600 border-red-500`
      default:
        return baseStyles
    }
  }

  return (
    <div className="bg-card border-border flex items-center justify-between rounded-t-lg border-b px-4 py-2">
      {/* Left side - Navigation */}
      <div className="flex space-x-1">
        <button
          onClick={() => setActiveMainTab("form")}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMainTab === "form"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>Form</span>
        </button>

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
          onClick={() => setActiveMainTab("share")}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMainTab === "share"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>Share</span>
        </button>

        <button
          onClick={() => setActiveMainTab("settings")}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMainTab === "settings"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          } `}
        >
          <span>Settings</span>
        </button>
      </div>

      {/* Right side - Completion Actions */}
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          disabled={
            saveState === "loading" ||
            updateFormMutation.isPending ||
            !formFromStore
          }
          className={getButtonStyles(
            saveState,
            "text-muted-foreground bg-background border-border hover:bg-accent flex items-center space-x-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
          )}
        >
          {getButtonContent(
            saveState,
            <>
              {updateFormMutation.isPending ? "Saving..." : "Save Form"}
              {isDirty && !updateFormMutation.isPending && (
                <span
                  className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500"
                  title="You have unsaved changes"
                ></span>
              )}
            </>,
            "Saving..."
          )}
        </button>

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
              {publishFormMutation.isPending ? "Publishing..." : "Publish Form"}
            </>,
            "Publishing..."
          )}
        </button>
      </div>
    </div>
  )
}
