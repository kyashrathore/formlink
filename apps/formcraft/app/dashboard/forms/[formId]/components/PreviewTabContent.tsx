"use client"

import { formatDistanceToNow } from "date-fns"
import { useMemo, useState } from "react"
import { useFormEditorStore } from "../stores/useFormEditorStore"
import type { FormWithVersionIds } from "../stores/useFormEditorStore"
import { useFormGenerationStore } from "../stores/useFormGenerationStore"
import { DeviceMode } from "./form/DevicePreviewFrame"
import { FormMode } from "./form/FormModeControls"
import FormPreviewWithDevices from "./form/FormPreviewWithDevices"
import { MetadataShimmer, QuestionsShimmer } from "./form/shimmers/FormShimmers"

const CODEGEN_PREVIEW =
  process.env.NEXT_PUBLIC_CODEGEN_PREVIEW_UI === "true" ||
  process.env.CODEGEN_PREVIEW_UI === "true"

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
  const baseForm = currentForm ?? initialForm
  const form = baseForm as FormWithVersionIds | null
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

  if (CODEGEN_PREVIEW) {
    const previewUrl = form?.live_url || form?.preview_url
    const branchName = form?.branch_name || "(pending)"
    const deployedAt = form?.last_deployed_at
    const isPublished = Boolean(form?.live_url)

    return (
      <div className="bg-background flex h-full flex-col overflow-hidden">
        <div className="bg-muted/50 border-border flex items-center justify-between border-b px-4 py-2">
          <div>
            <div className="text-sm font-medium">
              {isPublished ? "Live deployment" : "Sandbox preview"}
            </div>
            <div className="text-muted-foreground text-xs">
              Branch: {branchName}
              {deployedAt && (
                <>
                  {" "}
                  • Deployed{" "}
                  {formatDistanceToNow(new Date(deployedAt), {
                    addSuffix: true,
                  })}
                </>
              )}
            </div>
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Open in new tab
            </a>
          )}
        </div>
        <div className="bg-muted flex-1">
          {previewUrl ? (
            <iframe
              title="Form preview"
              src={previewUrl}
              className="h-full w-full border-0 bg-white"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center text-center">
              <div className="mb-2 text-lg font-medium">
                Preview not available yet
              </div>
              <div className="max-w-md text-sm">
                Run the generate code tool to build a sandbox preview. Once
                published, this tab will display the live deployment.
              </div>
            </div>
          )}
        </div>
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
