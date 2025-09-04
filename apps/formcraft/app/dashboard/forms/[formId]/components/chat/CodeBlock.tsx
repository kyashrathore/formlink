"use client"

import { useState } from "react"
import { Button } from "@formlink/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@formlink/ui"
import { Copy, Maximize2, Check } from "lucide-react"
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
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
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
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
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
          <div className="px-6 pb-6 h-full overflow-auto">
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
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="text-sm text-muted-foreground mb-2">
        Mermaid diagram (render implementation needed)
      </div>
      <pre className="text-xs opacity-60">{code}</pre>
    </div>
  )
}