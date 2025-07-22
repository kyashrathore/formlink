import { createServerClient } from "@formlink/db"
import { Polar } from "@polar-sh/sdk"
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

// Initialize Polar client
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") || "sandbox",
})

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

    const productId = process.env.POLAR_PRODUCT_ID
    if (!productId) {
      return NextResponse.json(
        { error: "Product configuration error" },
        { status: 500 }
      )
    }

    // Create checkout session using Polar SDK
    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: user.email || undefined,
      successUrl: `${request.nextUrl.origin}/dashboard?upgraded=true`,
      // Don't pass customerId - let Polar create customer automatically
    })

    // Redirect to Polar.sh checkout
    redirect(checkout.url)
  } catch (error) {
    // Don't catch redirect errors - let Next.js handle them
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.includes("NEXT_REDIRECT")
    ) {
      throw error
    }

    console.error("Upgrade endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const POST = GET
