"use client"

import { Button } from "@formlink/ui"
import { ExternalLink, PanelLeftClose, PanelLeftOpen, X } from "lucide-react"
import React, { useMemo } from "react"
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

  // Visibility toggle removed per request

  // Inject showChat into chatContent when possible (kept stable for future)
  const injectedChatContent = useMemo(() => chatContent, [chatContent])

  return (
    <div className="flex h-full flex-col">
      {panelState === "collapsed" ? (
        <div className="bg-muted/50 border-border flex h-full flex-col items-center border-r pt-2">
          <button
            onClick={() => {
              usePanelState.getState().setPanelState("expanded")
            }}
            className="hover:bg-accent rounded p-1"
            title="Expand panel"
            aria-label="Expand panel"
          >
            <PanelLeftOpen className="text-muted-foreground h-4 w-4" />
          </button>
          <div className="text-muted-foreground mt-auto mb-6 -rotate-90 transform text-xs whitespace-nowrap">
            Control
          </div>
        </div>
      ) : (
        <>
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
            <div className="flex items-center gap-2 pr-2">
              {/* Collapse/Expand left panel (entire chat/design panel) */}
              {!isFloating && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    // In this branch, panelState is not 'collapsed'.
                    // Collapse the panel directly to avoid invalid union narrowing.
                    usePanelState.getState().setPanelState("collapsed")
                  }}
                  title={"Collapse panel"}
                >
                  <PanelLeftClose className="mr-2 h-4 w-4" />
                </Button>
              )}
              {/* Hide/Show chat button removed */}

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
          </div>

          <div className="flex-1 overflow-hidden">
            {activeChatTab === "chat" ? injectedChatContent : designContent}
          </div>
        </>
      )}
    </div>
  )
}
