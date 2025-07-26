import { createHmac } from "crypto"
import { SubscriptionManager } from "@/app/lib/subscription"
import { NextRequest, NextResponse } from "next/server"

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) {
        break
      }

      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

interface PolarWebhookPayload {
  type: string
  data: {
    object: {
      id: string
      customer_id: string
      status: "active" | "canceled" | "past_due"
      user_id?: string
    }
  }
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex")

  const cleanSignature = signature.replace("sha256=", "")
  return cleanSignature === expectedSignature
}

export async function POST(request: NextRequest) {
  try {
    const signature =
      request.headers.get("polar-signature") ||
      request.headers.get("x-polar-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const body = await request.text()

    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    let payload: PolarWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    const { type, data } = payload
    if (!type || !data?.object) {
      return NextResponse.json(
        { error: "Invalid payload structure" },
        { status: 400 }
      )
    }

    const { customer_id, status, user_id } = data.object

    if (!customer_id || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    let userId: string

    if (user_id) {
      userId = user_id
    } else {
      const { createServerClient } = await import("@formlink/db")
      const { cookies } = await import("next/headers")
      const cookieStore = await cookies()
      const supabase = await createServerClient(cookieStore, "service")

      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("external_customer_id", customer_id)
        .single()

      if (error || !subscription) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        )
      }

      userId = subscription.user_id || ""
    }

    const subscriptionManager = new SubscriptionManager()

    await withRetry(async () => {
      switch (type) {
        case "subscription.created":
        case "subscription.activated":
          await subscriptionManager.updateSubscription(
            userId,
            customer_id,
            "active"
          )
          break

        case "subscription.cancelled":
        case "subscription.canceled":
          await subscriptionManager.updateSubscription(
            userId,
            customer_id,
            "canceled"
          )
          break

        case "subscription.updated":
          await subscriptionManager.updateSubscription(
            userId,
            customer_id,
            status
          )
          break

        case "subscription.past_due":
          await subscriptionManager.updateSubscription(
            userId,
            customer_id,
            "past_due"
          )
          break

        default:
          break
      }
    })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
