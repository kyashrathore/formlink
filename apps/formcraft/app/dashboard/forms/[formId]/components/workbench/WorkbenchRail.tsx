"use client"

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formlink/ui"
import {
  ArrowLeft,
  BarChart2,
  MessageSquare,
  Paintbrush,
  Rocket,
  Settings,
} from "lucide-react"
import Link from "next/link"

export type WorkbenchTool =
  | "chat"
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
    <div className="flex h-full w-[52px] flex-col items-center gap-4 py-4">
      {/* Back to Dashboard */}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Dashboard</TooltipContent>
        </Tooltip>

        <div className="bg-border h-px w-8" />

        {/* Chat (Base Layer) */}
        <RailButton
          icon={<MessageSquare className="h-4 w-4" />}
          label="Chat"
          active={activeTool === "chat"}
          onClick={() => onToolSelect("chat")}
        />

        {/* Design Overlay */}
        <RailButton
          icon={<Paintbrush className="h-4 w-4" />}
          label="Design"
          active={activeTool === "design"}
          onClick={() => onToolSelect("design")}
        />

        {/* Publish Overlay */}
        <RailButton
          icon={<Rocket className="h-4 w-4" />}
          label="Publish"
          active={activeTool === "publish"}
          onClick={() => onToolSelect("publish")}
        />

        {/* Responses Tab */}
        <RailButton
          icon={<BarChart2 className="h-4 w-4" />}
          label="Responses"
          active={activeTool === "responses"}
          onClick={() => onToolSelect("responses")}
        />

        {/* Settings - Moved up (no spacer) */}
        <RailButton
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={activeTool === "settings"}
          onClick={() => onToolSelect("settings")}
        />
      </TooltipProvider>
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-lg"
          onClick={onClick}
        >
          {icon}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
