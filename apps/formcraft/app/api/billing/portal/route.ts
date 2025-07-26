import { createServerClient } from "@formlink/db"
import { Polar } from "@polar-sh/sdk"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_REQUESTS = 10
const RATE_LIMIT_WINDOW = 60 * 1000

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW

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

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") || "sandbox",
})

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

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
    }

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

    const customerId = subscription.external_customer_id || user.id

    const customerSession = await polar.customerSessions.create({
      customerId: customerId,
    })

    redirect(customerSession.customerPortalUrl)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.includes("NEXT_REDIRECT")
    ) {
      throw error
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const POST = GET
