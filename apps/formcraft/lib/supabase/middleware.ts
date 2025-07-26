import { getenv } from "@/lib/env"
import { ssrCreateServerClient } from "@formlink/db"
import { NextResponse, type NextRequest } from "next/server"

function isLocalSupabase(): boolean {
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === "true") {
    return true
  }

  return process.env.NODE_ENV === "development"
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = isLocalSupabase()
    ? getenv("NEXT_PUBLIC_SUPABASE_LOCAL_URL") || "http://localhost:54321"
    : getenv("NEXT_PUBLIC_SUPABASE_URL")!

  const anonKey = isLocalSupabase()
    ? getenv("NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY") ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    : getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")!

  const supabase = ssrCreateServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  await supabase.auth.getUser()

  return supabaseResponse
}
