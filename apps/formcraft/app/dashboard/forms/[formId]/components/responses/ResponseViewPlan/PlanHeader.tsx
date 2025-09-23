"use client"

import { Badge, Button, CardHeader, CardTitle } from "@formlink/ui"
import { CheckCircle2, LineChart, Trash2, X } from "lucide-react"

export function PlanHeader({
  viewName,
  saved,
  onDelete,
  onDismiss,
}: {
  viewName: string
  saved?: boolean
  onDelete?: () => void
  onDismiss?: () => void
}) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LineChart className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-base font-semibold">{viewName}</CardTitle>
          {saved ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </Badge>
          ) : (
            <Badge variant="outline">In‑progress</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && onDelete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete view
            </Button>
          ) : null}
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
