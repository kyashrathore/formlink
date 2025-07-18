import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_REQUESTS = 5 // Lower limit for payment endpoints
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW

  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < windowStart) {
      rateLimitMap.delete(key)
    }
  }

  const current = rateLimitMap.get(identifier)
  if (!current) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now })
    return true
  }

  if (current.resetTime < windowStart) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now })
    return true
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return false
  }

  current.count++
  return true
}

export async function POST(request: NextRequest) {
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

    // Rate limiting check
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from("user_subscriptions")
      .select("status, plan_type")
      .eq("user_id", user.id)
      .single()

    if (
      existingSubscription?.status === "active" &&
      existingSubscription?.plan_type === "pro"
    ) {
      return NextResponse.json(
        { error: "User already has an active Pro subscription" },
        { status: 400 }
      )
    }

    // Get environment variables
    const polarOrganization = process.env.POLAR_ORGANIZATION
    const polarProductId = process.env.POLAR_PRODUCT_ID

    if (!polarOrganization || !polarProductId) {
      console.error("Missing Polar.sh configuration:", {
        polarOrganization: !!polarOrganization,
        polarProductId: !!polarProductId,
      })
      return NextResponse.json(
        { error: "Payment system configuration error" },
        { status: 500 }
      )
    }

    // Build Polar.sh checkout URL
    const checkoutParams = new URLSearchParams({
      organization: polarOrganization,
      product: polarProductId,
      customer_id: user.id, // Use Supabase user ID as customer ID
      success_url: `${request.nextUrl.origin}/dashboard?upgraded=true`,
      cancel_url: `${request.nextUrl.origin}/dashboard?upgrade_cancelled=true`,
    })

    const checkoutUrl = `https://polar.sh/checkout?${checkoutParams.toString()}`

    console.log("Redirecting to Polar.sh checkout:", {
      userId: user.id,
      checkoutUrl,
    })

    // Redirect to Polar.sh checkout
    return redirect(checkoutUrl)
  } catch (error) {
    console.error("Upgrade endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Handle GET requests (for direct navigation)
export async function GET(request: NextRequest) {
  return POST(request)
}
