import crypto from "node:crypto"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { createServerClient } from "@formlink/db"
import { customAlphabet } from "nanoid"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  30
)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data, error } = await (supabase as any)
      .from("formlink_api_keys")
      .select(
        "id, name, key_prefix, permissions, is_active, last_used_at, usage_count, created_at, expires_at"
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
    if (error) throw error
    return NextResponse.json({ keys: data || [] })
  } catch (error) {
    const msg = (error as any)?.message || String(error)
    const lower = msg.toLowerCase()
    if (lower.includes("relation") && lower.includes("does not exist")) {
      return NextResponse.json(
        {
          error: "api_keys_table_missing",
          message:
            "formlink_api_keys table not found. Apply DB migrations in packages/db/src/migrations and restart Supabase.",
        },
        { status: 501 }
      )
    }
    if (
      lower.includes("no row-level security policy") ||
      lower.includes("violates row-level security policy") ||
      lower.includes("permission denied")
    ) {
      return NextResponse.json(
        {
          error: "api_keys_rls_denied",
          message:
            "RLS prevents access to API keys. Ensure RLS policies from migrations are applied.",
        },
        { status: 501 }
      )
    }
    return authErrorResponse({ name: "Error", message: msg, statusCode: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    const body = (await req.json()) as {
      name: string
      permissions?: string[]
      allowed_origins?: string[]
      allowed_ips?: string[]
      rate_limit_per_minute?: number
      view_access?: Record<string, string>
      expires_at?: string
    }
    if (!body?.name)
      return NextResponse.json({ error: "Missing name" }, { status: 400 })

    const fullKey = `fl_api_${nanoid(32)}`
    const keyPrefix = fullKey.slice(0, 10)
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex")

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const insert = {
      name: body.name,
      user_id: auth.user.id,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      permissions: body.permissions || ["read_responses"],
      allowed_origins: body.allowed_origins || null,
      allowed_ips: (body.allowed_ips as any) || null,
      rate_limit_per_minute: body.rate_limit_per_minute || 100,
      view_access: body.view_access || null,
      expires_at: body.expires_at || null,
    }
    const { data, error } = await (supabase as any)
      .from("formlink_api_keys")
      .insert(insert)
      .select("id, name, key_prefix, permissions, created_at")
      .single()
    if (error) throw error

    return NextResponse.json({ ...data, key: fullKey })
  } catch (error) {
    const msg = (error as any)?.message || String(error)
    const lower = msg.toLowerCase()
    if (lower.includes("relation") && lower.includes("does not exist")) {
      return NextResponse.json(
        { error: "api_keys_table_missing" },
        { status: 501 }
      )
    }
    if (
      lower.includes("row-level security") ||
      lower.includes("permission denied")
    ) {
      return NextResponse.json(
        { error: "api_keys_rls_denied" },
        { status: 501 }
      )
    }
    return authErrorResponse({ name: "Error", message: msg, statusCode: 500 })
  }
}
