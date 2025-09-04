"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@formlink/ui"
import { Button } from "@formlink/ui"
import { Maximize2 } from "lucide-react"
import { Response } from "@formlink/ui/ai-elements"

interface FullscreenResponseProps {
  content: string
  title?: string
  className?: string
}

export function FullscreenResponse({ content, title = "Preview", className }: FullscreenResponseProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={className}>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="View full screen"
          onClick={() => setOpen(true)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[80vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 h-full overflow-auto">
            <Response>{content}</Response>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

