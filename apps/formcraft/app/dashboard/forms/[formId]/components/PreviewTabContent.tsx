"use client"

import { useMemo, useState } from "react"
import { useFormEditorStore } from "../stores/useFormEditorStore"
import { useFormGenerationStore } from "../stores/useFormGenerationStore"
import { DeviceMode } from "./form/DevicePreviewFrame"
import { FormMode } from "./form/FormModeControls"
import FormPreviewWithDevices from "./form/FormPreviewWithDevices"
import { MetadataShimmer, QuestionsShimmer } from "./form/shimmers/FormShimmers"

interface PreviewTabContentProps {
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

export default function PreviewTabContent({
  shadcnCSSData,
  onShadcnApplied,
}: PreviewTabContentProps) {
  const { form: initialForm, isLoading } = useFormEditorStore()
  const { currentForm, isFormGenerating } = useFormGenerationStore()
  const form = currentForm || initialForm
  const [formMode, setFormMode] = useState<FormMode>("chat")
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")

  const hasFormContent = useMemo(
    () => Boolean(form?.questions && form.questions.length > 0),
    [form?.questions]
  )

  if (isLoading || isFormGenerating) {
    return (
      <div className="bg-background flex h-full flex-col space-y-4 overflow-auto p-4">
        <MetadataShimmer />
        <QuestionsShimmer count={3} />
      </div>
    )
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      <div className="flex-1 p-2">
        {hasFormContent && form?.short_id ? (
          <FormPreviewWithDevices
            form={form}
            className="h-full"
            showControls={true}
            formMode={formMode}
            onFormModeChange={setFormMode}
            deviceMode={deviceMode}
            onDeviceModeChange={setDeviceMode}
            shadcnCSSData={shadcnCSSData}
            onShadcnApplied={onShadcnApplied}
          />
        ) : hasFormContent ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground text-center">
              <div className="mb-2 text-lg font-medium">
                Preview not available
              </div>
              <div className="text-sm">
                Form needs to be saved to enable preview
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground text-center">
              <div className="mb-2 text-lg font-medium">No questions yet</div>
              <div className="text-sm">Add questions to preview the form</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
