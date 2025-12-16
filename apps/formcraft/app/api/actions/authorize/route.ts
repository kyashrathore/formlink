import { getAllowedComposioToolkits } from "@/app/lib/actions/catalog"
import {
  getComposioClient,
  isComposioEnabled,
} from "@/app/lib/actions/composio-client"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import logger from "@/app/lib/logger"
import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  formId: z.string().uuid().optional(),
  toolSlug: z.string(),
  authConfigId: z.string().optional(),
  callbackUrl: z.string().url().optional(),
})

export async function POST(request: Request) {
  let auth
  try {
    auth = await requireAuth(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }

  if (!isComposioEnabled()) {
    return NextResponse.json(
      { success: false, error: "Composio integration disabled" },
      { status: 503 }
    )
  }

  const payload = await request.json().catch(() => null)
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload",
        issues: parsed.error.issues,
      },
      { status: 400 }
    )
  }

  const { formId, toolSlug, authConfigId, callbackUrl } = parsed.data

  if (formId) {
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
  }
  // Resolve toolkit strictly from CURATED_ACTIONS using toolSlug
  const allowedToolkits = getAllowedComposioToolkits()
  const curated = CURATED_ACTIONS.find((a) => a.slug === toolSlug)
  if (!curated) {
    return NextResponse.json(
      { success: false, error: "Unknown toolSlug" },
      { status: 404 }
    )
  }
  const resolvedToolkit = curated.toolkit
  if (!resolvedToolkit) {
    return NextResponse.json(
      { success: false, error: "Toolkit not configured for tool" },
      { status: 422 }
    )
  }

  const allowedToolkit = allowedToolkits.find(
    (entry) => entry.toolkit === resolvedToolkit
  )

  if (!allowedToolkit) {
    return NextResponse.json(
      { success: false, error: "Toolkit not permitted" },
      { status: 403 }
    )
  }

  const resolvedAuthConfigId = authConfigId || allowedToolkit.authConfigId
  if (!resolvedAuthConfigId) {
    return NextResponse.json(
      { success: false, error: "Missing authConfigId for toolkit" },
      { status: 422 }
    )
  }

  // Basic sanity check: Composio auth config IDs typically start with "ac_".
  // Catch obvious misconfigurations early (e.g., passing a tool/action slug instead of an auth config id).
  const looksLikeAuthConfigId = /^ac_/i.test(resolvedAuthConfigId)
  if (!looksLikeAuthConfigId) {
    logger.warn?.("[actions] invalid authConfigId shape", {
      toolkit: resolvedToolkit,
    })
    return NextResponse.json(
      {
        success: false,
        error:
          `Invalid authConfigId for toolkit "${resolvedToolkit}". Expected a Composio auth config id (prefix ac_). ` +
          `Set COMPOSIO_${resolvedToolkit.toUpperCase()}_AUTH_CONFIG_ID or pass a valid authConfigId in the request.`,
      },
      { status: 422 }
    )
  }

  // Build callback URL and include correlating state (uid + toolkit) to help
  // the callback route attach the connection when providers omit request id.
  const baseCallback =
    callbackUrl || process.env.ACTIONS_COMPOSIO_CALLBACK_URL || undefined
  let resolvedCallbackUrl = baseCallback
  try {
    if (baseCallback) {
      const u = new URL(baseCallback)
      u.searchParams.set("uid", auth.user.id)
      u.searchParams.set("toolkit", resolvedToolkit)
      resolvedCallbackUrl = u.toString()
    }
  } catch {
    // If baseCallback is malformed, fall back to original
    resolvedCallbackUrl = baseCallback
  }

  try {
    const client = getComposioClient()
    const link = await client.ensureAuth({
      userId: auth.user.id,
      authConfigId: resolvedAuthConfigId,
      callbackUrl: resolvedCallbackUrl,
    })

    // Record/refresh pending connection globally (per user+toolkit) without violating the unique index
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const key = {
      user_id: auth.user.id,
      provider: "composio" as const,
      toolkit: resolvedToolkit,
    }
    // 1) Check if a row already exists
    const { data: existing, error: selectErr } = await supabase
      .from("tool_connections")
      .select("id, auth_status")
      .eq("user_id", key.user_id)
      .eq("provider", key.provider)
      .eq("toolkit", key.toolkit)
      .maybeSingle()
    if (selectErr) {
      logger.warn?.("[actions] pending lookup failed", {
        error: selectErr.message,
      })
    }
    if (existing) {
      if (existing.auth_status !== "connected") {
        // Refresh pending markers on non-connected row
        await supabase
          .from("tool_connections")
          .update({
            pending_connection_request_id: link.connectionRequestId ?? null,
            auth_status: "pending",
            connected_account_id: null,
          })
          .eq("id", existing.id)
      }
      // If already connected, do nothing; we won't create a duplicate
    } else {
      // No row exists; create a fresh pending record
      const insertPayload = {
        ...key,
        auth_status: "pending",
        pending_connection_request_id: link.connectionRequestId ?? null,
        connected_account_id: null as any,
      }
      const { error: insertErr } = await supabase
        .from("tool_connections")
        .insert(insertPayload as any)
      if (insertErr) {
        // Swallow unique violations quietly; everything else gets logged
        if ((insertErr as any).code !== "23505") {
          logger.warn?.("[actions] failed to insert pending tool connection", {
            error: insertErr.message,
          })
        }
      }
    }

    return NextResponse.json({ success: true, link })
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error)
    // Improve signal for a common Composio failure: missing/unknown auth config
    const isAuthConfigNotFound =
      /Auth config not found/i.test(rawMsg) || /"code"\s*:\s*607/.test(rawMsg)
    const userMsg = isAuthConfigNotFound
      ? `Auth config not found for toolkit "${resolvedToolkit}". ` +
        `Verify COMPOSIO_${resolvedToolkit.toUpperCase()}_AUTH_CONFIG_ID belongs to the same Composio workspace as COMPOSIO_API_KEY, or pass a valid authConfigId.`
      : rawMsg

    logger.error?.("[actions] authorize failed", {
      error: rawMsg,
      toolkit: resolvedToolkit,
    })
    return NextResponse.json(
      {
        success: false,
        error: userMsg,
      },
      { status: 500 }
    )
  }
}
