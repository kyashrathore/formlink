"use client"

import { Button } from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import { CheckCircle2, Circle, Plug } from "lucide-react"
import React from "react"

export type ActionItem = {
  slug: string
  label: string
  provider: string
  toolkit?: string
  status: string
  configured: boolean
  configLabel?: string
  toolSlug?: string
  toolLabel?: string
  uiStatus?: "ready" | "needs_auth" | "needs_setup"
}

export type ConnectStage =
  | "idle"
  | "generating"
  | "awaiting_user"
  | "verifying"
  | "done"
  | "error"

export function AuthSteps({
  currentItem,
  currentAuthReady,
  redirectAuthLink,
  connectStage,
  setConnectStage,
  connectError,
  setConnectError,
  formId,
  derivedToolkit,
  setLastAuthLinkByToolkit,
  setPollingSlug,
  refreshTools,
  setAuthingSlug,
}: {
  currentItem: ActionItem
  currentAuthReady: boolean
  redirectAuthLink?: string
  connectStage: ConnectStage
  setConnectStage: (s: ConnectStage) => void
  connectError: string | null
  setConnectError: (s: string | null) => void
  formId?: string
  derivedToolkit: string
  setLastAuthLinkByToolkit: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >
  setPollingSlug: (s: string | null) => void
  refreshTools: () => void
  setAuthingSlug: (slug: string | null) => void
}) {
  if (!(currentItem.provider === "composio" && currentItem.status !== "Ready"))
    return null
  return (
    <div className="mt-2 space-y-3">
      {/* Step 1 */}
      <div className="relative flex items-start gap-2 text-sm">
        {currentAuthReady || redirectAuthLink ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Circle className="text-muted-foreground h-4 w-4" />
        )}
        <div className="flex-1">
          <div className="font-medium">Generate OAuth URL</div>
          <div className="text-muted-foreground text-xs">
            Create a secure authorization link.
          </div>
          {!currentAuthReady && !redirectAuthLink ? (
            <div className="mt-2">
              <Button
                size="sm"
                className="h-7 px-2.5 text-sm"
                onClick={async () => {
                  if (!formId) return
                  try {
                    setConnectError(null)
                    setConnectStage("generating")
                    setAuthingSlug(currentItem.slug)
                    const res = await fetch("/api/actions/authorize", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        formId,
                        toolkit: derivedToolkit,
                        toolSlug: currentItem.slug,
                      }),
                      credentials: "include",
                    })
                    if (res.ok) {
                      const json = await res.json().catch(() => ({}) as any)
                      const link = (json as any)?.link?.redirectUrl
                      if (link) {
                        setLastAuthLinkByToolkit((prev) => ({
                          ...prev,
                          [derivedToolkit]: link,
                        }))
                        setConnectStage("awaiting_user")
                      }
                      setPollingSlug(currentItem.slug)
                      refreshTools()
                    } else {
                      const text = await res.text().catch(() => "")
                      setConnectError(
                        text || `Authorization failed (${res.status})`
                      )
                      setConnectStage("error")
                    }
                  } finally {
                    setAuthingSlug(null)
                  }
                }}
              >
                {connectStage === "generating" ? (
                  <>Generating…</>
                ) : (
                  <>
                    <Plug className="mr-1 h-3 w-3" /> Generate OAuth URL
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "absolute top-5 left-2 h-8 w-0.5",
            connectStage !== "idle" ? "bg-primary" : "bg-muted"
          )}
        />
      </div>

      {/* Step 2 */}
      <div className="relative flex items-start gap-2 text-sm">
        {currentAuthReady ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Circle className="text-muted-foreground h-4 w-4" />
        )}
        <div className="flex-1">
          <div className="font-medium">Authorize in provider</div>
          <div className="text-muted-foreground text-xs">
            Open the provider link to finish sign‑in.
          </div>
          {!currentAuthReady && redirectAuthLink ? (
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-sm"
                onClick={() => {
                  try {
                    window.open(
                      redirectAuthLink,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  } catch {}
                  setConnectStage("awaiting_user")
                }}
              >
                Open authorization
              </Button>
            </div>
          ) : null}
          {connectError ? (
            <div className="text-destructive mt-1 text-xs">{connectError}</div>
          ) : null}
        </div>
        <div
          className={cn(
            "absolute top-5 left-2 h-8 w-0.5",
            connectStage === "awaiting_user" ||
              connectStage === "verifying" ||
              connectStage === "done"
              ? "bg-primary"
              : "bg-muted"
          )}
        />
      </div>
      {/* Step 3 hint is shown by config section below */}
    </div>
  )
}
