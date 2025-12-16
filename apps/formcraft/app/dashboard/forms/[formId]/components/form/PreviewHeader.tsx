"use client"

import { cn } from "@formlink/ui/lib/utils"
import { deviceDimensions, DeviceMode } from "./DevicePreviewFrame"
import FormModeControls, { FormMode } from "./FormModeControls"
import PreviewControls from "./PreviewControls"

interface PreviewHeaderProps {
  formMode?: FormMode
  onFormModeChange?: (mode: FormMode) => void
  deviceMode: DeviceMode
  onDeviceModeChange: (mode: DeviceMode) => void
  className?: string
}

export default function PreviewHeader({
  formMode,
  onFormModeChange,
  deviceMode,
  onDeviceModeChange,
  className,
}: PreviewHeaderProps) {
  const dimensions = deviceDimensions[deviceMode]

  return (
    <div
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/60 flex h-10 items-center justify-between border-b px-4 backdrop-blur",
        className
      )}
    >
      {/* Left: Form Mode Switcher */}
      <div className="flex w-[200px] justify-start">
        {formMode && onFormModeChange && (
          <FormModeControls
            formMode={formMode}
            onFormModeChange={onFormModeChange}
            size="sm"
          />
        )}
      </div>

      {/* Center: Dimensions Label */}
      <div className="flex justify-center">
        <div className="bg-muted text-muted-foreground flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
          {dimensions.label}
        </div>
      </div>

      {/* Right: Device Toggler */}
      <div className="flex w-[200px] justify-end">
        <PreviewControls
          deviceMode={deviceMode}
          onDeviceModeChange={onDeviceModeChange}
          size="sm"
        />
      </div>
    </div>
  )
}
