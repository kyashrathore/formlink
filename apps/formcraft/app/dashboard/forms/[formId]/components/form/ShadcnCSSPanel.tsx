"use client"

import { Button, CardContent, Label, Textarea } from "@formlink/ui"
import { useCallback, useEffect, useState } from "react"

interface ShadcnCSSPanelProps {
  onSaveTheme?: (cssText: string) => void
  onSaveAsBrand?: (cssText: string) => void
  initialCssText?: string
  applicationStatus?: {
    loading: boolean
    error?: string
    success?: boolean
    appliedRootVariables?: string[]
    appliedDarkVariables?: string[]
    warnings?: string[]
  }
  className?: string
}

export default function ShadcnCSSPanel({
  onSaveTheme,
  onSaveAsBrand,
  initialCssText,
  applicationStatus = { loading: false },
  className = "",
}: ShadcnCSSPanelProps) {
  const [cssText, setCSSText] = useState("")

  useEffect(() => {
    if (initialCssText) {
      setCSSText(initialCssText)
    }
  }, [initialCssText])

  const handleSaveTheme = useCallback(() => {
    if (cssText.trim() && onSaveTheme) {
      onSaveTheme(cssText)
    }
  }, [cssText, onSaveTheme])

  const handleSaveAsBrand = useCallback(() => {
    if (cssText.trim() && onSaveAsBrand) {
      onSaveAsBrand(cssText)
    }
  }, [cssText, onSaveAsBrand])

  const handleClear = useCallback(() => {
    setCSSText("")
  }, [])

  const hasContent = cssText.trim().length > 0

  return (
    <div className={className}>
      <CardContent className="-p-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shadcn-css" className="text-sm font-semibold">
            ShadcnUI CSS Variables
          </Label>

          <div className="relative">
            <Textarea
              value={cssText}
              onChange={(e) => setCSSText(e.target.value)}
              placeholder="Enter CSS variables..."
              className="h-[320px] font-mono text-sm"
              disabled={applicationStatus.loading}
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleSaveTheme}
              disabled={!hasContent || applicationStatus.loading}
              className="flex-1"
            >
              {applicationStatus.loading ? "Saving..." : "Save Theme"}
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveAsBrand}
              disabled={!hasContent || applicationStatus.loading}
              className="flex-1"
            >
              {applicationStatus.loading ? "Saving..." : "Save as Brand"}
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleClear}
            disabled={!hasContent || applicationStatus.loading}
            className="w-full"
            size="sm"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </div>
  )
}
