import { createHmac } from "crypto"
import { SubscriptionManager } from "@/app/lib/subscription"
import { NextRequest, NextResponse } from "next/server"

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

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
        break // Don't retry on last attempt
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(
        `Webhook attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        error
      )

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

  // Handle both 'sha256=...' and plain hex formats
  const cleanSignature = signature.replace("sha256=", "")
  return cleanSignature === expectedSignature
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature =
      request.headers.get("polar-signature") ||
      request.headers.get("x-polar-signature")
    if (!signature) {
      console.error("Polar webhook: Missing signature")
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error(
        "Polar webhook: Missing POLAR_WEBHOOK_SECRET environment variable"
      )
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const body = await request.text()

    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      console.error("Polar webhook: Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Parse verified payload
    let payload: PolarWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch (error) {
      console.error("Polar webhook: Invalid JSON payload", error)
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    // Validate required fields
    const { type, data } = payload
    if (!type || !data?.object) {
      console.error("Polar webhook: Invalid payload structure", { type, data })
      return NextResponse.json(
        { error: "Invalid payload structure" },
        { status: 400 }
      )
    }

    const { id: subscriptionId, customer_id, status, user_id } = data.object

    if (!customer_id || !status) {
      console.error("Polar webhook: Missing required fields", {
        customer_id,
        status,
        user_id,
      })
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Security fix: Properly map customer_id to user_id using database lookup
    let userId: string

    if (user_id) {
      // If user_id is provided in payload, use it
      userId = user_id
    } else {
      // Look up user_id by customer_id in our database
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
        console.error(
          "Polar webhook: Could not find user for customer_id:",
          customer_id,
          error
        )
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        )
      }

      userId = subscription.user_id
    }

    console.log("Processing Polar webhook:", {
      type,
      subscriptionId,
      customerId: customer_id,
      userId,
      status,
    })

    const subscriptionManager = new SubscriptionManager()

    // Handle different webhook types with retry logic
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
          // Handle status changes in updates
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
          console.log("Polar webhook: Unhandled event type", type)
          // Return success even for unhandled events to avoid retries
          break
      }
    })

    console.log("Polar webhook processed successfully:", {
      type,
      userId,
      status,
    })
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error("Polar webhook processing error:", error)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
