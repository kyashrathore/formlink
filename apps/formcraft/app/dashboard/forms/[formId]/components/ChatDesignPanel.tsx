"use client"

import { ExternalLink, X } from "lucide-react"
import { usePanelState } from "../hooks/usePanelState"

interface ChatDesignPanelProps {
  chatContent: React.ReactNode
  designContent: React.ReactNode
  onHeaderMouseDown?: (e: React.MouseEvent) => void
}

export default function ChatDesignPanel({
  chatContent,
  designContent,
  onHeaderMouseDown,
}: ChatDesignPanelProps) {
  const {
    activeChatTab,
    setActiveChatTab,
    toggleFloating,
    panelState,
    isFloating,
  } = usePanelState()

  // Don't render content if collapsed
  if (panelState === "collapsed") {
    return (
      <div className="bg-muted/50 border-border flex h-full flex-col items-center justify-center border-r">
        <div className="text-muted-foreground -rotate-90 transform text-xs whitespace-nowrap">
          Control
        </div>
        <button
          onClick={() => {
            // Auto-return to Form tab and expand panel
            usePanelState.getState().setActiveMainTab("form")
          }}
          className="hover:bg-accent mt-4 rounded p-1"
          title="Return to Form tab"
        >
          <ExternalLink className="text-muted-foreground h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with tabs and dock/close button */}
      <div
        className={`border-border bg-muted/30 flex items-center justify-between border-b ${isFloating ? "cursor-grab rounded-t-lg" : "rounded-t-lg"}`}
        onMouseDown={isFloating ? onHeaderMouseDown : undefined}
      >
        <div className="flex">
          <button
            onClick={() => setActiveChatTab("chat")}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeChatTab === "chat"
                ? "border-primary text-primary bg-card"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-transparent"
            } `}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveChatTab("design")}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeChatTab === "design"
                ? "border-primary text-primary bg-card"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-transparent"
            } `}
          >
            Design
          </button>
        </div>
        <button
          onClick={toggleFloating}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5"
          title={isFloating ? "Dock to sidebar" : "Detach panel"}
        >
          {isFloating ? (
            <X className="h-4 w-4" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeChatTab === "chat" ? chatContent : designContent}
      </div>
    </div>
  )
}
