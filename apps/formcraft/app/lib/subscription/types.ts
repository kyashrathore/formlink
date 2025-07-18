export interface SubscriptionStatus {
  isActive: boolean
  isPro: boolean
  plan: "free" | "pro"
  status: "active" | "canceled" | "past_due"
  currentPeriodEnd?: Date
}

export interface Subscription {
  id: string
  user_id: string
  external_customer_id?: string
  plan_type: "free" | "pro"
  status: "active" | "canceled" | "past_due"
  current_period_end?: string
  created_at: string
  updated_at: string
}

export interface SubscriptionLog {
  id: string
  user_id: string | null
  action: string
  old_status: string | null
  new_status: string | null
  created_at: string | null
}
