import { SubscriptionManager } from "@/app/lib/subscription"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
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

    const subscriptionLogs = await subscriptionManager.getSubscriptionLogs(
      user.id
    )

    return NextResponse.json({
      subscription: subscriptionStatus,
      logs: subscriptionLogs.slice(0, 10),
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
