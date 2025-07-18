import { SubscriptionManager } from "@/app/lib/subscription"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Get user from auth
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const subscriptionManager = new SubscriptionManager()
    const subscriptionStatus = await subscriptionManager.getSubscriptionStatus(
      user.id
    )

    // Also get subscription logs for billing history
    const subscriptionLogs = await subscriptionManager.getSubscriptionLogs(
      user.id
    )

    console.log("Subscription status requested:", {
      userId: user.id,
      status: subscriptionStatus,
    })

    return NextResponse.json({
      subscription: subscriptionStatus,
      logs: subscriptionLogs.slice(0, 10), // Return last 10 logs
    })
  } catch (error) {
    console.error("Subscription status endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
