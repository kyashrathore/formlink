"use client"

import { usePremium } from "@/app/hooks/usePremium"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@formlink/ui"
import { formatDistanceToNow } from "date-fns"
import { Crown, ExternalLink, RefreshCw } from "lucide-react"

interface SubscriptionInfoProps {
  className?: string
}

export function SubscriptionInfo({ className }: SubscriptionInfoProps) {
  const {
    subscription,
    loading,
    error,
    isPro,
    plan,
    status,
    currentPeriodEnd,
    refreshStatus,
    openCustomerPortal,
    upgradeToProRedirect,
  } = usePremium()

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading subscription...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <p className="text-destructive text-sm">
              Failed to load subscription: {error}
            </p>
            <Button size="sm" variant="outline" onClick={refreshStatus}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusBadge = () => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>
      case "canceled":
      default:
        return <Badge variant="secondary">Free</Badge>
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPro && <Crown className="h-5 w-5 text-yellow-500" />}
            Subscription
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Plan:</span>
            <span className="font-medium capitalize">{plan}</span>
          </div>

          {currentPeriodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {status === "active" ? "Renews" : "Ends"}:
              </span>
              <span className="font-medium">
                {formatDistanceToNow(currentPeriodEnd, { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {isPro ? (
            <Button
              variant="outline"
              onClick={openCustomerPortal}
              className="flex-1"
              size="sm"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          ) : (
            <Button onClick={upgradeToProRedirect} className="flex-1" size="sm">
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Pro
            </Button>
          )}

          <Button variant="ghost" onClick={refreshStatus} size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isPro && (
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>✓ FormLink branding removed</p>
            <p>✓ Advanced analytics & insights</p>
            <p>✓ Priority support</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
