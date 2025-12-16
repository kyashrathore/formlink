"use client"

import { useState } from "react"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import ChatTabContent from "../ChatTabContent"
import DesignTabContent from "../DesignTabContent"
import PreviewTabContent from "../PreviewTabContent"
import { PublishMode } from "../publish/PublishTab"
import ResponsesTabContent from "../ResponsesTabContent"
import SettingsTabContent from "../SettingsTabContent"
import RealEmbedPreview from "../share/RealEmbedPreview"
import PublishCard from "./PublishCard"
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
  const { form } = useFormEditorStore()

  // Left Panel is ALWAYS Chat in the base layer
  const leftPanel = (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatTabContent
          formId={formId}
          userId={userId}
          initialModel={initialModel}
        />
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
    <div className="relative flex h-full w-full flex-col">
      {isEmbedPreview ? (
        <div className="animate-in fade-in zoom-in-95 h-full w-full p-4 duration-200">
          <RealEmbedPreview shortId={form?.short_id || formId} />
        </div>
      ) : isResponses ? (
        <div className="animate-in fade-in zoom-in-95 bg-background h-full w-full duration-200">
          <ResponsesTabContent />
        </div>
      ) : isSettings ? (
        <div className="animate-in fade-in zoom-in-95 bg-background h-full w-full duration-200">
          <SettingsTabContent formId={formId} />
        </div>
      ) : (
        <PreviewTabContent
          formId={formId}
          shadcnCSSData={shadcnCSSData}
          onShadcnApplied={onShadcnApplied}
        />
      )}

      {/* Publish Overlay (Right Side) is GONE now, moved to left. */}
    </div>
  )

  return (
    <WorkbenchLayout
      rail={
        <WorkbenchRail activeTool={activeTool} onToolSelect={setActiveTool} />
      }
      leftPanel={leftPanel}
      rightPanel={rightPanel}
    />
  )
}
