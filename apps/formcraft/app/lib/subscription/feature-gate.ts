import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { SubscriptionManager } from "./service"

interface CacheEntry {
  status: any
  timestamp: number
}

const subscriptionCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000

function getCachedSubscription(userId: string): any | null {
  const entry = subscriptionCache.get(userId)
  if (!entry) return null

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    subscriptionCache.delete(userId)
    return null
  }

  return entry.status
}

function setCachedSubscription(userId: string, status: any): void {
  subscriptionCache.set(userId, {
    status,
    timestamp: Date.now(),
  })
}

export function invalidateSubscriptionCache(userId: string): void {
  subscriptionCache.delete(userId)
}

export const PREMIUM_FEATURES = {
  REMOVE_BRANDING: "remove_branding",
  ADVANCED_ANALYTICS: "advanced_analytics",
  CSV_EXPORT: "csv_export",
  WEBHOOKS: "webhooks",
  API_ACCESS: "api_access",
  CUSTOM_DOMAINS: "custom_domains",
  FILE_UPLOADS: "file_uploads",
  CUSTOM_CSS: "custom_css",
  TEAM_COLLABORATION: "team_collaboration",
  PRIORITY_SUPPORT: "priority_support",
} as const

export type PremiumFeature =
  (typeof PREMIUM_FEATURES)[keyof typeof PREMIUM_FEATURES]

const FREE_FEATURES: PremiumFeature[] = []

export async function hasFeature(
  userId: string,
  feature: PremiumFeature
): Promise<boolean> {
  try {
    let subscription = getCachedSubscription(userId)

    if (!subscription) {
      const subscriptionManager = new SubscriptionManager()
      subscription = await subscriptionManager.getSubscriptionStatus(userId)
      setCachedSubscription(userId, subscription)
    }

    if (subscription.isPro && subscription.isActive) {
      return true
    }

    const hasAccess = FREE_FEATURES.includes(feature)
    return hasAccess
  } catch (error) {
    console.error("[FEATURE-GATE] Error checking feature access:", error)
    throw error
  }
}

export interface AIUsageLimit {
  allowed: boolean
  current: number
  limit: number
}

export async function checkAILimit(userId: string): Promise<AIUsageLimit> {
  try {
    const subscriptionManager = new SubscriptionManager()
    const subscription = await subscriptionManager.getSubscriptionStatus(userId)

    if (subscription.isPro && subscription.isActive) {
      return { allowed: true, current: 0, limit: -1 }
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore, "anon")

    const { data: user, error } = await supabase
      .from("users")
      .select("daily_message_count")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[AI-LIMIT] Error checking AI limit:", error)

      return { allowed: true, current: 0, limit: 5 }
    }

    const current = user?.daily_message_count || 0
    const limit = 5

    const result = {
      allowed: current < limit,
      current,
      limit,
    }

    return result
  } catch (error) {
    console.error("[AI-LIMIT] Unexpected error in checkAILimit:", error)
    throw error
  }
}

export async function incrementAIUsage(userId: string): Promise<void> {
  try {
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore, "anon")

    const { error } = await supabase.rpc("increment_daily_message_count", {
      user_id: userId,
    })

    if (error) {
      console.error("[AI-INCREMENT] Error incrementing AI usage:", error)
    }
  } catch (error) {
    console.error("[AI-INCREMENT] Unexpected error in incrementAIUsage:", error)
    throw error
  }
}

export async function checkRateLimit(userId: string): Promise<boolean> {
  const subscriptionManager = new SubscriptionManager()
  const subscription = await subscriptionManager.getSubscriptionStatus(userId)

  if (subscription.isPro && subscription.isActive) {
    return true
  }

  const { allowed } = await checkAILimit(userId)
  return allowed
}
