import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, ctx: any) {
  const params = (ctx && ctx.params) || ({} as any)
  try {
    const auth = await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as any
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data, error } = await (supabase as any)
      .from("formlink_api_keys")
      .update({
        name: body.name,
        permissions: body.permissions,
        allowed_origins: body.allowed_origins,
        allowed_ips: body.allowed_ips,
        rate_limit_per_minute: body.rate_limit_per_minute,
        view_access: body.view_access,
        is_active: body.is_active,
        expires_at: body.expires_at,
      })
      .eq("id", params.keyId)
      .eq("user_id", auth.user.id)
      .select("id")
      .single()
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse({
      name: "Error",
      message: (error as Error).message,
      statusCode: 500,
    })
  }
}

export async function DELETE(req: NextRequest, ctx: any) {
  const params = (ctx && ctx.params) || ({} as any)
  try {
    const auth = await requireAuth(req)
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { error } = await (supabase as any)
      .from("formlink_api_keys")
      .delete()
      .eq("id", params.keyId)
      .eq("user_id", auth.user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse({
      name: "Error",
      message: (error as Error).message,
      statusCode: 500,
    })
  }
}
