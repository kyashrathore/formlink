"use client"

import { Button, CardHeader, CardTitle } from "@formlink/ui"
import { LineChart, X } from "lucide-react"

export function PlanHeader({
  viewName,
  saved,
  onDismiss,
}: {
  viewName: string
  saved?: boolean
  onDismiss?: () => void
}) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LineChart className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-base font-semibold">{viewName}</CardTitle>
          {saved ? (
            <div className="flex items-center gap-1 text-sm">saved</div>
          ) : (
            <div className="text-muted-foreground text-sm">unsaved</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDismiss ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onDismiss}
              aria-label="Dismiss response plan"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </CardHeader>
  )
}
