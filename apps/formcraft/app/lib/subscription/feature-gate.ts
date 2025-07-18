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
  console.log(
    "[FEATURE-GATE] Checking feature access for user:",
    userId,
    "feature:",
    feature
  )
  const startTime = performance.now()

  try {
    // Check cache first
    let subscription = getCachedSubscription(userId)

    if (!subscription) {
      console.log("[FEATURE-GATE] Cache miss - fetching from database")
      // Cache miss - fetch from database
      const subscriptionManager = new SubscriptionManager()
      subscription = await subscriptionManager.getSubscriptionStatus(userId)
      setCachedSubscription(userId, subscription)
      console.log(
        "[FEATURE-GATE] Subscription fetched and cached:",
        subscription
      )
    } else {
      console.log(
        "[FEATURE-GATE] Cache hit - using cached subscription:",
        subscription
      )
    }

    // Pro users get all features
    if (subscription.isPro && subscription.isActive) {
      console.log("[FEATURE-GATE] Pro user - granting feature access")
      console.log(
        "[FEATURE-GATE] Feature check completed in",
        performance.now() - startTime,
        "ms"
      )
      return true
    }

    // Free tier features
    const hasAccess = FREE_FEATURES.includes(feature)
    console.log("[FEATURE-GATE] Free tier user - feature access:", hasAccess)
    console.log(
      "[FEATURE-GATE] Feature check completed in",
      performance.now() - startTime,
      "ms"
    )
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
  console.log("[AI-LIMIT] Checking AI limit for user:", userId)
  const startTime = performance.now()

  try {
    const subscriptionManager = new SubscriptionManager()
    const subscription = await subscriptionManager.getSubscriptionStatus(userId)
    console.log("[AI-LIMIT] Subscription status retrieved:", subscription)

    // Pro users get unlimited AI usage
    if (subscription.isPro && subscription.isActive) {
      console.log("[AI-LIMIT] Pro user - unlimited AI usage")
      console.log(
        "[AI-LIMIT] AI limit check completed in",
        performance.now() - startTime,
        "ms"
      )
      return { allowed: true, current: 0, limit: -1 } // -1 indicates unlimited
    }

    // Check free tier limit using existing daily_message_count from users table
    console.log("[AI-LIMIT] Checking free tier limit from users table...")
    const dbStartTime = performance.now()
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore, "anon")

    const { data: user, error } = await supabase
      .from("users")
      .select("daily_message_count")
      .eq("id", userId)
      .single()

    const dbTime = performance.now() - dbStartTime
    console.log("[AI-LIMIT] Users table query completed in", dbTime, "ms")

    if (error) {
      console.error("[AI-LIMIT] Error checking AI limit:", error)
      // Fail safe - allow but log error
      const result = { allowed: true, current: 0, limit: 5 }
      console.log("[AI-LIMIT] Returning fail-safe result:", result)
      return result
    }

    const current = user?.daily_message_count || 0
    const limit = 5 // Free tier limit

    const result = {
      allowed: current < limit,
      current,
      limit,
    }

    console.log("[AI-LIMIT] AI limit check result:", result)
    console.log(
      "[AI-LIMIT] Total AI limit check time:",
      performance.now() - startTime,
      "ms"
    )
    return result
  } catch (error) {
    console.error("[AI-LIMIT] Unexpected error in checkAILimit:", error)
    throw error
  }
}

export async function incrementAIUsage(userId: string): Promise<void> {
  console.log("[AI-INCREMENT] Incrementing AI usage for user:", userId)
  const startTime = performance.now()

  try {
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore, "anon")

    const rpcStartTime = performance.now()
    const { error } = await supabase.rpc("increment_daily_message_count", {
      user_id: userId,
    })

    const rpcTime = performance.now() - rpcStartTime
    console.log("[AI-INCREMENT] RPC call completed in", rpcTime, "ms")

    if (error) {
      console.error("[AI-INCREMENT] Error incrementing AI usage:", error)
    } else {
      console.log("[AI-INCREMENT] AI usage incremented successfully")
    }

    console.log(
      "[AI-INCREMENT] Total increment time:",
      performance.now() - startTime,
      "ms"
    )
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
