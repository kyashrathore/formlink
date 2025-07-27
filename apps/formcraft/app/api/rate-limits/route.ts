import {
  AUTH_DAILY_MESSAGE_LIMIT,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "@/app/lib/config"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  let authResult
  try {
    authResult = await requireAuth(req)
  } catch (error) {
    return authErrorResponse({
      name: "AuthError",
      message: error instanceof Error ? error.message : "Authentication failed",
      statusCode: 401,
    })
  }

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const { data, error } = await supabase
    .from("users")
    .select("daily_message_count")
    .eq("id", authResult.user.id)
    .maybeSingle()

  if (error || !data) {
    return new Response(JSON.stringify({ error: error?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const dailyLimit = authResult.isGuest
    ? NON_AUTH_DAILY_MESSAGE_LIMIT
    : AUTH_DAILY_MESSAGE_LIMIT
  const dailyCount = data.daily_message_count || 0
  const remaining = dailyLimit - dailyCount

  return new Response(JSON.stringify({ dailyCount, dailyLimit, remaining }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
