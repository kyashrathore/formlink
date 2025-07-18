"use client"

import { UpgradePrompt } from "@/app/components/subscription"
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
        <div>
          <h2 className="mb-2 text-lg font-semibold">Form Settings</h2>
          <p className="text-muted-foreground text-sm">
            Configure integrations and advanced settings for your form.
          </p>
        </div>

        <UpgradePrompt
          feature="Remove FormLink Branding"
          description="Remove 'Powered by FormLink' from your forms and get advanced analytics"
          dismissible
        />

        <Integrations userId="user" />
      </div>
    </div>
  )
}
