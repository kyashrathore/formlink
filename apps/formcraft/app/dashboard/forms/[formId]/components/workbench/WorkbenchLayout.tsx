"use client"

import { cn } from "@/app/lib/utils"
import { ReactNode } from "react"

interface WorkbenchLayoutProps {
  rail: ReactNode
  leftPanel: ReactNode
  rightPanel: ReactNode
  className?: string
}

export default function WorkbenchLayout({
  rail,
  leftPanel,
  rightPanel,
  className,
}: WorkbenchLayoutProps) {
  return (
    <div
      className={cn(
        "bg-background flex h-full w-full overflow-hidden",
        className
      )}
    >
      {/* 1. Vertical Icon Rail */}
      <div className="border-border bg-background z-20 flex-none border-r">
        {rail}
      </div>

      {/* 2. Main Workbench Area (Split Pane) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Chat / Base Layer */}
        <div className="border-border bg-background relative z-10 flex w-[400px] flex-none flex-col border-r">
          {leftPanel}
        </div>

        {/* Right Pane: Canvas / Preview */}
        <div className="bg-muted/30 relative flex min-w-0 flex-1 flex-col">
          {rightPanel}
        </div>
      </div>
    </div>
  )
}
