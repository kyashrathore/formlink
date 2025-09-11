"use client"

import { usePanelState } from "../hooks/usePanelState"
import { useFormEditorStore } from "../stores/useFormEditorStore"
import FormTabContent from "./FormTabContent"
import PreviewTabContent from "./PreviewTabContent"
import ResponsesTabContent from "./ResponsesTabContent"
import SettingsTabContent from "./SettingsTabContent"
import ShareTabContent from "./ShareTabContent"

interface TabContentManagerProps {
  formId: string
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

export default function TabContentManager({
  formId,
  shadcnCSSData,
  onShadcnApplied,
}: TabContentManagerProps) {
  const { activeMainTab } = usePanelState()
  const shortId = useFormEditorStore((s) => s.form?.short_id)

  const renderContent = () => {
    switch (activeMainTab) {
      case "form":
        return <FormTabContent />
      case "preview":
        return (
          <PreviewTabContent
            formId={formId}
            shadcnCSSData={shadcnCSSData}
            onShadcnApplied={onShadcnApplied}
          />
        )
      case "responses":
        return <ResponsesTabContent />
      case "share":
        return (
          <ShareTabContent
            formId={formId}
            shortId={shortId || undefined}
            shortIdLoading={false}
            shortIdError={null}
          />
        )
      case "settings":
        return <SettingsTabContent formId={formId} />
      default:
        return <FormTabContent />
    }
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="animate-in fade-in-0 h-full transition-all duration-300 ease-in-out">
        <div
          key={activeMainTab}
          className="animate-in fade-in-0 slide-in-from-right-1 h-full duration-300"
        >
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
