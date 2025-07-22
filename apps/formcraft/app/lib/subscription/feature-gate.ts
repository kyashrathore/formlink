import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { SubscriptionManager } from "./service"

// Simple in-memory cache for subscription status
interface CacheEntry {
  status: any
  timestamp: number
}

const subscriptionCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

function getCachedSubscription(userId: string): any | null {
  const entry = subscriptionCache.get(userId)
  if (!entry) return null

  // Check if cache is expired
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

// Define available premium features
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

// Free tier features (always available)
const FREE_FEATURES: PremiumFeature[] = [
  // Currently, all core features are free except those explicitly premium
]

export async function hasFeature(
  userId: string,
  feature: PremiumFeature
): Promise<boolean> {
  try {
    // Check cache first
    let subscription = getCachedSubscription(userId)

    if (!subscription) {
      // Cache miss - fetch from database
      const subscriptionManager = new SubscriptionManager()
      subscription = await subscriptionManager.getSubscriptionStatus(userId)
      setCachedSubscription(userId, subscription)
    }

    // Pro users get all features
    if (subscription.isPro && subscription.isActive) {
      return true
    }

    // Free tier features
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

    // Pro users get unlimited AI usage
    if (subscription.isPro && subscription.isActive) {
      return { allowed: true, current: 0, limit: -1 } // -1 indicates unlimited
    }

    // Check free tier limit using existing daily_message_count from users table
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore, "anon")

    const { data: user, error } = await supabase
      .from("users")
      .select("daily_message_count")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[AI-LIMIT] Error checking AI limit:", error)
      // Fail safe - allow but log error
      return { allowed: true, current: 0, limit: 5 }
    }

    const current = user?.daily_message_count || 0
    const limit = 5 // Free tier limit

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

// Usage checking for rate limiting
export async function checkRateLimit(userId: string): Promise<boolean> {
  const subscriptionManager = new SubscriptionManager()
  const subscription = await subscriptionManager.getSubscriptionStatus(userId)

  // Pro users get higher limits (no rate limiting for now)
  if (subscription.isPro && subscription.isActive) {
    return true
  }

  // Use existing AI rate limiting for free users
  const { allowed } = await checkAILimit(userId)
  return allowed
}
