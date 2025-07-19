import { APP_DOMAIN, MODEL_DEFAULT } from "@/app/lib/config"
import { getenv } from "@/lib/env"
import { SupabaseClient } from "@formlink/db"
import {
  AUTH_DAILY_MESSAGE_LIMIT,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "./config"
import {
  API_ROUTE_CREATE_CHAT,
  API_ROUTE_CREATE_GUEST,
  API_ROUTE_UPDATE_CHAT_MODEL,
} from "./routes"

export async function createNewChat(
  userId: string,
  title?: string,
  model?: string,
  isAuthenticated?: boolean,
  systemPrompt?: string
) {
  try {
    const res = await fetch(API_ROUTE_CREATE_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title,
        model: model || MODEL_DEFAULT,
        isAuthenticated,
        systemPrompt,
      }),
    })
    const responseData = (await res.json()) as any

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to create chat: ${res.status} ${res.statusText}`
      )
    }

    return responseData.chatId
  } catch (error) {
    // Error creating new chat
    throw error
  }
}

export async function createGuestUser(guestId: string) {
  // Creating guest user
  if (!guestId) {
    throw new Error("Guest ID is required to create a guest user.")
  }
  try {
    const res = await fetch(API_ROUTE_CREATE_GUEST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: guestId }),
    })
    const responseData = (await res.json()) as any
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to create guest user: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (err) {
    // Error creating guest user
    throw err
  }
}

export class UsageLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_LIMIT_REACHED"
  }
}

export async function checkUsage(supabase: SupabaseClient, userId: string) {
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select(
      "message_count, daily_message_count, daily_reset, anonymous, premium"
    )
    .eq("id", userId)
    .maybeSingle()

  if (userDataError) {
    throw new Error("Error fetching user data: " + userDataError.message)
  }
  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  const isAnonymous = userData.anonymous

  const dailyLimit = isAnonymous
    ? NON_AUTH_DAILY_MESSAGE_LIMIT
    : AUTH_DAILY_MESSAGE_LIMIT

  const now = new Date()
  let dailyCount = userData.daily_message_count || 0
  const lastReset = userData.daily_reset ? new Date(userData.daily_reset) : null

  if (
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()
  ) {
    dailyCount = 0
    const { error: resetError } = await supabase
      .from("users")
      .update({ daily_message_count: 0, daily_reset: now.toISOString() })
      .eq("id", userId)
    if (resetError) {
      throw new Error("Failed to reset daily count: " + resetError.message)
    }
  }

  if (dailyCount >= dailyLimit) {
    throw new UsageLimitError("Daily message limit reached.")
  }

  return {
    userData,
    dailyCount,
    dailyLimit,
  }
}

export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string,
  currentCounts?: { messageCount: number; dailyCount: number }
): Promise<void> {
  let messageCount: number
  let dailyCount: number

  if (currentCounts) {
    messageCount = currentCounts.messageCount
    dailyCount = currentCounts.dailyCount
  } else {
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("message_count, daily_message_count")
      .eq("id", userId)
      .maybeSingle()

    if (userDataError || !userData) {
      throw new Error(
        "Error fetching user data: " +
          (userDataError?.message || "User not found")
      )
    }

    messageCount = userData.message_count || 0
    dailyCount = userData.daily_message_count || 0
  }

  const newOverallCount = messageCount + 1
  const newDailyCount = dailyCount + 1

  const { error: updateError } = await supabase
    .from("users")
    .update({
      message_count: newOverallCount,
      daily_message_count: newDailyCount,
    })
    .eq("id", userId)

  if (updateError) {
    throw new Error("Failed to update usage data: " + updateError.message)
  }
}

export async function checkAndIncrementUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { userData, dailyCount } = await checkUsage(supabase, userId)

  await incrementUsage(supabase, userId, {
    messageCount: userData.message_count || 0,
    dailyCount,
  })
}

export async function checkRateLimits(
  userId: string,
  isAuthenticated: boolean
) {
  try {
    const res = await fetch(
      `/api/rate-limits?userId=${userId}&isAuthenticated=${isAuthenticated}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )
    const responseData = (await res.json()) as any
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to check rate limits: ${res.status} ${res.statusText}`
      )
    }
    return responseData
  } catch (err) {
    // Error checking rate limits
    throw err
  }
}

export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetch(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = (await res.json()) as any

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (error) {
    // Error updating chat model
    throw error
  }
}

export async function signInWithGoogle(supabase: SupabaseClient): Promise<any> {
  try {
    const isDev = getenv("NODE_ENV") === "development"

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : isDev
          ? "http://localhost:3000"
          : getenv("NEXT_PUBLIC_VERCEL_URL")
            ? `https://${getenv("NEXT_PUBLIC_VERCEL_URL")}`
            : APP_DOMAIN

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  } catch (err) {
    // Error signing in with Google
    throw err
  }
}
