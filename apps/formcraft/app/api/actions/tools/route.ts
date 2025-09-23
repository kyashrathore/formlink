import type { ActionToolSummary } from "@/app/lib/actions/api-types"
import { getAllowedComposioToolkits } from "@/app/lib/actions/catalog"
import { getComposioClient } from "@/app/lib/actions/composio-client"
import { ActionExecutionError } from "@/app/lib/actions/errors"
import {
  CURATED_ACTIONS,
  getCuratedActionsByToolkit,
} from "@/app/lib/actions/registry"
import logger from "@/app/lib/logger"
import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  formId: z.string().uuid(),
  search: z.string().optional(),
  toolkits: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(),
  viewId: z.string().uuid().optional(),
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

  const { formId, search, toolkits, limit, viewId } = parsed.data
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

  const allowedToolkits = getAllowedComposioToolkits()
  const allowedToolkitSlugs = new Set(allowedToolkits.map((t) => t.toolkit))
  const requestedToolkits =
    toolkits && toolkits.length
      ? toolkits.filter((toolkit) => allowedToolkitSlugs.has(toolkit))
      : Array.from(allowedToolkitSlugs)

  if (toolkits && toolkits.length && !requestedToolkits.length) {
    return NextResponse.json(
      { success: false, error: "Requested toolkits are not permitted" },
      { status: 403 }
    )
  }

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  // Load global tool connection states for this user
  const { data: connRows, error: connError } = await supabase
    .from("tool_connections")
    .select("toolkit, auth_status, connected_account_id")
    .eq("user_id", auth.user.id)

  if (connError) {
    logger.error?.("[actions] failed to load tool_connections", {
      error: connError.message,
    })
  }
  const authByToolkit = new Map<
    string,
    { auth_status: string; connected_account_id: string | null }
  >()
  for (const row of connRows || []) {
    authByToolkit.set(row.toolkit, {
      auth_status: row.auth_status,
      connected_account_id: row.connected_account_id,
    })
  }

  const unifiedTools: (ActionToolSummary & {
    uiStatus?: "needs_auth" | "needs_setup" | "ready"
  })[] = []

  // Optionally load per-view actions for readiness computation
  let viewActions: Array<{ slug: string; params?: Record<string, unknown> }> =
    []
  if (viewId) {
    try {
      const { data: viewRow } = await (supabase as any)
        .from("response_views")
        .select("id, user_id, form_id, actions")
        .eq("id", viewId)
        .eq("form_id", formId)
        .eq("user_id", auth.user.id)
        .maybeSingle()
      if (viewRow && Array.isArray((viewRow as any).actions)) {
        viewActions = ((viewRow as any).actions as any[]).map((a) => ({
          slug: a?.slug,
          params: a?.params || {},
        }))
      }
    } catch (e) {
      // best-effort; ignore
    }
  }

  // Always include curated email action (usesend)
  const emailAction = CURATED_ACTIONS.find(
    (action) => action.provider === "usesend"
  )
  if (emailAction) {
    const usesendReady = Boolean(process.env.USE_SEND_API_KEY)
    unifiedTools.push({
      slug: emailAction.slug,
      label: emailAction.label,
      description: emailAction.description,
      provider: "usesend",
      requiredScopes: emailAction.requiredScopes,
      authStatus: usesendReady ? "connected" : "not_configured",
      configured: usesendReady,
      connectedAccountId: null,
    })
  }

  // Prefer curated catalog + DB auth states; skip remote Composio listing.
  const curatedComposio = requestedToolkits.length
    ? requestedToolkits.flatMap((toolkit) =>
        getCuratedActionsByToolkit(toolkit).filter(
          (action) => action.provider === "composio"
        )
      )
    : getCuratedActionsByToolkit(undefined).filter(
        (action) => action.provider === "composio"
      )

  for (const action of curatedComposio) {
    const auth = authByToolkit.get(action.toolkit || "")
    const authStatus = auth?.auth_status ?? "unknown"
    let configured = false
    if (viewActions.length) {
      const entry = viewActions.find((a) => a.slug === action.slug)
      if (entry) {
        configured = Boolean(
          entry.params && Object.keys(entry.params || {}).length
        )
      }
    }
    unifiedTools.push({
      slug: action.slug,
      label: action.label,
      description: action.description,
      provider: action.provider,
      toolkit: action.toolkit,
      requiredScopes: action.requiredScopes,
      authStatus,
      connectedAccountId: auth?.connected_account_id ?? null,
      configured,
      uiStatus: viewId
        ? authStatus === "connected" || authStatus === "ready"
          ? configured
            ? "ready"
            : "needs_setup"
          : "needs_auth"
        : undefined,
    })
  }

  return NextResponse.json({
    success: true,
    enabled: true,
    tools: unifiedTools,
  })

  try {
    const client = getComposioClient()
    const composioResults = search
      ? await client.searchTools({
          userId: auth.user.id,
          query: search,
          toolkits: requestedToolkits.length ? requestedToolkits : undefined,
          limit,
        })
      : await client.getTools({
          userId: auth.user.id,
          toolkits: requestedToolkits.length ? requestedToolkits : undefined,
          limit,
        })

    const toolSlugs = Array.from(
      new Set(
        (composioResults || [])
          .map((tool) => tool.slug || tool.name)
          .filter((slug): slug is string => Boolean(slug))
      )
    )

    let authStates: Record<
      string,
      { status: string; connectedAccountId?: string }
    > = {}
    if (toolSlugs.length) {
      try {
        const states = await client.getToolAuthStates({
          userId: auth.user.id,
          toolSlugs,
        })
        authStates = Object.fromEntries(
          states.map((state) => [state.toolSlug, state])
        )
      } catch (err: any) {
        logger.warn?.("[actions] failed to fetch Composio auth states", {
          error: err instanceof Error ? err.message : String(err as any),
        })
      }
    }

    let addedComposio = 0
    for (const tool of composioResults || []) {
      const slug = tool.slug || tool.name
      if (!slug) continue
      const authInfo = authStates[slug] || null
      const auth = authByToolkit.get(tool.toolkit || "")
      const dbStatus = auth?.auth_status
      const preferredAuth =
        dbStatus && dbStatus !== "unknown" ? dbStatus : authInfo?.status
      const authStatus = preferredAuth || "unknown"
      // view-aware readiness
      let configured = false
      if (viewActions.length) {
        const entry = viewActions.find((a) => a.slug === slug)
        // Deprecate curated required params; consider configured when any params exist
        configured = Boolean(
          entry?.params && Object.keys(entry?.params || {}).length
        )
      }
      unifiedTools.push({
        slug,
        label: tool.name || slug,
        description: tool.description,
        provider: "composio",
        toolkit: tool.toolkit,
        requiredScopes: tool.scopes,
        authStatus,
        connectedAccountId:
          authInfo?.connectedAccountId ?? auth?.connected_account_id ?? null,
        configured,
        uiStatus: viewId
          ? authStatus === "connected" || authStatus === "ready"
            ? configured
              ? "ready"
              : "needs_setup"
            : "needs_auth"
          : undefined,
      })
      addedComposio++
    }

    // If Composio returned no tools (or the SDK is filtered oddly), ensure
    // curated Composio actions are still shown alongside useSend.
    if (addedComposio === 0) {
      const fallback = requestedToolkits.length
        ? requestedToolkits.flatMap((toolkit) =>
            getCuratedActionsByToolkit(toolkit).filter(
              (action) => action.provider === "composio"
            )
          )
        : getCuratedActionsByToolkit(undefined).filter(
            (action) => action.provider === "composio"
          )

      for (const action of fallback) {
        const authStatus =
          authByToolkit.get(action.toolkit || "")?.auth_status ?? "unknown"
        // view-aware readiness
        let configured = false
        if (viewActions.length) {
          const entry = viewActions.find((a) => a.slug === action.slug)
          configured = Boolean(
            entry?.params && Object.keys(entry?.params || {}).length
          )
        }
        unifiedTools.push({
          slug: action.slug,
          label: action.label,
          description: action.description,
          provider: action.provider,
          toolkit: action.toolkit,
          requiredScopes: action.requiredScopes,
          authStatus,
          connectedAccountId:
            authByToolkit.get(action.toolkit || "")?.connected_account_id ??
            null,
          configured,
          uiStatus: viewId
            ? authStatus === "connected" || authStatus === "ready"
              ? configured
                ? "ready"
                : "needs_setup"
              : "needs_auth"
            : undefined,
        })
      }
    }

    // Note: legacy per-form configs removed; readiness derives from auth + view params

    return NextResponse.json({
      success: true,
      enabled: true,
      tools: unifiedTools,
    })
  } catch (err: any) {
    const status = err instanceof ActionExecutionError ? err.status : 500
    const message = err instanceof Error ? err.message : "Failed to load tools"

    logger.error?.("[actions] composio tools fetch failed", {
      error: message,
    })

    return NextResponse.json({ success: false, error: message }, { status })
  }
}
