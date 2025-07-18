import type {
  SubscriptionLog,
  SubscriptionStatus,
} from "@/app/lib/subscription/types"
import { useEffect, useState } from "react"
import { useAuth } from "./useAuth"

interface PremiumData {
  subscription: SubscriptionStatus | null
  logs: SubscriptionLog[]
  loading: boolean
  error: string | null
}

export function usePremium() {
  const { user } = useAuth()
  const [data, setData] = useState<PremiumData>({
    subscription: null,
    logs: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function fetchPremiumStatus() {
      if (!user) {
        setData({
          subscription: {
            isActive: false,
            isPro: false,
            plan: "free",
            status: "canceled",
          },
          logs: [],
          loading: false,
          error: null,
        })
        return
      }

      try {
        setData((prev) => ({ ...prev, loading: true, error: null }))

        const response = await fetch("/api/billing/status")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()

        setData({
          subscription: result.subscription,
          logs: result.logs || [],
          loading: false,
          error: null,
        })
      } catch (error) {
        console.error("Error fetching premium status:", error)
        setData((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }))
      }
    }

    fetchPremiumStatus()
  }, [user])

  const refreshStatus = async () => {
    if (!user) return

    try {
      setData((prev) => ({ ...prev, loading: true }))

      const response = await fetch("/api/billing/status")
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      setData((prev) => ({
        ...prev,
        subscription: result.subscription,
        logs: result.logs || [],
        loading: false,
        error: null,
      }))
    } catch (error) {
      console.error("Error refreshing premium status:", error)
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    }
  }

  const openCustomerPortal = async () => {
    try {
      const response = await fetch("/api/billing/portal")
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.portalUrl) {
        window.open(result.portalUrl, "_blank")
      }
    } catch (error) {
      console.error("Error opening customer portal:", error)
      throw error
    }
  }

  const upgradeToProRedirect = () => {
    window.location.href = "/api/billing/upgrade"
  }

  return {
    // Subscription data
    subscription: data.subscription,
    logs: data.logs,
    loading: data.loading,
    error: data.error,

    // Convenience properties
    isPro: data.subscription?.isPro || false,
    isActive: data.subscription?.isActive || false,
    plan: data.subscription?.plan || "free",
    status: data.subscription?.status || "canceled",
    currentPeriodEnd: data.subscription?.currentPeriodEnd,

    // Actions
    refreshStatus,
    openCustomerPortal,
    upgradeToProRedirect,
  }
}
