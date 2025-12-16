"use client"

import { Button } from "@formlink/ui"
import {
  BarChart2,
  FileText,
  MessageSquare,
  Paintbrush,
  Rocket,
  Settings,
} from "lucide-react"

export type WorkbenchTool =
  | "chat"
  | "form"
  | "design"
  | "publish"
  | "responses"
  | "settings"

interface WorkbenchRailProps {
  activeTool: WorkbenchTool
  onToolSelect: (tool: WorkbenchTool) => void
}

export default function WorkbenchRail({
  activeTool,
  onToolSelect,
}: WorkbenchRailProps) {
  return (
    <div className="bg-muted/10 flex h-full w-[80px] flex-col items-center gap-2 border-r px-1 py-2">
      {/* Chat (Base Layer) */}
      <RailButton
        icon={<MessageSquare className="h-5 w-5" />}
        label="Chat"
        active={activeTool === "chat"}
        onClick={() => onToolSelect("chat")}
      />

      {/* Form Editor Tab */}
      <RailButton
        icon={<FileText className="h-5 w-5" />}
        label="Form"
        active={activeTool === "form"}
        onClick={() => onToolSelect("form")}
      />

      {/* Design Overlay */}
      <RailButton
        icon={<Paintbrush className="h-5 w-5" />}
        label="Design"
        active={activeTool === "design"}
        onClick={() => onToolSelect("design")}
      />

      {/* Publish Overlay */}
      <RailButton
        icon={<Rocket className="h-5 w-5" />}
        label="Publish"
        active={activeTool === "publish"}
        onClick={() => onToolSelect("publish")}
      />

      {/* Responses Tab */}
      <RailButton
        icon={<BarChart2 className="h-5 w-5" />}
        label="Stats"
        active={activeTool === "responses"}
        onClick={() => onToolSelect("responses")}
      />

      {/* Settings */}
      <RailButton
        icon={<Settings className="h-5 w-5" />}
        label="Config"
        active={activeTool === "settings"}
        onClick={() => onToolSelect("settings")}
      />
    </div>
  )
}

function RailButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={`h-auto w-full flex-col gap-1 px-0 py-2 text-[10px] ${active ? "font-medium" : "text-muted-foreground"}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </Button>
  )
}
