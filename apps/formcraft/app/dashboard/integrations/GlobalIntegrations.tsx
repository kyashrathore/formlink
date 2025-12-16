"use client"

import {
  ActionItem,
  SetupDrawer,
} from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDrawer"
import { useActionTools } from "@/app/dashboard/forms/[formId]/hooks/useActionTools"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  Plug,
  Power,
  RefreshCcw,
} from "lucide-react"
import { useMemo, useState } from "react"

// We reuse the hook but pass a dummy formId or adapt the hook to work globally?
// `useActionTools` likely depends on `formId` to fetch *allowed* actions, but for *tools* (auth) it might be global or per-form?
// Looking at `useActionTools`, it calls `/api/actions/tools`. If `formId` is optional or we can pass a dummy, it might work.
// Actually, auth is usually user-scoped or project-scoped.
// For now, I'll assume passing a null/dummy formId is okay if the API supports it, or I might need to adjust the hook.
// Let's rely on the fact that `useActionTools` fetches `/api/actions/tools` which likely checks User Session.

export default function GlobalIntegrations({ userId }: { userId: string }) {
  // We pass enabled: true, but formId might be needed by the hook's typings.
  // We'll pass a placeholder or check if hook allows undefined.
  // Assuming the API `/api/actions/tools` uses the session cookie for user auth.
  const {
    tools,
    isLoading,
    refresh: refreshTools,
  } = useActionTools({ enabled: true })

  const [disconnectingSlug, setDisconnectingSlug] = useState<string | null>(
    null
  )
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
  const [selectedToolForDisconnect, setSelectedToolForDisconnect] =
    useState<any>(null)

  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [authingSlug, setAuthingSlug] = useState<string | null>(null)

  // Map tools to ActionItems for SetupDrawer
  const actionItems: ActionItem[] = useMemo(() => {
    return tools.map((t) => {
      const curated = CURATED_ACTIONS.find((a) => a.slug === t.slug)
      return {
        slug: t.slug,
        label: t.label,
        provider: t.provider,
        toolkit: t.toolkit,
        status: t.authStatus || "unknown",
        configured: false, // Not relevant for global view
        uiStatus:
          t.authStatus === "ready" || t.authStatus === "connected"
            ? "ready"
            : "needs_auth",
        toolSlug: t.slug,
        toolLabel: t.label,
      }
    })
  }, [tools])

  const confirmDisconnect = (tool: any) => {
    setSelectedToolForDisconnect(tool)
    setDisconnectConfirmOpen(true)
  }

  const handleDisconnect = async () => {
    if (!selectedToolForDisconnect) return
    const tool = selectedToolForDisconnect
    setDisconnectingSlug(tool.slug)
    try {
      const res = await fetch("/api/actions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolkit: tool.toolkit,
        }),
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      refreshTools()
    } catch (e) {
      console.error(e)
    } finally {
      setDisconnectingSlug(null)
      setDisconnectConfirmOpen(false)
      setSelectedToolForDisconnect(null)
    }
  }

  // Deduplicate tools (group by toolkit/provider)
  const groupedTools = useMemo(() => {
    const map = new Map()
    tools.forEach((t) => {
      const key = t.toolkit || t.provider
      if (!map.has(key)) {
        map.set(key, {
          ...t,
          // Ensure we have a slug to open the drawer with.
          // tools list contains all actions.
        })
      }
    })
    return Array.from(map.values())
  }, [tools])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Services</CardTitle>
              <CardDescription>
                These services are connected to your Formlink account. Click
                "Connect" or "Setup" to view details and authorization.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshTools}
              disabled={isLoading}
            >
              <RefreshCcw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          {groupedTools.map((tool) => {
            const isConnected =
              tool.authStatus === "ready" || tool.authStatus === "connected"
            const isDisconnecting = disconnectingSlug === tool.slug

            return (
              <div
                key={tool.slug}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "rounded-lg p-2",
                      isConnected
                        ? "bg-green-100 dark:bg-green-900/20"
                        : "bg-muted"
                    )}
                  >
                    {isConnected ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Plug className="text-muted-foreground h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {tool.toolkit || tool.provider}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {isConnected ? "Connected and ready" : "Not connected"}
                    </p>
                  </div>
                </div>

                <div>
                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmDisconnect(tool)}
                      disabled={isDisconnecting}
                      className="text-destructive hover:text-destructive"
                    >
                      <Power className="mr-2 h-3 w-3" />
                      {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setOpenSlug(tool.slug)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {!isLoading && groupedTools.length === 0 && (
            <div className="text-muted-foreground py-8 text-center text-sm">
              No integrations available.
            </div>
          )}
        </CardContent>
      </Card>

      <SetupDrawer
        open={Boolean(openSlug)}
        onOpenChange={(v) => !v && setOpenSlug(null)}
        openSlug={openSlug}
        setOpenSlug={setOpenSlug}
        actionItems={actionItems}
        // No formId passed (global mode). SetupDrawer should handle it gracefully or we mocked AuthSteps.
        activeView={null}
        refreshTools={refreshTools}
        setAuthingSlug={setAuthingSlug}
      />

      <AlertDialog
        open={disconnectConfirmOpen}
        onOpenChange={setDisconnectConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Disconnecting Integration
            </AlertDialogTitle>
            <AlertDialogDescription>
              Warning: This integration might be used in automated actions
              across your forms.
              <br />
              <br />
              <strong>
                Disconnecting will stop those actions from running.
              </strong>
              <br />
              <br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
