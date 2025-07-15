"use client"

import { ReactNode } from "react"

interface TwoColumnLayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
  leftPanelWidth: number
  isResizing: boolean
  onResizeStart: () => void
  onResize: (width: number) => void
  onResizeEnd: () => void
  panelState: "expanded" | "collapsed" | "hidden"
}

export default function TwoColumnLayout({
  leftPanel,
  rightPanel,
  leftPanelWidth,
  isResizing,
  onResizeStart,
  onResize,
  onResizeEnd,
  panelState,
}: TwoColumnLayoutProps) {
  const getLeftPanelWidth = () => {
    switch (panelState) {
      case "hidden":
        return 0
      case "collapsed":
        return 40
      case "expanded":
        return leftPanelWidth
      default:
        return leftPanelWidth
    }
  }

  const actualLeftWidth = getLeftPanelWidth()

  return (
    <div className="bg-background flex h-screen">
      {/* Left Panel - Dense Control Center */}
      <div
        className={`bg-card border-border border-r transition-all duration-300 ease-in-out ${panelState === "hidden" ? "hidden" : ""} ${isResizing ? "transition-none" : ""} `}
        style={{
          width: `${actualLeftWidth}px`,
          minWidth: panelState === "collapsed" ? "40px" : "300px",
          maxWidth: panelState === "collapsed" ? "40px" : "600px",
        }}
      >
        {leftPanel}
      </div>

      {/* Resize Handle */}
      {panelState !== "hidden" && (
        <div
          className={`bg-border hover:bg-primary w-1 cursor-col-resize transition-all duration-200 ease-in-out ${isResizing ? "bg-primary w-2 shadow-lg" : ""} `}
          onMouseDown={(e) => {
            e.preventDefault()
            onResizeStart()

            const startX = e.clientX
            const startWidth = actualLeftWidth

            const handleMouseMove = (e: MouseEvent) => {
              const deltaX = e.clientX - startX
              const newWidth = Math.max(300, Math.min(600, startWidth + deltaX))
              onResize(newWidth)
            }

            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove)
              document.removeEventListener("mouseup", handleMouseUp)
              onResizeEnd()
            }

            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
          }}
        />
      )}

      {/* Right Panel - Spacious Preview Canvas */}
      <div className="bg-background flex-1 overflow-hidden">{rightPanel}</div>
    </div>
  )
}
