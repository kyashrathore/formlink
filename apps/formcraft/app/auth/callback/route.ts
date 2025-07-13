import { analytics } from "@/app/lib/analytics"
import { MODEL_DEFAULT } from "@/app/lib/config"
import { getenv } from "@/lib/env"
import { createGuestServerClient, createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import posthog from "posthog-js"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const supabaseAdmin = await createGuestServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (data?.user && data.user.email) {
        try {
          const { error: upsertError } = await supabaseAdmin
            .from("users")
            .upsert(
              {
                id: data.user.id,
                email: data.user.email,
                premium: false,
                message_count: 0,
                created_at: new Date().toISOString(),
                preferred_model: MODEL_DEFAULT,
              },
              { onConflict: "id" }
            )

          if (upsertError) {
            console.error("Error upserting user:", upsertError)
          }
        } catch (err) {
          console.error("Error in user upsert:", err)
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host")
      const isLocalEnv = getenv("NODE_ENV") === "development"
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      console.error("Auth error:", error)
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent(error.message)}`
      )
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/error?message=${encodeURIComponent(
      "Missing authentication code"
    )}`
  )
}
