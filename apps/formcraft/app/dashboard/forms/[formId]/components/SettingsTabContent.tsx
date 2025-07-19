"use client"

import { useFormStore } from "../stores/useFormStore"
import Integrations from "./settings/Integrations"

interface SettingsTabContentProps {
  formId: string
}

export default function SettingsTabContent({
  formId,
}: SettingsTabContentProps) {
  const formFromStore = useFormStore((state) => state.form)

  if (!formFromStore) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">
          No form selected. Please create or select a form first.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-6">
        <Integrations userId="user" />
      </div>
    </div>
  )
}
