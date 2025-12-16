"use client"

import React, { useState } from "react"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import ChatTabContent from "../ChatTabContent"
import DesignTabContent from "../DesignTabContent"
import { FormMode } from "../form/FormModeControls"
import FormTabContent from "../FormTabContent"
import PreviewTabContent from "../PreviewTabContent"
import ResponsesTabContent from "../ResponsesTabContent"
import SettingsTabContent from "../SettingsTabContent"
import RealEmbedPreview from "../share/RealEmbedPreview"
import PublishCard from "./PublishCard"
import { PublishMode } from "./types"
import { WorkbenchProvider } from "./WorkbenchContext"
import WorkbenchLayout from "./WorkbenchLayout"
import WorkbenchRail, { WorkbenchTool } from "./WorkbenchRail"

interface EditorWorkbenchProps {
  formId: string
  userId: string | null
  initialModel?: string
  shadcnCSSData?: any
  onShadcnApplied?: any
  onShadcnCSSApply?: any
  shadcnStatus?: any
}

export default function EditorWorkbench({
  formId,
  userId,
  initialModel,
  shadcnCSSData,
  onShadcnApplied,
  onShadcnCSSApply,
  shadcnStatus,
}: EditorWorkbenchProps) {
  const [activeTool, setActiveTool] = useState<WorkbenchTool>("chat")
  const [publishMode, setPublishMode] = useState<PublishMode>("direct")
  // Lifted state for Embed Preview Mode to sync with Settings Code
  const [embedFormMode, setEmbedFormMode] = useState<FormMode>("chat")
  const { form } = useFormEditorStore()

  // Global listener for Smart Selection (from Preview Iframe)
  // This needs to be at the top level so it works even if Chat tab is closed

  // NOTE: We need to pull `selectionContext` logic up or pass it down.
  // Since `EditorWorkbench` RENDERS `WorkbenchProvider`, we cannot use `useWorkbench` hook here directly to set state.
  // We should lift the state `selectionContext` to `EditorWorkbench` and pass it to Provider.

  const [selectionContext, setSelectionContext] = useState<any | null>(null)

  // Listen for Smart Selection messages from Preview iframe
  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Debug log for ALL messages
      if (event.data?.type === "ELEMENT_CLICKED") {
        console.log("PARENT RECEIVED ELEMENT_CLICKED:", event.data)
        const { tagName, componentName, text, source } =
          event.data.payload || {}
        const name = componentName || tagName || "element"

        // Construct the hidden context string for the Agent
        const contextString = `[CONTEXT: CODE MODE ACTIVE. Target: ${name}${text ? ` ("${text}")` : ""}${source?.file ? ` in ${source.file}` : ""}. Use generate_code/replace_file_content tool to edit this file based on user request.]`

        console.log("Setting context and switching to chat:", name)

        setSelectionContext({
          type: "element",
          tagName,
          componentName,
          text,
          rawPrompt: contextString,
        })
        setActiveTool("chat") // Auto-switch to chat
      } else if (event.data?.type === "TEXT_UPDATE") {
        console.log("PARENT RECEIVED TEXT_UPDATE:", event.data)
        const { source, originalText, newText } = event.data.payload

        if (!source?.file) {
          console.error("Missing source file for text update")
          return
        }

        // Call the Direct Edit API
        try {
          const res = await fetch("/api/codegen/edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: source.file,
              line: source.lineNumber, // Pass line number
              original: originalText,
              replacement: newText,
            }),
          })

          const data = await res.json()
          if (res.ok) {
            console.log("Text update success:", data)
            // Optional: Show success toast in Parent?
          } else {
            console.error("Text update failed:", data)
            // AI Fallback: If direct edit fails (e.g. text is dynamic/imported), ask the Agent to do it.

            const prompt = `I tried to edit text in \`${source.file}\` but the direct patch failed (logic: ${data.error}).
Please change:
"${originalText}"
to
"${newText}"

Review the file and apply the change using AST editing or by finding the variable source.`

            setSelectionContext({
              type: "text_edit_fallback",
              rawPrompt: prompt,
              autoSend: true, // Signal to Chat to send immediately if possible
            })
            setActiveTool("chat")
          }
        } catch (e) {
          console.error("Network error updating text:", e)
          // Network error fallback
          setSelectionContext({
            type: "text_edit_fallback",
            rawPrompt: `I tried to change "${originalText}" to "${newText}" in ${source.file}${source.lineNumber ? `:${source.lineNumber}` : ""} but encountered a network error. Please apply this change manually.`,
            autoSend: true,
          })
          setActiveTool("chat")
        }
      } else {
        // console.log("Parent received other message:", event.data);
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])
  // - "form": FormTabContent
  // - "design" / "publish": overlaid on top of chat (or form?), but previously specific overlays.

  const leftPanel = (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden">
        {activeTool === "form" ? (
          <FormTabContent />
        ) : (
          <ChatTabContent
            formId={formId}
            userId={userId}
            initialModel={initialModel}
          />
        )}
      </div>

      {/* Design Overlay */}
      {activeTool === "design" && (
        <div className="bg-background animate-in slide-in-from-left-full absolute inset-0 z-20 border-r">
          <DesignTabContent
            formId={formId}
            onShadcnCSSApply={onShadcnCSSApply}
            shadcnStatus={shadcnStatus}
          />
        </div>
      )}

      {/* Publish Overlay */}
      {activeTool === "publish" && form && (
        <div className="bg-background animate-in slide-in-from-left-full absolute inset-0 z-20 border-r">
          <PublishCard
            form={form}
            formId={formId}
            shortId={form.short_id || undefined}
            publishMode={publishMode}
            setPublishMode={setPublishMode}
            embedFormMode={embedFormMode}
          />
        </div>
      )}
    </div>
  )

  // Determine Right Panel Content based on context
  // Context: Publish -> Embed Mode = RealEmbedPreview
  // Context: Responses -> ResponsesTabContent
  // Context: Settings -> SettingsTabContent
  // Context: All other times = PreviewTabContent (FormPreviewWithDevices)
  const isEmbedPreview = activeTool === "publish" && publishMode === "embed"
  const isResponses = activeTool === "responses"
  const isSettings = activeTool === "settings"

  const rightPanel = (
    <div
      id="right-panel-root"
      className="relative flex h-full w-full flex-col p-2"
    >
      <div className="bg-background flex-1 overflow-hidden rounded-xl border shadow-sm">
        {isEmbedPreview ? (
          <div className="animate-in fade-in zoom-in-95 h-full w-full duration-200">
            <RealEmbedPreview
              shortId={form?.short_id || formId}
              formMode={embedFormMode}
              setFormMode={setEmbedFormMode}
            />
          </div>
        ) : isResponses ? (
          <div className="animate-in fade-in zoom-in-95 bg-background h-full w-full duration-200">
            <ResponsesTabContent />
          </div>
        ) : isSettings ? (
          <div className="animate-in fade-in zoom-in-95 bg-background h-full w-full duration-200">
            <SettingsTabContent formId={formId} />
          </div>
        ) : useFormEditorStore((s) => s.isCodeMode) ? (
          <div className="h-full w-full bg-white">
            <iframe
              src="http://localhost:5173"
              className="h-full w-full border-none"
              title="Remote Preview"
            />
          </div>
        ) : (
          <PreviewTabContent
            formId={formId}
            shadcnCSSData={shadcnCSSData}
            onShadcnApplied={onShadcnApplied}
          />
        )}
      </div>

      {/* Publish Overlay (Right Side) is GONE now, moved to left. */}
    </div>
  )

  return (
    <WorkbenchProvider
      activeTool={activeTool}
      setActiveTool={setActiveTool}
      // @ts-ignore
      selectionContext={selectionContext}
      setSelectionContext={setSelectionContext}
    >
      <WorkbenchLayout
        rail={
          <WorkbenchRail activeTool={activeTool} onToolSelect={setActiveTool} />
        }
        leftPanel={leftPanel}
        rightPanel={rightPanel}
      />
    </WorkbenchProvider>
  )
}
