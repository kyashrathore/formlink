"use client"

import { Button, CardContent, CodeEditor, Label } from "@formlink/ui"
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
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shadcn-css" className="text-sm font-semibold">
            ShadcnUI CSS Variables
          </Label>

          <div className="relative">
            <CodeEditor
              value={cssText}
              onChange={(value: any) => setCSSText(value || "")}
              language="css"
              height="320px"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                wrappingStrategy: "advanced",
                overviewRulerLanes: 0,
                readOnly: applicationStatus.loading,
              }}
              wrapperClassName="h-[320px]"
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
