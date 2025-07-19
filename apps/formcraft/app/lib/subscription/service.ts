import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { invalidateSubscriptionCache } from "./feature-gate"
import type { Subscription, SubscriptionLog, SubscriptionStatus } from "./types"

export class SubscriptionManager {
  private async getServiceClient() {
    const cookieStore = await cookies()
    return createServerClient(cookieStore, "service")
  }

  private async getClient() {
    const cookieStore = await cookies()
    return createServerClient(cookieStore, "anon")
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    console.log("[SUBSCRIPTION] Getting subscription status for user:", userId)
    const startTime = performance.now()

    try {
      const supabase = await this.getClient()
      console.log(
        "[SUBSCRIPTION] Supabase client created in",
        performance.now() - startTime,
        "ms"
      )

      const queryStartTime = performance.now()
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("plan_type, status, current_period_end")
        .eq("user_id", userId)
        .single()

      const queryTime = performance.now() - queryStartTime
      console.log("[SUBSCRIPTION] Database query completed in", queryTime, "ms")

      if (error) {
        console.log(
          "[SUBSCRIPTION] Query error:",
          error.message,
          "Code:",
          error.code
        )
        if (error.code === "PGRST116") {
          console.log(
            "[SUBSCRIPTION] No subscription found, returning free tier"
          )
        }
      }

      if (error || !subscription || subscription.status === "canceled") {
        const result = {
          isActive: false,
          isPro: false,
          plan: "free" as const,
          status: "canceled" as const,
        }
        console.log("[SUBSCRIPTION] Returning free tier result:", result)
        return result
      }

      const result = {
        isActive: subscription.status === "active",
        isPro: subscription.plan_type === "pro",
        plan: subscription.plan_type as "free" | "pro",
        status: subscription.status as "active" | "canceled" | "past_due",
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end)
          : undefined,
      }

      console.log("[SUBSCRIPTION] Returning subscription result:", result)
      console.log(
        "[SUBSCRIPTION] Total subscription check time:",
        performance.now() - startTime,
        "ms"
      )
      return result
    } catch (error) {
      console.error(
        "[SUBSCRIPTION] Unexpected error in getSubscriptionStatus:",
        error
      )
      throw error
    }
  }

  async updateSubscription(
    userId: string,
    customerId: string,
    status: "active" | "canceled" | "past_due",
    currentPeriodEnd?: Date
  ): Promise<void> {
    console.log(
      "[SUBSCRIPTION] Updating subscription for user:",
      userId,
      "to status:",
      status
    )
    const startTime = performance.now()

    try {
      const supabase = await this.getServiceClient()
      console.log(
        "[SUBSCRIPTION] Service client created in",
        performance.now() - startTime,
        "ms"
      )

      // Get old status for logging
      console.log("[SUBSCRIPTION] Getting old status for comparison...")
      const oldStatusStartTime = performance.now()
      const oldStatus = await this.getSubscriptionStatus(userId)
      console.log(
        "[SUBSCRIPTION] Old status retrieved in",
        performance.now() - oldStatusStartTime,
        "ms:",
        oldStatus
      )

      // Use provided period end or calculate default if none provided
      const periodEnd =
        currentPeriodEnd ||
        (status === "active"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days fallback
          : null)

      console.log("[SUBSCRIPTION] Calculated period end:", periodEnd)

      // Upsert subscription
      console.log("[SUBSCRIPTION] Upserting subscription record...")
      const upsertStartTime = performance.now()
      const { error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            external_customer_id: customerId,
            plan_type: status === "active" ? "pro" : "free",
            status: status,
            current_period_end: periodEnd?.toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        )

      console.log(
        "[SUBSCRIPTION] Subscription upsert completed in",
        performance.now() - upsertStartTime,
        "ms"
      )

      if (subscriptionError) {
        console.error(
          "[SUBSCRIPTION] Subscription upsert error:",
          subscriptionError
        )
        throw new Error(
          `Failed to update subscription: ${subscriptionError.message}`
        )
      }

      // Log the change
      console.log("[SUBSCRIPTION] Logging subscription change...")
      const logStartTime = performance.now()
      const { error: logError } = await supabase
        .from("subscription_logs")
        .insert({
          user_id: userId,
          action: "updated",
          old_status: oldStatus.status,
          new_status: status,
        })

      console.log(
        "[SUBSCRIPTION] Subscription log completed in",
        performance.now() - logStartTime,
        "ms"
      )

      if (logError) {
        console.error(
          "[SUBSCRIPTION] Failed to log subscription change:",
          logError
        )
        // Don't throw here as the main operation succeeded
      }

      // Invalidate cache after successful update
      console.log("[SUBSCRIPTION] Invalidating cache for user:", userId)
      invalidateSubscriptionCache(userId)

      console.log(
        "[SUBSCRIPTION] Total update time:",
        performance.now() - startTime,
        "ms"
      )
    } catch (error) {
      console.error(
        "[SUBSCRIPTION] Unexpected error in updateSubscription:",
        error
      )
      throw error
    }
  }

  async createSubscription(
    userId: string,
    customerId: string,
    currentPeriodEnd?: Date
  ): Promise<void> {
    const supabase = await this.getServiceClient()

    // Use provided period end or calculate default if none provided
    const periodEnd =
      currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days fallback

    const { error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        external_customer_id: customerId,
        plan_type: "pro",
        status: "active",
        current_period_end: periodEnd.toISOString(),
      })

    if (subscriptionError) {
      throw new Error(
        `Failed to create subscription: ${subscriptionError.message}`
      )
    }

    // Log the creation
    const { error: logError } = await supabase
      .from("subscription_logs")
      .insert({
        user_id: userId,
        action: "created",
        old_status: "free",
        new_status: "active",
      })

    if (logError) {
      console.error("Failed to log subscription creation:", logError)
    }

    // Invalidate cache after successful creation
    invalidateSubscriptionCache(userId)
  }

  async cancelSubscription(userId: string): Promise<void> {
    const supabase = await this.getServiceClient()

    // Get old status for logging
    const oldStatus = await this.getSubscriptionStatus(userId)

    const { error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .update({
        status: "canceled",
        plan_type: "free",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (subscriptionError) {
      throw new Error(
        `Failed to cancel subscription: ${subscriptionError.message}`
      )
    }

    // Log the cancellation
    const { error: logError } = await supabase
      .from("subscription_logs")
      .insert({
        user_id: userId,
        action: "canceled",
        old_status: oldStatus.status,
        new_status: "canceled",
      })

    if (logError) {
      console.error("Failed to log subscription cancellation:", logError)
    }

    // Invalidate cache after successful cancellation
    invalidateSubscriptionCache(userId)
  }

  async getSubscriptionLogs(userId: string): Promise<SubscriptionLog[]> {
    const supabase = await this.getClient()

    const { data: logs, error } = await supabase
      .from("subscription_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Failed to get subscription logs: ${error.message}`)
    }

    return logs || []
  }
}
