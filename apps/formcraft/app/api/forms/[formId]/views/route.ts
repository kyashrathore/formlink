import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
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

// List all saved views for a form owned by the current user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    const auth = await requireAuth(req)
    const ownership = await verifyUserOwnsForm(formId, auth.user.id)
    if (!ownership.formExists) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      )
    }
    if (!ownership.isOwner) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this form" },
        { status: 403 }
      )
    }
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data, error } = await (supabase as any)
      .from("response_views")
      .select(
        "id, form_id, user_id, name, description, filters, columns, sort_config, insights_spec, action_slugs, actions, is_default, is_public, public_access_level, public_api_key_required, created_at, updated_at"
      )
      .eq("form_id", formId)
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
    if (error) throw error
    const views = (data || []).map((row: any) => ({
      ...row,
      // Expose actions for client hydration (default empty)
      actions: Array.isArray(row?.actions) ? row.actions : [],
    }))
    return NextResponse.json({ success: true, views })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

// Create a new saved view for the form
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    const auth = await requireAuth(req)
    const ownership = await verifyUserOwnsForm(formId, auth.user.id)
    if (!ownership.formExists) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      )
    }
    if (!ownership.isOwner) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this form" },
        { status: 403 }
      )
    }
    const body = (await req.json().catch(() => ({}))) as any

    const name: string | undefined =
      typeof body.name === "string" ? body.name.trim() : undefined
    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      )
    }

    const description: string | undefined =
      typeof body.description === "string" ? body.description : undefined
    const columns: any[] = Array.isArray(body.columns)
      ? body.columns.filter((c: unknown) => typeof c === "string")
      : []
    const filters: any[] = Array.isArray(body.filters) ? body.filters : []
    const sort =
      body.sort && typeof body.sort === "object" ? body.sort : undefined
    const insightsSpec: any[] | undefined = Array.isArray(body.insights_spec)
      ? body.insights_spec
      : Array.isArray(body.insightsSpec)
        ? body.insightsSpec
        : undefined
    const actionSlugs: string[] | undefined = Array.isArray(body.actionSlugs)
      ? body.actionSlugs.filter((s: unknown) => typeof s === "string")
      : Array.isArray(body.action_slugs)
        ? (body.action_slugs as any[]).filter((s) => typeof s === "string")
        : undefined

    // New: per-view actions (validated) — gated by flag for writes
    let actions: unknown[] | undefined
    if (Array.isArray((body as any).actions)) {
      actions = (body as any).actions
      const parsed = z.array(actionInViewSchema).safeParse(actions)
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
      // derive slugs if not supplied separately
      if (!actionSlugs || !actionSlugs.length) {
        const slugs = parsed.data.map((a) => a.slug).filter(Boolean)
        if (slugs.length) {
          ;(body as any).actionSlugs = slugs
        }
      }
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const insertPayload: Record<string, any> = {
      form_id: formId,
      user_id: auth.user.id,
      name,
      description,
      columns,
      filters,
      sort_config: sort,
    }
    if (insightsSpec) insertPayload.insights_spec = insightsSpec
    if (actionSlugs) insertPayload.action_slugs = actionSlugs
    if (actions) insertPayload.actions = actions

    // Use service role to bypass RLS only for guests (we still enforce ownership above)
    const supabaseWriter = auth.isGuest
      ? await createServerClient(null as any, "service")
      : supabase

    const { data, error } = await (supabaseWriter as any)
      .from("response_views")
      .insert(insertPayload)
      .select(
        "id, form_id, user_id, name, description, filters, columns, sort_config, insights_spec, action_slugs, actions, is_default, is_public, public_access_level, public_api_key_required, created_at, updated_at"
      )
      .single()

    if (error) {
      // Surface PostgREST/Supabase error details to client for debugging
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to create view",
          details: (error as any).details || null,
          hint: (error as any).hint || null,
          code: (error as any).code || null,
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, view: data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
