"use client"

import { usePanelState } from "../hooks/usePanelState"
import { useFormStore } from "../stores/useFormStore"
import FormTabContent from "./FormTabContent"
import ResponsesTabContent from "./ResponsesTabContent"
import SettingsTabContent from "./SettingsTabContent"
import ShareTabContent from "./ShareTabContent"

interface TabContentManagerProps {
  formId: string
}

export default function TabContentManager({ formId }: TabContentManagerProps) {
  const { activeMainTab } = usePanelState()
  const formFromStore = useFormStore((state) => state.form)

  const renderContent = () => {
    switch (activeMainTab) {
      case "form":
        return <FormTabContent formId={formId} />
      case "responses":
        return <ResponsesTabContent />
      case "share":
        return (
          <ShareTabContent formId={formId} shortId={formFromStore?.short_id} />
        )
      case "settings":
        return <SettingsTabContent formId={formId} />
      default:
        return <FormTabContent formId={formId} />
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
