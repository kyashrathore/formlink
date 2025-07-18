"use client"

import { usePremium } from "@/app/hooks/usePremium"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@formlink/ui"
import { Crown, X } from "lucide-react"
import { useState } from "react"

interface UpgradePromptProps {
  feature?: string
  description?: string
  className?: string
  compact?: boolean
  dismissible?: boolean
}

export function UpgradePrompt({
  feature = "Premium features",
  description = "Remove branding and get advanced analytics",
  className,
  compact = false,
  dismissible = false,
}: UpgradePromptProps) {
  const { isPro, upgradeToProRedirect } = usePremium()
  const [dismissed, setDismissed] = useState(false)

  // Don't show for Pro users or if dismissed
  if (isPro || dismissed) {
    return null
  }

  if (compact) {
    return (
      <div className={`bg-muted rounded-lg border p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Upgrade to Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={upgradeToProRedirect}
              className="h-7 px-2 text-xs"
            >
              $29/month
            </Button>
            {dismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                className="h-7 w-7 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-yellow-500" />
            Go Pro
          </CardTitle>
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button onClick={upgradeToProRedirect} className="w-full">
          Upgrade - $29/month
        </Button>
      </CardContent>
    </Card>
  )
}
