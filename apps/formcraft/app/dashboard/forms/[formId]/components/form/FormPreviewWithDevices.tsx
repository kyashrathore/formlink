"use client"

import { Form } from "@formlink/schema"
import { useState } from "react"
import DevicePreviewFrame, { DeviceMode } from "./DevicePreviewFrame"
import FormModeControls, { FormMode } from "./FormModeControls"
import FormPreview from "./FormPreview"
import PreviewControls from "./PreviewControls"

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

  // Use external state if provided, otherwise use internal state
  const deviceMode = externalDeviceMode ?? internalDeviceMode
  const formMode = externalFormMode ?? internalFormMode
  const setDeviceMode = externalOnDeviceModeChange ?? setInternalDeviceMode
  const setFormMode = externalOnFormModeChange ?? setInternalFormMode

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {showControls && (
        <div className="mb-4 flex items-center justify-between">
          {/* Mode switch on left */}
          <FormModeControls
            formMode={formMode}
            onFormModeChange={setFormMode}
          />

          {/* Device controls on right */}
          <PreviewControls
            deviceMode={deviceMode}
            onDeviceModeChange={setDeviceMode}
          />
        </div>
      )}

      <div className="flex-1">
        <DevicePreviewFrame deviceMode={deviceMode}>
          <FormPreview
            form={form}
            className="h-full w-full"
            formMode={formMode}
            onFormModeChange={setFormMode}
            shadcnCSSData={shadcnCSSData}
            onShadcnApplied={onShadcnApplied}
          />
        </DevicePreviewFrame>
      </div>
    </div>
  )
}
