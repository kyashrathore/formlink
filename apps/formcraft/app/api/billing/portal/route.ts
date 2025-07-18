import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_REQUESTS = 10 // requests per window
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

    // Rate limiting check
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
    }

    // Check if user has a subscription
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("external_customer_id, status")
      .eq("user_id", user.id)
      .single()

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      )
    }

    // Get environment variables
    const polarOrganization = process.env.POLAR_ORGANIZATION

    if (!polarOrganization) {
      console.error("Missing POLAR_ORGANIZATION environment variable")
      return NextResponse.json(
        { error: "Payment system configuration error" },
        { status: 500 }
      )
    }

    // Build Polar.sh customer portal URL
    const portalParams = new URLSearchParams({
      organization: polarOrganization,
      customer_id: subscription.external_customer_id || user.id,
      return_url: `${request.nextUrl.origin}/dashboard`,
    })

    const portalUrl = `https://polar.sh/customer-portal?${portalParams.toString()}`

    console.log("Redirecting to Polar.sh customer portal:", {
      userId: user.id,
      customerId: subscription.external_customer_id,
      portalUrl,
    })

    // Return redirect URL
    return NextResponse.json({
      portalUrl,
      customerId: subscription.external_customer_id || user.id,
    })
  } catch (error) {
    console.error("Customer portal endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests the same way as GET for simplicity
  const response = await GET(request)
  const data = await response.json()

  if (data.portalUrl) {
    // For POST, redirect instead of returning JSON
    return NextResponse.redirect(data.portalUrl)
  }

  return response
}
