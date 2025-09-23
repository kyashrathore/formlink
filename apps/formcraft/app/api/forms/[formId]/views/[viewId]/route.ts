import logger from "@/app/lib/logger"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const actionInViewSchema = z.object({
  slug: z.string().min(1),
  provider: z.string().optional(),
  toolkit: z.string().optional(),
  tool_connection_id: z.string().min(1).optional(),
  params: z.record(z.any()).optional(),
})

// Update an existing saved response view owned by the user
// Body shape (partial updates allowed):
// {
//   name?: string,
//   description?: string,
//   columns?: string[],
//   filters?: Array<{ id: string; value: unknown }>,
//   sort?: { by: string; dir: "asc"|"desc" }
// }
export async function PUT(req: NextRequest, ctx: any) {
  const params = (ctx && (await ctx.params)) || ({} as any)
  try {
    const auth = await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as any
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    // Build update object safely
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (typeof body.name === "string" && body.name.trim().length > 0) {
      patch.name = body.name.trim()
    }
    if (typeof body.description === "string") {
      patch.description = body.description
    }
    if (Array.isArray(body.columns)) {
      patch.columns = body.columns
    }
    if (Array.isArray(body.filters)) {
      patch.filters = body.filters
    }
    if (body.sort && typeof body.sort === "object") {
      patch.sort_config = body.sort
    }
    if (Array.isArray((body as any).insights_spec)) {
      patch.insights_spec = (body as any).insights_spec
    }
    if (Array.isArray((body as any).actionSlugs)) {
      patch.action_slugs = (body as any).actionSlugs.filter(
        (s: unknown) => typeof s === "string"
      )
    }
    if (Array.isArray((body as any).action_slugs)) {
      patch.action_slugs = (body as any).action_slugs.filter(
        (s: unknown) => typeof s === "string"
      )
    }

    // New: per-view actions (validated)
    if (Array.isArray((body as any).actions)) {
      const parsed = z
        .array(actionInViewSchema)
        .safeParse((body as any).actions)
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid actions payload",
            issues: parsed.error.issues,
          },
          { status: 422 }
        )
      }
      patch.actions = parsed.data
      // Derive action_slugs from provided actions when present
      const derived = parsed.data.map((a) => a.slug).filter(Boolean)
      if (derived.length) {
        patch.action_slugs = derived
      }
    }

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ success: true })
    }

    const { error } = await (supabase as any)
      .from("response_views")
      .update(patch)
      .eq("id", params.viewId)
      .eq("form_id", params.formId)
      .eq("user_id", auth.user.id)
      .select("id")
      .single()

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error?.("[views] update failed", {
      error: error instanceof Error ? error.message : String(error),
      params: ctx?.params,
    })
    return authErrorResponse({
      name: "Error",
      message: (error as Error).message,
      statusCode: 500,
    })
  }
}

// Get a single saved view (owned by the user)
export async function GET(req: NextRequest, ctx: any) {
  const params = (ctx && ctx.params) || ({} as any)
  try {
    const auth = await requireAuth(req)
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data, error } = await (supabase as any)
      .from("response_views")
      .select(
        "id, form_id, user_id, name, description, filters, columns, sort_config, insights_spec, action_slugs, actions, is_default, is_public, public_access_level, public_api_key_required, created_at, updated_at"
      )
      .eq("id", params.viewId)
      .eq("form_id", params.formId)
      .eq("user_id", auth.user.id)
      .single()
    if (error) throw error
    const view = {
      ...(data as any),
      actions: Array.isArray((data as any)?.actions)
        ? (data as any).actions
        : [],
    }
    return NextResponse.json({ success: true, view })
  } catch (error) {
    return authErrorResponse({
      name: "Error",
      message: (error as Error).message,
      statusCode: 500,
    })
  }
}

// Delete a saved view (owned by the user)
export async function DELETE(req: NextRequest, ctx: any) {
  const params = (ctx && ctx.params) || ({} as any)
  try {
    const auth = await requireAuth(req)
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { error } = await (supabase as any)
      .from("response_views")
      .delete()
      .eq("id", params.viewId)
      .eq("form_id", params.formId)
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
