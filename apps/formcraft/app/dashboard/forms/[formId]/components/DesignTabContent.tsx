"use client"

import { Palette } from "lucide-react"

export default function DesignTabContent() {
  return (
    <div className="bg-card h-full">
      {/* Test Header */}
      <div className="bg-muted/30 border-border border-b p-3">
        <div className="flex items-center space-x-2">
          <Palette className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm font-medium">
            Design Tab Test
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="space-y-3 text-center">
          <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <Palette className="text-primary h-6 w-6" />
          </div>
          <h3 className="text-foreground text-lg font-medium">
            Design Content
          </h3>
          <p className="text-muted-foreground max-w-xs text-sm">
            This is a barebone test component for the Design tab. The state
            machine logic is being validated.
          </p>
        </div>
      </div>

      {/* Simple Controls */}
      <div className="border-border border-t p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Primary Color</span>
            <input
              type="color"
              defaultValue="#3B82F6"
              className="border-border h-8 w-8 cursor-pointer rounded border"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm">Font Size</span>
            <select className="border-border bg-background rounded border px-2 py-1 text-sm">
              <option>Small</option>
              <option>Medium</option>
              <option>Large</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
