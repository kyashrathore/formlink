"use client"

import { cn } from "@formlink/ui/lib/utils"
import { ReactNode, useEffect, useRef } from "react"

export type DeviceMode = "mobile" | "tablet" | "desktop" | "full"

interface DevicePreviewFrameProps {
  children: ReactNode
  deviceMode: DeviceMode
  className?: string
}

const deviceDimensions = {
  mobile: { width: 375, height: 812, label: "Mobile (375×812)" },
  tablet: { width: 768, height: 1024, label: "Tablet (768×1024)" },
  desktop: { width: 1200, height: 800, label: "Desktop (1200×800)" },
  full: { width: "100%", height: "100%", label: "Fullscreen" },
} as const

export default function DevicePreviewFrame({
  children,
  deviceMode,
  onDeviceModeChange,
  className = "",
}: DevicePreviewFrameProps & {
  onDeviceModeChange?: (mode: DeviceMode) => void
}) {
  const dimensions = deviceDimensions[deviceMode]
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && deviceMode === "full") {
        // User exited fullscreen via Esc or browser UI -> sync state
        onDeviceModeChange?.("desktop")
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    if (deviceMode === "full") {
      // Enter fullscreen
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`)
          // Fallback or revert state if failed
          onDeviceModeChange?.("desktop")
        })
      }
    } else {
      // Exit fullscreen if active and mode changed externally to non-full
      if (
        document.fullscreenElement &&
        document.fullscreenElement === container
      ) {
        document.exitFullscreen().catch((err) => {
          console.error(`Error attempting to exit fullscreen: ${err.message}`)
        })
      }
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [deviceMode, onDeviceModeChange])

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-background flex h-full w-full flex-col items-center justify-center", // Ensure bg-background for fullscreen visibility
        className
      )}
    >
      {/* Label removed, now in Header */}

      <div className="relative flex h-full w-full items-center justify-center">
        <div
          className={cn(
            "bg-background relative overflow-hidden transition-all duration-300 ease-in-out",
            deviceMode !== "full" &&
              deviceMode !== "desktop" &&
              "rounded-xl border shadow-lg"
          )}
          style={{
            width:
              deviceMode === "desktop" || deviceMode === "full"
                ? "100%"
                : dimensions.width,
            height:
              deviceMode === "desktop" || deviceMode === "full"
                ? "100%"
                : dimensions.height,
            maxWidth:
              deviceMode === "desktop" || deviceMode === "full"
                ? "100%"
                : "calc(100vw - 4rem)",
            maxHeight:
              deviceMode === "desktop" || deviceMode === "full"
                ? "100%"
                : "calc(100vh - 12rem)",
          }}
        >
          <div className="h-full w-full overflow-auto">{children}</div>

          {deviceMode !== "full" && deviceMode !== "desktop" && (
            <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-black/5 dark:border-white/10" />
          )}
        </div>
      </div>
    </div>
  )
}

export { deviceDimensions }
