"use client"

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@formlink/ui"
import { Check, Copy, Maximize2 } from "lucide-react"
import { useState } from "react"
import { cn } from "../../lib"

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isMermaid = language === "mermaid"

  return (
    <>
      <div className={cn("group relative", className)}>
        {/* Header with language and buttons */}
        <div className="bg-muted/30 flex items-center justify-between border-b px-4 py-2">
          <span className="text-muted-foreground text-xs font-medium">
            {language || "text"}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setFullscreenOpen(true)}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isMermaid ? (
            <MermaidDiagram code={code} />
          ) : (
            <pre className="overflow-x-auto">
              <code className="text-sm">{code}</code>
            </pre>
          )}
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="h-[90vh] max-w-6xl p-0">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center justify-between">
              <span>{language || "Code"} Preview</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-2">Copy</span>
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="h-full overflow-auto px-6 pb-6">
            {isMermaid ? (
              <MermaidDiagram code={code} />
            ) : (
              <pre className="overflow-x-auto">
                <code className="text-sm">{code}</code>
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Simple Mermaid component - you'll need to install mermaid
function MermaidDiagram({ code }: { code: string }) {
  // This is a placeholder - you'll need to implement actual mermaid rendering
  // Install: pnpm add mermaid
  // Then use mermaid.render() or similar
  return (
    <div className="bg-muted/20 rounded-lg border p-4">
      <div className="text-muted-foreground mb-2 text-sm">
        Mermaid diagram (render implementation needed)
      </div>
      <pre className="text-xs opacity-60">{code}</pre>
    </div>
  )
}
