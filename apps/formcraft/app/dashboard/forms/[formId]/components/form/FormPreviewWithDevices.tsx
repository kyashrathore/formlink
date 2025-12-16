"use client"

import { Form } from "@formlink/schema"
import { useState } from "react"
import DevicePreviewFrame, { DeviceMode } from "./DevicePreviewFrame"
import { FormMode } from "./FormModeControls"
import FormPreview from "./FormPreview"
import PreviewHeader from "./PreviewHeader"

interface FormPreviewWithDevicesProps {
  form: Form
  className?: string
  showControls?: boolean
  formMode?: FormMode
  onFormModeChange?: (mode: FormMode) => void
  deviceMode?: DeviceMode
  onDeviceModeChange?: (mode: DeviceMode) => void
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

export default function FormPreviewWithDevices({
  form,
  className = "",
  showControls = true,
  formMode: externalFormMode,
  onFormModeChange: externalOnFormModeChange,
  deviceMode: externalDeviceMode,
  onDeviceModeChange: externalOnDeviceModeChange,
  shadcnCSSData,
  onShadcnApplied,
}: FormPreviewWithDevicesProps) {
  const [internalDeviceMode, setInternalDeviceMode] =
    useState<DeviceMode>("desktop")
  const [internalFormMode, setInternalFormMode] = useState<FormMode>("chat")

  const deviceMode = externalDeviceMode ?? internalDeviceMode
  const formMode = externalFormMode ?? internalFormMode
  const setDeviceMode = externalOnDeviceModeChange ?? setInternalDeviceMode
  const setFormMode = externalOnFormModeChange ?? setInternalFormMode

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {showControls && (
        <PreviewHeader
          formMode={formMode}
          onFormModeChange={setFormMode}
          deviceMode={deviceMode}
          onDeviceModeChange={setDeviceMode}
        />
      )}

      <div className="flex-1">
        <DevicePreviewFrame
          deviceMode={deviceMode}
          onDeviceModeChange={setDeviceMode}
        >
          <FormPreview
            form={form}
            className="h-full w-full"
            formMode={formMode}
            shadcnCSSData={shadcnCSSData}
            onShadcnApplied={onShadcnApplied}
          />
        </DevicePreviewFrame>
      </div>
    </div>
  )
}
