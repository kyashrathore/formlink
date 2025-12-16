"use client"

import { ToggleGroup, ToggleGroupItem } from "@formlink/ui"
import { Maximize, Monitor, Smartphone, Tablet } from "lucide-react"
import { DeviceMode } from "./DevicePreviewFrame"

interface PreviewControlsProps {
  deviceMode: DeviceMode
  onDeviceModeChange: (mode: DeviceMode) => void
  className?: string
  size?: "default" | "sm" | "lg"
}

const deviceOptions = [
  {
    mode: "mobile" as const,
    icon: Smartphone,
    label: "Mobile",
    description: "Mobile device preview",
  },
  {
    mode: "tablet" as const,
    icon: Tablet,
    label: "Tablet",
    description: "Tablet device preview",
  },
  {
    mode: "desktop" as const,
    icon: Monitor,
    label: "Desktop",
    description: "Desktop device preview",
  },
  {
    mode: "full" as const,
    icon: Maximize,
    label: "Fullscreen",
    description: "Full-width preview",
  },
]

export default function PreviewControls({
  deviceMode,
  onDeviceModeChange,
  className = "",
  size = "default",
}: PreviewControlsProps) {
  return (
    <ToggleGroup
      type="single"
      size={size}
      value={deviceMode}
      onValueChange={(value) =>
        value && onDeviceModeChange(value as DeviceMode)
      }
      className={`${className}`}
    >
      {deviceOptions.map(({ mode, icon: Icon, description }) => (
        <ToggleGroupItem
          key={mode}
          value={mode}
          aria-label={description}
          title={description}
          className="px-2"
        >
          <Icon className="h-4 w-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export { deviceOptions }
