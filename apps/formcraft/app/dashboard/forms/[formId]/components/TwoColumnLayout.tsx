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
    <div className="bg-muted/20 flex h-full gap-1 p-1">
      {/* Left Panel - Chat/Design Card */}
      <div
        className={`bg-card border-border rounded-lg border shadow-sm transition-all duration-300 ease-in-out ${panelState === "hidden" ? "hidden" : ""} ${isResizing ? "transition-none" : ""} `}
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
        <div className="group relative flex w-2 cursor-col-resize items-center justify-center">
          <div
            className={`bg-border group-hover:bg-primary h-full w-0.5 opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100 ${isResizing ? "bg-primary opacity-100 shadow-lg" : ""} `}
            onMouseDown={(e) => {
              e.preventDefault()
              onResizeStart()

              const startX = e.clientX
              const startWidth = actualLeftWidth

              const handleMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - startX
                const newWidth = Math.max(
                  300,
                  Math.min(600, startWidth + deltaX)
                )
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
        </div>
      )}

      {/* Right Panel - Preview Card */}
      <div className="bg-card border-border flex-1 overflow-hidden rounded-lg border shadow-sm">
        {rightPanel}
      </div>
    </div>
  )
}
