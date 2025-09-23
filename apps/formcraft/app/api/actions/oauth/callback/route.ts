import {
  getComposioClient,
  isComposioEnabled,
} from "@/app/lib/actions/composio-client"
import type { ComposioConnectionStatus } from "@/app/lib/actions/types"
import logger from "@/app/lib/logger"
import { createServerClient } from "@formlink/db"
import { NextRequest } from "next/server"
import { z } from "zod"

// Accept multiple param spellings used by providers/SDKs
const querySchema = z.object({
  connectionRequestId: z.string().min(1).optional(),
  connection_request_id: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  request_id: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  connected_account_id: z.string().optional(),
  uid: z.string().uuid().optional(),
  toolkit: z.string().optional(),
})

function renderHtml(message: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8" /><title>Composio Auth</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px;text-align:center;}div{max-width:420px;}button{margin-top:16px;padding:10px 16px;font-size:14px;background:#111827;color:#f9fafb;border:none;border-radius:6px;cursor:pointer;}button:focus{outline:2px solid #6366f1;outline-offset:2px;}</style></head><body><div><h1>Composio Authentication</h1><p>${message}</p><button onclick="window.close()">Close</button></div></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  )
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  logger.info?.("[actions][oauth-callback] request received", {
    params: rawParams,
    composioEnabled: isComposioEnabled(),
  })
  if (!isComposioEnabled()) {
    logger.warn?.("[actions][oauth-callback] composio disabled")
    return renderHtml(
      "Composio integrations are currently disabled. You can close this window."
    )
  }

  const parsed = querySchema.safeParse(rawParams)
  if (!parsed.success) {
    logger.warn?.("[actions][oauth-callback] invalid query params", {
      issues: parsed.error.issues,
    })
    return renderHtml(
      "Missing connection information. Please retry the authorization flow."
    )
  }

  const data = parsed.data
  const connectionRequestId =
    data.connectionRequestId ||
    data.connection_request_id ||
    data.requestId ||
    data.request_id ||
    data.id ||
    ""
  const status = data.status
  const error = data.error
  const connectedAccountIdFromQuery = data.connected_account_id || null
  const uid = data.uid || null
  const toolkit = data.toolkit || null
  logger.info?.("[actions][oauth-callback] normalized params", {
    connectionRequestId: connectionRequestId || null,
    status: status || null,
    error: error || null,
    connectedAccountIdFromQuery,
  })
  if (!connectionRequestId) {
    // Fallback: if provider did not include request id, attempt to attach the
    // connection to the latest pending record.
    if (!connectedAccountIdFromQuery) {
      logger.warn?.(
        "[actions][oauth-callback] missing connectionRequestId and connected_account_id"
      )
      return renderHtml(
        "Missing connection identifier. Please retry the authorization flow."
      )
    }
    try {
      const supabase = await createServerClient(undefined, "service")
      // Prefer explicit state (uid + toolkit) embedded in callback link
      if (uid && toolkit) {
        const { data: existing, error: selErr } = await supabase
          .from("tool_connections")
          .select("id, auth_status")
          .eq("user_id", uid)
          .eq("provider", "composio")
          .eq("toolkit", toolkit)
          .maybeSingle()
        if (selErr) {
          logger.warn?.("[actions][oauth-callback] state lookup failed", {
            error: selErr.message,
          })
        }
        if (existing) {
          await supabase
            .from("tool_connections")
            .update({
              auth_status: "connected",
              connected_account_id: connectedAccountIdFromQuery,
              pending_connection_request_id: null,
            })
            .eq("id", existing.id)
        } else {
          // Create fresh connected row if none exists yet for user/toolkit
          await supabase.from("tool_connections").insert({
            user_id: uid,
            provider: "composio",
            toolkit,
            auth_status: "connected",
            connected_account_id: connectedAccountIdFromQuery,
            pending_connection_request_id: null,
          } as any)
        }
        logger.info?.(
          "[actions][oauth-callback] fallback via state: connected",
          {
            uid,
            toolkit,
          }
        )
        logger.info?.("[actions][oauth-callback] completed", {
          elapsedMs: Date.now() - startedAt,
        })
        return renderHtml(
          "All set! You can close this window and return to Formlink."
        )
      }
      // Legacy fallback (no state): locate any pending row with non-null request id
      const { data: pending, error: listErr } = await supabase
        .from("tool_connections")
        .select("id")
        .not("pending_connection_request_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (listErr || !pending) {
        logger.warn?.(
          "[actions][oauth-callback] fallback: no pending record found",
          { listErr: listErr?.message }
        )
        return renderHtml(
          "We couldn't locate a pending connection. Please start the setup again."
        )
      }
      logger.info?.(
        "[actions][oauth-callback] fallback: attaching account id",
        {
          id: pending.id,
          connectedAccountIdFromQuery,
        }
      )
      await supabase
        .from("tool_connections")
        .update({
          auth_status: "connected",
          connected_account_id: connectedAccountIdFromQuery,
          pending_connection_request_id: null,
        })
        .eq("id", pending.id)
      logger.info?.(
        "[actions][oauth-callback] fallback: updated to connected",
        {
          id: pending.id,
        }
      )
      logger.info?.("[actions][oauth-callback] completed", {
        elapsedMs: Date.now() - startedAt,
      })
      return renderHtml(
        "All set! You can close this window and return to Formlink."
      )
    } catch (err) {
      logger.error?.("[actions][oauth-callback] fallback update failed", {
        error: err instanceof Error ? err.message : String(err),
      })
      return renderHtml(
        "We hit a problem saving the integration status. Please close this window and retry from the dashboard."
      )
    }
  }

  let supabase
  try {
    supabase = await createServerClient(undefined, "service")
  } catch (err) {
    logger.error?.("[actions] failed to create service supabase client", {
      error: err instanceof Error ? err.message : String(err),
    })
    return renderHtml(
      "Unable to update integration status. Please contact support."
    )
  }

  const { data: configRow, error: fetchError } = await supabase
    .from("tool_connections")
    .select("id, user_id, provider, toolkit")
    .eq("pending_connection_request_id", connectionRequestId)
    .maybeSingle()

  if (fetchError) {
    logger.error?.("[actions] failed to lookup pending config", {
      error: fetchError.message,
      connectionRequestId,
    })
    return renderHtml(
      "We couldn't confirm the integration status. Please try reconnecting."
    )
  }

  if (!configRow) {
    logger.warn?.("[actions] no pending config for connection request", {
      connectionRequestId,
    })
    return renderHtml(
      "This authorization link has already been processed. You can close this window."
    )
  }

  let waitResult: ComposioConnectionStatus | null = null
  const normalizedIncoming = (status || "").toLowerCase()
  const shouldAttemptWait =
    !normalizedIncoming || normalizedIncoming !== "error"
  logger.info?.("[actions][oauth-callback] wait decision", {
    normalizedIncoming,
    shouldAttemptWait,
  })

  if (shouldAttemptWait) {
    try {
      logger.info?.("[actions][oauth-callback] waiting for connection", {
        connectionRequestId,
      })
      const client = getComposioClient()
      waitResult = await client.waitForConnection({
        userId: configRow.user_id,
        connectionRequestId,
        timeoutMs: 60_000,
      })
      logger.info?.("[actions][oauth-callback] wait result", {
        status: waitResult?.status || null,
        connectedAccountId: waitResult?.connectedAccountId || null,
      })
    } catch (err) {
      logger.error?.("[actions] waitForConnection failed", {
        error: err instanceof Error ? err.message : String(err),
        connectionRequestId,
      })
    }
  }

  // Normalize various incoming success markers to connected
  let incoming = (status || "pending").toLowerCase()
  if (
    incoming === "success" ||
    incoming === "ok" ||
    incoming === "authorized"
  ) {
    incoming = "connected"
  }
  const resolvedStatus = (waitResult?.status || incoming) as any
  logger.info?.("[actions][oauth-callback] resolved status", {
    resolvedStatus,
  })
  const connectedAccountId = waitResult?.connectedAccountId || null

  const { error: updateError } = await supabase
    .from("tool_connections")
    .update({
      auth_status: resolvedStatus,
      connected_account_id: connectedAccountId,
      pending_connection_request_id: null,
    })
    .eq("id", configRow.id)

  if (updateError) {
    logger.error?.("[actions] failed to update auth status after callback", {
      error: updateError.message,
      configId: configRow.id,
    })
    return renderHtml(
      "We hit a problem saving the integration status. Please close this window and retry from the dashboard."
    )
  }

  if (resolvedStatus === "connected") {
    logger.info?.("[actions][oauth-callback] updated to connected", {
      configId: configRow.id,
      elapsedMs: Date.now() - startedAt,
    })
    return renderHtml(
      "All set! You can close this window and return to Formlink."
    )
  }

  if (error) {
    return renderHtml(
      `Authentication reported an error: ${error}. Please return to Formlink and retry.`
    )
  }

  if (resolvedStatus === "pending") {
    return renderHtml(
      "We are still finalizing the connection. Give it a moment and refresh the Actions panel in Formlink."
    )
  }

  logger.info?.("[actions][oauth-callback] completed non-connected", {
    resolvedStatus,
    elapsedMs: Date.now() - startedAt,
  })
  return renderHtml(
    `Integration status: ${resolvedStatus}. If this looks unexpected, please reconnect from Formlink.`
  )
}
