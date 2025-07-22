"use client"

import { cn } from "@formlink/ui/lib/utils"
import { ReactNode } from "react"

export type DeviceMode = "mobile" | "tablet" | "desktop"

interface DevicePreviewFrameProps {
  children: ReactNode
  deviceMode: DeviceMode
  className?: string
}

const deviceDimensions = {
  mobile: { width: 375, height: 812, label: "Mobile (375×812)" },
  tablet: { width: 768, height: 1024, label: "Tablet (768×1024)" },
  desktop: { width: 1200, height: 800, label: "Desktop (1200×800)" },
} as const

export default function DevicePreviewFrame({
  children,
  deviceMode,
  className = "",
}: DevicePreviewFrameProps) {
  const dimensions = deviceDimensions[deviceMode]

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center",
        className
      )}
    >
      <div className="mb-3 flex items-center space-x-2">
        <div className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
          {dimensions.label}
        </div>
      </div>

      <div className="relative flex h-full w-full items-center justify-center">
        <div
          className="bg-background relative overflow-hidden rounded-xl border shadow-lg transition-all duration-300 ease-in-out"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            maxWidth: "calc(100vw - 4rem)",
            maxHeight: "calc(100vh - 12rem)",
          }}
        >
          <div className="h-full w-full overflow-auto">{children}</div>

          <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-black/5 dark:border-white/10" />
        </div>
      </div>
    </div>
  )
}

export { deviceDimensions }
