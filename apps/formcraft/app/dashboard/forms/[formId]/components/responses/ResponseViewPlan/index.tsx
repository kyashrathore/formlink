"use client"

import InsightPreviewCard from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/InsightPreviewCard"
import { MetaSummary } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/MetaSummary"
import { PlanHeader } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/PlanHeader"
import { Section } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/Section"
import { SetupDialog } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialog"
import {
  formatActionStatus,
  humanizeToolkit,
  requiresParamsForSlug,
} from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { useResponseViewsStore } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import type { ResponseView } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import type { RIPlanResponse } from "@/app/lib/ri/types"
import { Badge, Button, Card, CardContent } from "@formlink/ui"
import { Settings2, TrendingUp } from "lucide-react"
import React, { useMemo, useState } from "react"
import { useActionTools } from "../../../hooks/useActionTools"

export default function ResponseViewPlan({
  plan,
  saved,
  onSave,
  formId,
  onDismiss,
  onDelete,
  view,
  hideHeader,
}: {
  plan: RIPlanResponse
  saved?: boolean
  onSave?: () => void
  formId?: string
  onDismiss?: () => void
  onDelete?: () => void
  view?: ResponseView | null
  hideHeader?: boolean
}) {
  const selectorResult = useResponseViewsStore((s) => {
    if (!formId) return null
    const id = s.activeViewIdMap[formId] || "default"
    return s.views.find((v) => v.id === id && v.formId === formId) || null
  })
  const activeView = view || selectorResult

  const viewName =
    plan?.plan?.meta?.view_name || activeView?.name || "Smart View"
  const filters: Record<string, unknown> = {
    ...(plan?.plan?.rpc?.submission_filters || {}),
    ...(plan?.plan?.rpc?.answer_filters || {}),
  }
  if (!plan?.plan?.rpc && activeView?.filters?.length) {
    for (const f of activeView.filters) {
      if (f && (f as any).id) filters[(f as any).id] = (f as any).value
    }
  }
  const columns = plan?.plan?.ui?.columns || activeView?.columns || []
  const sort = plan?.plan?.ui?.sort || activeView?.sort
  const insights = plan?.plan?.ui?.insights_spec || activeView?.insights || []

  const suggestedActions = (plan?.plan?.actions || []) as any[]
  // Source actions solely from the provided plan to avoid cross-view leakage
  const actions = suggestedActions
  const rationale = plan?.plan?.meta?.rationale || activeView?.description

  const shouldLoadActions = Boolean(formId && actions.length)
  const {
    tools,
    isLoading: loadingActions,
    error: toolsError,
    enabled: remoteActionsEnabled,
    refresh: refreshTools,
  } = useActionTools({
    formId,
    enabled: shouldLoadActions,
    viewId: activeView?.saved ? activeView.id : undefined,
  })
  const refreshConfigs = () => {}

  const actionItems = useMemo(() => {
    if (!actions.length) return []
    const seen = new Set<string>()
    return actions
      .filter((action) => {
        const k = action.action_key
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((action) => {
        const slug = action.action_key
        const tool = tools.find((candidate) => candidate.slug === slug)
        const provider = action.provider || tool?.provider || "composio"
        const label = action.title || tool?.label || slug
        const toolkit =
          tool?.toolkit || slug.split("_")[0]?.toLowerCase() || undefined
        // Derive auth label purely from tool.authStatus/global integration
        let status = tool
          ? formatActionStatus(
              tool.authStatus || "unknown",
              provider,
              remoteActionsEnabled
            )
          : formId
            ? remoteActionsEnabled
              ? provider === "composio"
                ? "Needs auth"
                : "Unavailable"
              : "Integration disabled"
            : "Suggested"
        if (provider === "usesend") status = "Ready"

        const needsParams = requiresParamsForSlug(slug)
        // Per‑view configuration only (ignore global configured/uiStatus from tools)
        const configuredFromView = Boolean(
          (activeView as any)?.actions?.some(
            (a: any) =>
              a?.slug === slug &&
              a?.params &&
              Object.keys(a.params || {}).length > 0
          )
        )
        const configured = needsParams ? configuredFromView : true
        const configLabel =
          provider === "composio"
            ? configured
              ? "Configured"
              : needsParams
                ? "Needs params"
                : undefined
            : undefined

        // uiStatus derived only from view params + auth
        let uiStatus: undefined | "ready" | "needs_auth" | "needs_setup"
        const lowered = String((tool?.authStatus || "").toLowerCase())
        const authReady =
          provider === "usesend" ||
          lowered === "ready" ||
          lowered === "connected"
        if (provider === "usesend") uiStatus = "ready"
        else if (!remoteActionsEnabled && provider === "composio")
          uiStatus = "needs_auth"
        else if (!authReady) uiStatus = "needs_auth"
        else if (needsParams && !configured) uiStatus = "needs_setup"
        else uiStatus = "ready"

        return {
          slug,
          label,
          provider,
          toolkit,
          status,
          configured,
          configLabel,
          toolSlug: tool?.slug || slug,
          toolLabel: tool?.label || undefined,
          uiStatus,
        }
      })
  }, [actions, tools, remoteActionsEnabled, formId])

  type ActionGroup = {
    key: string
    title: string
    isComposio: boolean
    items: typeof actionItems
    groupStatus: "Ready" | "Needs setup" | "Needs auth"
  }

  const actionGroups: ActionGroup[] = useMemo(() => {
    const groups = new Map<string, typeof actionItems>()
    for (const it of actionItems) {
      const key = it.toolkit || it.provider || "misc"
      const arr = groups.get(key) || []
      arr.push(it)
      groups.set(key, arr as any)
    }
    const entries = Array.from(groups.entries())
    return entries.map(([groupKey, items]) => {
      const anyItem = items[0]
      const isComposio = anyItem?.provider === "composio"
      const title = isComposio
        ? humanizeToolkit(groupKey)
        : (anyItem?.provider ?? "Misc")
      // Per‑item auth/config derived above
      const anyNeedsAuth = items.some(
        (i: any) => (i as any).uiStatus === "needs_auth"
      )
      const anyNeedsSetup = items.some(
        (i: any) => (i as any).uiStatus === "needs_setup"
      )
      const anyReady = items.some((i: any) => (i as any).uiStatus === "ready")
      let groupStatus: ActionGroup["groupStatus"]
      if (anyNeedsAuth && !anyReady) groupStatus = "Needs auth"
      else if (anyNeedsSetup) groupStatus = "Needs setup"
      else groupStatus = "Ready"
      return { key: groupKey, title, isComposio, items, groupStatus }
    })
  }, [actionItems])

  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const highlightClass = saved
    ? "mb-4 !bg-transparent rounded-none border-0 shadow-none"
    : "mb-4 !bg-transparent rounded-none border-0 shadow-none"

  return (
    <>
      <Card className={highlightClass}>
        {!hideHeader ? (
          <PlanHeader viewName={viewName} saved={saved} onDismiss={onDismiss} />
        ) : null}
        <CardContent className="space-y-4 text-sm">
          <MetaSummary
            rationale={rationale}
            filters={filters}
            columns={columns}
            sort={sort}
            formId={formId}
          />

          <div className="space-y-2">
            <Section
              title="Insights"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            >
              {insights.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {insights.map((ins: any, i: number) => (
                    <InsightPreviewCard key={i} spec={ins} />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Section>

            <Section
              title="Actions"
              icon={<Settings2 className="h-3.5 w-3.5" />}
            >
              {actions.length ? (
                <div className="space-y-1.5">
                  {!remoteActionsEnabled &&
                  actionItems.some((a) => a.provider === "composio") ? (
                    <span className="text-muted-foreground">
                      Composio integrations are disabled. Set
                      ACTIONS_COMPOSIO_ENABLED=true and COMPOSIO_API_KEY, then
                      reload.
                    </span>
                  ) : null}
                  {shouldLoadActions && loadingActions ? (
                    <span className="text-muted-foreground">
                      Checking action statuses…
                    </span>
                  ) : null}
                  {toolsError ? (
                    <span className="text-destructive">
                      Failed to refresh action catalog; showing cached
                      suggestions.
                    </span>
                  ) : null}

                  {actionGroups.map(
                    ({
                      key: groupKey,
                      title: groupTitle,
                      isComposio,
                      items,
                      groupStatus,
                    }) => {
                      const targetConfigureSlug =
                        items.find((i) => {
                          const needsParams = requiresParamsForSlug(i.slug)
                          const configured = (i as any).configured
                          const uiStatus = (i as any).uiStatus
                          const s = String(
                            (i as any).status || ""
                          ).toLowerCase()
                          const authReady =
                            uiStatus === "ready" ||
                            s === "ready" ||
                            s === "connected"
                          return authReady && needsParams && !configured
                        })?.slug ||
                        items.find((i) => (i as any).uiStatus === "needs_setup")
                          ?.slug ||
                        items[0]?.slug ||
                        ""

                      const removeAction = async (slug: string) => {
                        if (!formId) return
                        let newActionSlugs: string[] | null = null
                        useResponseViewsStore.setState((state) => {
                          const activeId = state.activeViewIdMap[formId!]
                          const idx = state.views.findIndex(
                            (v) => v.id === activeId
                          )
                          if (idx < 0) return state as any
                          const view = state.views[idx] as any
                          if (!view) return state as any
                          const nextView: any = {
                            ...view,
                            actionSlugs: Array.isArray(view.actionSlugs)
                              ? (view.actionSlugs as string[]).filter(
                                  (s) => s !== slug
                                )
                              : view.actionSlugs,
                            plan: view.plan
                              ? {
                                  ...view.plan,
                                  plan: {
                                    ...view.plan.plan,
                                    actions: view.plan.plan.actions
                                      ? (view.plan.plan.actions || []).filter(
                                          (a: any) => a?.action_key !== slug
                                        )
                                      : [],
                                  },
                                }
                              : view.plan,
                          }
                          newActionSlugs = Array.isArray(nextView.actionSlugs)
                            ? (nextView.actionSlugs as string[])
                            : null
                          const nextViews = [...state.views]
                          nextViews[idx] = nextView
                          return { views: nextViews } as any
                        })
                        if (saved && newActionSlugs) {
                          try {
                            const activeId =
                              useResponseViewsStore.getState().activeViewIdMap[
                                formId
                              ]
                            await fetch(
                              `/api/forms/${formId}/views/${activeId}`,
                              {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  actionSlugs: newActionSlugs,
                                }),
                                credentials: "include",
                              }
                            )
                          } catch {
                            // ignore
                          }
                        }
                      }

                      return (
                        <div key={groupKey} className="rounded-md border p-2">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              {groupTitle}
                            </span>
                            <Badge
                              variant={
                                groupStatus === "Ready"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {groupStatus}
                            </Badge>
                            {isComposio ? (
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-sm"
                                variant={
                                  groupStatus === "Ready"
                                    ? "secondary"
                                    : "default"
                                }
                                onClick={() =>
                                  setOpenSlug(
                                    groupStatus === "Ready"
                                      ? targetConfigureSlug
                                      : items[0]?.slug || ""
                                  )
                                }
                              >
                                {groupStatus === "Ready"
                                  ? "Connected (Manage)"
                                  : "Connect"}
                              </Button>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {items.map((item) => (
                              <div
                                key={item.slug}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex min-w-0 flex-col">
                                  <div className="truncate text-sm font-medium">
                                    {item.label}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {item.provider === "usesend" ? (
                                    <Badge
                                      variant={
                                        String(item.status).toLowerCase() ===
                                        "ready"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {item.status}
                                    </Badge>
                                  ) : null}
                                  {!saved ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive h-6 px-2 text-sm"
                                      onClick={() => removeAction(item.slug)}
                                    >
                                      Remove
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">None</span>
              )}
            </Section>
          </div>
        </CardContent>
      </Card>

      <SetupDialog
        openSlug={openSlug}
        setOpenSlug={setOpenSlug}
        actionItems={actionItems as any}
        formId={formId}
        activeView={activeView as any}
        refreshTools={refreshTools}
        refreshConfigs={refreshConfigs}
        configs={[] as any}
        setAuthingSlug={() => {}}
      />
    </>
  )
}

// mini chart removed; using InsightPreviewCard
