"use client"

import { SetupDrawer } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDrawer"
import { requiresParamsForSlug } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { useActionTools } from "@/app/dashboard/forms/[formId]/hooks/useActionTools"
import {
  useAutomationsConfig,
  type LifecycleAllowedAction,
} from "@/app/dashboard/forms/[formId]/hooks/useAutomationsConfig"
import { useResponseViewsStore } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@formlink/ui"
import { Bot } from "lucide-react"
import { useMemo, useState } from "react"

type Mode = "lifecycle" | "view"

interface ActionsManagerCardProps {
  formId: string
  mode: Mode
  actions?: Array<{
    slug: string
    provider: "usesend" | "composio"
    params?: Record<string, unknown>
  }>
  showHeader?: boolean
}

const DEFAULT_VIEW_ID = "default"
const GLOBAL_FORM_ID = "__global__"

export function ActionsManagerCard(props: ActionsManagerCardProps) {
  const { formId, mode, actions, showHeader } = props
  const [pendingSlug, setPendingSlug] = useState("")
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const { tools, refresh: refreshTools } = useActionTools({
    formId,
    enabled: Boolean(formId),
  })

  // Lifecycle config path
  const {
    config,
    helpers,
    isSaving: lifecycleSaving,
  } = useAutomationsConfig(mode === "lifecycle" ? formId : undefined)

  // Active view path
  const activeView = useResponseViewsStore((s) => {
    const id = s.activeViewIdMap[formId] || DEFAULT_VIEW_ID
    return (
      s.views.find((v) => v.id === id) ||
      s.views.find((v) => v.id === DEFAULT_VIEW_ID) ||
      null
    )
  })

  // Build configured + proposed union depending on mode
  const configured: Array<{
    slug: string
    provider: "usesend" | "composio"
    params?: Record<string, unknown>
  }> = useMemo(() => {
    if (mode === "lifecycle") {
      return (config.allowedActions || []).map((a) => ({
        slug: a.slug,
        provider: a.provider,
        params: a.params,
      }))
    }
    const acts = Array.isArray((activeView as any)?.actions)
      ? ((activeView as any).actions as any[]) || []
      : []
    return acts.map((a: any) => ({
      slug: a.slug,
      provider: (a.provider || "composio") as any,
      params: a.params || {},
    }))
  }, [mode, config.allowedActions, (activeView as any)?.actions])

  const configuredSlugs = useMemo(
    () => new Set(configured.map((a) => a.slug)),
    [configured]
  )

  const proposed = useMemo(() => {
    const arr = Array.isArray(actions) ? actions : []
    return arr.filter((a) => a.slug && !configuredSlugs.has(a.slug))
  }, [actions, configuredSlugs])

  const union = useMemo(
    () => [
      ...configured.map((a) => ({ ...a, proposed: false })),
      ...proposed.map((a) => ({ ...a, proposed: true })),
    ],
    [configured, proposed]
  )

  const addActionOptions = useMemo(
    () =>
      CURATED_ACTIONS.filter((opt) => !configuredSlugs.has(opt.slug)).map(
        (opt) => ({ value: opt.slug, label: opt.label })
      ),
    [configuredSlugs]
  )

  // Add/remove handlers
  const addAction = async (slug: string) => {
    const meta = CURATED_ACTIONS.find((a) => a.slug === slug)
    const provider = (meta?.provider || "composio") as "usesend" | "composio"
    if (mode === "lifecycle") {
      const exists = (config.allowedActions || []).some((a) => a.slug === slug)
      if (exists) return
      const next = [
        ...((config.allowedActions || []) as LifecycleAllowedAction[]),
        { slug, provider, params: {} },
      ]
      await helpers.syncAllowedActions(next)
      return
    }
    // view mode: update active view in store and persist
    const view = activeView as any
    const nextActs = Array.isArray(view?.actions)
      ? [...(view.actions as any[])]
      : []
    if (!nextActs.some((a) => a?.slug === slug))
      nextActs.push({ slug, provider, params: {} })
    // If view is not saved or default/global, create new
    const mustCreate =
      !view ||
      view.id === DEFAULT_VIEW_ID ||
      view.formId === GLOBAL_FORM_ID ||
      view.formId !== formId
    if (mustCreate) {
      const payload = {
        name: view?.name || "Smart View",
        type: view?.type || "list",
        filters: view?.filters || [],
        sort: view?.sort || undefined,
        insights_spec: view?.insights || [],
        actions: nextActs,
        actionSlugs: nextActs.map((a: any) => a.slug),
      }
      const res = await fetch(`/api/forms/${formId}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}) as any)
      if (res.ok && data?.view?.id) {
        useResponseViewsStore.setState((state) => {
          const nextViews = [...state.views]
          nextViews.push({
            id: data.view.id,
            formId,
            name: payload.name,
            description: undefined,
            columns: [],
            sort: payload.sort,
            filters: payload.filters,
            pageSize: 20,
            saved: true,
            insights: payload.insights_spec,
            actionSlugs: payload.actionSlugs,
            actions: nextActs,
          } as any)
          return {
            views: nextViews,
            activeViewIdMap: {
              ...state.activeViewIdMap,
              [formId]: data.view.id,
            },
          } as any
        })
      }
      return
    }
    // Update saved view
    useResponseViewsStore.setState((state) => {
      const idx = state.views.findIndex((v) => v.id === view.id)
      if (idx < 0) return state as any
      const nextViews = [...state.views]
      nextViews[idx] = {
        ...state.views[idx],
        actions: nextActs,
        actionSlugs: nextActs.map((a: any) => a.slug),
      } as any
      return { views: nextViews } as any
    })
    await fetch(`/api/forms/${formId}/views/${view.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        actions: nextActs,
        actionSlugs: nextActs.map((a: any) => a.slug),
      }),
    })
  }

  const removeAction = async (slug: string) => {
    if (mode === "lifecycle") {
      const next = (config.allowedActions || []).filter((a) => a.slug !== slug)
      await helpers.syncAllowedActions(next)
      return
    }
    const view = activeView as any
    if (!view) return
    const nextActs = (Array.isArray(view.actions) ? view.actions : []).filter(
      (a: any) => a?.slug !== slug
    )
    useResponseViewsStore.setState((state) => {
      const idx = state.views.findIndex((v) => v.id === view.id)
      if (idx < 0) return state as any
      const nextViews = [...state.views]
      nextViews[idx] = {
        ...state.views[idx],
        actions: nextActs,
        actionSlugs: nextActs.map((a: any) => a.slug),
      } as any
      return { views: nextViews } as any
    })
    await fetch(`/api/forms/${formId}/views/${view.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        actions: nextActs,
        actionSlugs: nextActs.map((a: any) => a.slug),
      }),
    })
  }

  return (
    <Card className="rounded-none border-0 !bg-transparent shadow-none">
      <CardContent className="space-y-3 p-0 text-sm">
        {showHeader !== false ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">Integration Actions</span>
            </div>
            <div className="flex items-center gap-2">
              <Combobox
                data={addActionOptions}
                type="action"
                onValueChange={async (slug) => {
                  if (!slug) return
                  const s = String(slug)
                  setPendingSlug(s)
                  await addAction(s)
                  setPendingSlug("")
                }}
              >
                <ComboboxTrigger>Add action</ComboboxTrigger>
                <ComboboxContent
                  className="z-[1000] max-h-56 min-w-64"
                  popoverOptions={{
                    style: { width: 320 },
                  }}
                >
                  <ComboboxInput placeholder="Add action" />
                  <ComboboxEmpty />
                  <ComboboxList>
                    <ComboboxGroup>
                      {addActionOptions.map((opt) => (
                        <ComboboxItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2">
          {union.length ? (
            union.map((a) => {
              const meta = CURATED_ACTIONS.find((x) => x.slug === a.slug)
              const title = meta?.label || a.slug
              const tool = tools.find((t) => t.slug === a.slug)
              const auth = String(tool?.authStatus || "").toLowerCase()
              const needsParams = requiresParamsForSlug(a.slug)
              const hasParams = Boolean(
                a.params && Object.keys(a.params || {}).length
              )
              const uiStatus =
                auth === "ready" || auth === "connected"
                  ? needsParams && !hasParams
                    ? "needs_setup"
                    : "ready"
                  : "needs_auth"
              const statusLabel =
                uiStatus === "ready"
                  ? "Ready"
                  : uiStatus === "needs_auth"
                    ? "Needs auth"
                    : "Needs setup"
              return (
                <div
                  key={`${a.slug}-${a.proposed ? "proposed" : "configured"}`}
                  className="flex w-full items-start justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{title}</div>
                    <div className="text-muted-foreground text-[11px]">
                      Provider: {a.provider}
                      {a.proposed ? " • Proposed" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={uiStatus === "ready" ? "default" : "secondary"}
                    >
                      {statusLabel}
                    </Badge>
                    {uiStatus !== "ready" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => setOpenSlug(a.slug)}
                      >
                        Setup
                      </Button>
                    ) : null}
                    {!a.proposed ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-7 px-2 text-xs"
                        onClick={() => removeAction(a.slug)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-muted-foreground text-xs">No actions yet</div>
          )}
        </div>

        <SetupDrawer
          open={Boolean(openSlug)}
          onOpenChange={(v) => {
            if (!v) setOpenSlug(null)
          }}
          openSlug={openSlug}
          setOpenSlug={setOpenSlug}
          actionItems={union.map((a) => ({
            slug: a.slug,
            label:
              CURATED_ACTIONS.find((x) => x.slug === a.slug)?.label || a.slug,
            provider: a.provider,
            toolkit: CURATED_ACTIONS.find((x) => x.slug === a.slug)?.toolkit,
            status: String(
              tools.find((t) => t.slug === a.slug)?.authStatus || "unknown"
            ),
            configured: Boolean(a.params && Object.keys(a.params || {}).length),
            uiStatus: undefined,
          }))}
          formId={formId}
          activeView={mode === "view" ? activeView : null}
          refreshTools={refreshTools}
          refreshConfigs={() => {}}
          configs={[] as any}
          setAuthingSlug={() => {}}
          onSaveParams={
            mode === "lifecycle"
              ? async (slug, params) => {
                  const existing = (config.allowedActions ||
                    []) as LifecycleAllowedAction[]
                  const meta = CURATED_ACTIONS.find((a) => a.slug === slug)
                  const provider = (meta?.provider || "composio") as
                    | "usesend"
                    | "composio"
                  const idx = existing.findIndex((a) => a.slug === slug)
                  const next: LifecycleAllowedAction[] = [...existing]
                  const safeSlug = String(slug)
                  if (idx === -1) {
                    next.push({ slug: safeSlug, provider, params })
                  } else {
                    next[idx] = {
                      ...next[idx],
                      slug: safeSlug,
                      provider,
                      params,
                    }
                  }
                  await helpers.syncAllowedActions(next)
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  )
}

export default ActionsManagerCard
