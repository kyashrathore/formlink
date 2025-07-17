import { createGuestServerClient, createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = "AuthError"
  }
}

interface AuthResult {
  user: {
    id: string
    email?: string
  }
  isGuest: boolean
}

async function validateGuestUser(
  guestToken: string
): Promise<AuthResult | null> {
  try {
    // For now, guest token is just the userId
    // In production, this should be a JWT or encrypted token
    const guestUserId = guestToken

    const supabase = await createGuestServerClient()
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, anonymous")
      .eq("id", guestUserId)
      .eq("anonymous", true)
      .single()

    if (error || !user) {
      return null
    }

    return {
      user: { id: user.id, email: user.email },
      isGuest: true,
    }
  } catch (error) {
    console.error("Error validating guest user:", error)
    return null
  }
}

export async function requireAuth(request: Request): Promise<AuthResult> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  // Try authenticated user first
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!error && user) {
    return {
      user: { id: user.id, email: user.email },
      isGuest: false,
    }
  }

  // Check for guest user token
  const guestToken = request.headers.get("X-Guest-Token")
  if (guestToken) {
    const guestResult = await validateGuestUser(guestToken)
    if (guestResult) {
      return guestResult
    }
  }

  throw new AuthError("Unauthorized")
}

export async function optionalAuth(
  request: Request
): Promise<AuthResult | null> {
  try {
    return await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return null
    }
    throw error
  }
}

// Helper to create consistent error responses
export function authErrorResponse(error: AuthError) {
  return NextResponse.json(
    { error: error.message },
    { status: error.statusCode }
  )
}
