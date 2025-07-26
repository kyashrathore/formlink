import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { invalidateSubscriptionCache } from "./feature-gate"
import type { SubscriptionLog, SubscriptionStatus } from "./types"

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
    try {
      const supabase = await this.getClient()
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("plan_type, status, current_period_end")
        .eq("user_id", userId)
        .single()

      if (error || !subscription || subscription.status === "canceled") {
        return {
          isActive: false,
          isPro: false,
          plan: "free" as const,
          status: "canceled" as const,
        }
      }

      return {
        isActive: subscription.status === "active",
        isPro: subscription.plan_type === "pro",
        plan: subscription.plan_type as "free" | "pro",
        status: subscription.status as "active" | "canceled" | "past_due",
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end)
          : undefined,
      }
    } catch (error) {
      throw error
    }
  }

  async updateSubscription(
    userId: string,
    customerId: string,
    status: "active" | "canceled" | "past_due",
    currentPeriodEnd?: Date
  ): Promise<void> {
    try {
      const supabase = await this.getServiceClient()

      const oldStatus = await this.getSubscriptionStatus(userId)

      const periodEnd =
        currentPeriodEnd ||
        (status === "active"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null)

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

      if (subscriptionError) {
        throw new Error(
          `Failed to update subscription: ${subscriptionError.message}`
        )
      }

      const { error: logError } = await supabase
        .from("subscription_logs")
        .insert({
          user_id: userId,
          action: "updated",
          old_status: oldStatus.status,
          new_status: status,
        })

      if (logError) {
      }

      invalidateSubscriptionCache(userId)
    } catch (error) {
      throw error
    }
  }

  async createSubscription(
    userId: string,
    customerId: string,
    currentPeriodEnd?: Date
  ): Promise<void> {
    const supabase = await this.getServiceClient()

    const periodEnd =
      currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

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

    const { error: logError } = await supabase
      .from("subscription_logs")
      .insert({
        user_id: userId,
        action: "created",
        old_status: "free",
        new_status: "active",
      })

    if (logError) {
    }

    invalidateSubscriptionCache(userId)
  }

  async cancelSubscription(userId: string): Promise<void> {
    const supabase = await this.getServiceClient()

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

    const { error: logError } = await supabase
      .from("subscription_logs")
      .insert({
        user_id: userId,
        action: "canceled",
        old_status: oldStatus.status,
        new_status: "canceled",
      })

    if (logError) {
    }

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
