"use client"

import ResponseViewPlan from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan"
import type { ResponseViewsState } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import { useResponseViewsStore } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  ScopedDrawer,
  ScopedDrawerClose,
  ScopedDrawerContent,
  ScopedDrawerFooter,
  ScopedDrawerHeader,
  ScopedDrawerOverlay,
  ScopedDrawerPortal,
  ScopedDrawerTitle,
} from "@formlink/ui"
import { useEffect } from "react"
import { toast } from "sonner"

interface ViewPlanDrawerProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDismiss?: () => void
}

const DEFAULT_VIEW_ID = "default"
const DEFAULT_VIEW_NAME = "Smart View"

export function ViewPlanDrawer(props: ViewPlanDrawerProps) {
  const { formId, open, onOpenChange, onDismiss } = props
  const { renderPlan, renderView } = useResponseViewsStore((s) => {
    const activeId = s.activeViewIdMap[formId] || DEFAULT_VIEW_ID
    const activeView = s.views.find(
      (v) => v.id === activeId && v.formId === formId
    )
    if (activeView?.plan) {
      return { renderPlan: activeView.plan, renderView: activeView }
    }
    const ephemeral = [...s.views]
      .reverse()
      .find((v) => v.formId === formId && !v.saved && v.plan)
    if (ephemeral) return { renderPlan: ephemeral.plan, renderView: ephemeral }
    return { renderPlan: undefined, renderView: activeView }
  })

  const plan = renderPlan
  const viewMeta = renderView
  const saved = Boolean(renderView?.saved)

  // Lock body scroll while the plan drawer is open to avoid double scrollbars
  useEffect(() => {
    if (!open) return
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [open])

  const handleSave = async () => {
    if (!viewMeta || viewMeta.saved) return
    try {
      const suggestedSlugs: string[] = Array.from(
        new Set(
          ((plan?.plan?.actions as any[]) || [])
            .map((a: any) => a?.action_key)
            .filter(Boolean)
        )
      )
      const configuredSlugs: string[] = suggestedSlugs

      const res = await fetch(`/api/forms/${formId}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: viewMeta.name,
          description: plan?.plan?.meta?.rationale,
          columns: viewMeta.columns,
          filters: viewMeta.filters,
          sort: viewMeta.sort,
          insights_spec: (plan?.plan?.ui?.insights_spec as any[]) || [],
          actionSlugs: configuredSlugs,
        }),
        credentials: "include",
      })
      let data: any = null
      let bodyText: string | null = null
      try {
        data = await res.json()
      } catch {
        try {
          bodyText = await res.text()
        } catch {}
      }
      if (!res.ok || !data?.view?.id) {
        const msg =
          (data && (data.error || data.message)) ||
          (bodyText && bodyText.slice(0, 200)) ||
          `Failed to save view (${res.status})`
        throw new Error(msg)
      }

      const newId = data.view.id as string
      useResponseViewsStore.setState((state) => {
        const idx = state.views.findIndex((v) => v.id === viewMeta.id)
        if (idx === -1) return state
        const existing = state.views[idx]
        if (!existing) return state
        const nextViews = [...state.views]
        nextViews[idx] = { ...existing, id: newId, saved: true }
        const nextActive = { ...state.activeViewIdMap, [formId]: newId }
        const nextStatus: ResponseViewsState["lastPlanStatusMap"] = {
          ...state.lastPlanStatusMap,
          [formId]: { correlationId: existing.correlationId, status: "saved" },
        }
        return {
          views: nextViews,
          activeViewIdMap: nextActive,
          lastPlanStatusMap: nextStatus,
        }
      })

      toast.success("View saved", {
        description: `Saved "${viewMeta.name}"`,
      })
    } catch (error) {
      toast.error("Failed to save view", {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!plan && !viewMeta) return null
  const viewName =
    plan?.plan?.meta?.view_name || viewMeta?.name || DEFAULT_VIEW_NAME

  return (
    <ScopedDrawer
      open={open}
      modal={false}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) onDismiss?.()
      }}
    >
      <ScopedDrawerPortal
        container={
          typeof document !== "undefined"
            ? (document.getElementById(
                "right-panel-root"
              ) as HTMLElement | null)
            : null
        }
      >
        <ScopedDrawerOverlay />
        <ScopedDrawerContent className="p-0 sm:max-w-xl">
          <ScopedDrawerHeader className="bg-background sticky top-0 z-10 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div>
                  <ScopedDrawerTitle className="text-base font-semibold">
                    {saved ? "Edit view" : "Create view"}
                  </ScopedDrawerTitle>
                  <p className="text-muted-foreground text-xs">
                    {saved
                      ? "Update filters, insights and actions for this response view."
                      : "Define filters, insights and actions, then save to reuse this view."}
                    {viewName ? (
                      <span className="text-muted-foreground/80 ml-1">
                        (Working title: {viewName})
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <ScopedDrawerClose asChild>
                <Button size="icon" variant="ghost" aria-label="Close plan">
                  ×
                </Button>
              </ScopedDrawerClose>
            </div>
          </ScopedDrawerHeader>
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto">
              {plan || viewMeta ? (
                <ResponseViewPlan
                  plan={
                    plan || {
                      plan_version: "ri.v1",
                      correlationId: "view",
                      plan: {
                        meta: {
                          view_name: viewMeta?.name || DEFAULT_VIEW_NAME,
                          rationale: viewMeta?.description || undefined,
                        },
                        rpc: {
                          submission_filters: Object.fromEntries(
                            (viewMeta?.filters || []).map((f: any) => [
                              f.id,
                              f.value,
                            ])
                          ),
                          answer_filters: {},
                        },
                        ui: {
                          columns: viewMeta?.columns || [],
                          sort: viewMeta?.sort || undefined,
                          insights_spec: viewMeta?.insights || [],
                        },
                        actions: (viewMeta?.actionSlugs || []).map((slug) => ({
                          action_key: slug,
                          params: {},
                        })),
                      },
                    }
                  }
                  saved={saved}
                  formId={formId}
                  view={viewMeta as any}
                  onDismiss={undefined}
                  hideHeader
                />
              ) : null}
            </div>
            <ScopedDrawerFooter className="border-t p-3">
              <div className="ml-auto flex gap-2">
                {!saved ? (
                  <Button size="sm" onClick={handleSave}>
                    Save View
                  </Button>
                ) : null}
                {saved && viewMeta ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        Delete View
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete View</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="flex justify-end gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `/api/forms/${formId}/views/${viewMeta.id}`,
                                {
                                  method: "DELETE",
                                  credentials: "include",
                                }
                              )
                              if (!res.ok) {
                                const text = await res.text().catch(() => "")
                                throw new Error(
                                  text ||
                                    `Failed to delete view (${res.status})`
                                )
                              }
                              useResponseViewsStore.setState((state) => {
                                const nextViews = state.views.filter(
                                  (v) => v.id !== viewMeta.id
                                )
                                const nextActive = {
                                  ...state.activeViewIdMap,
                                  [formId]: "default",
                                }
                                return {
                                  views: nextViews,
                                  activeViewIdMap: nextActive,
                                }
                              })
                              onDismiss?.()
                              toast.success("View deleted")
                            } catch (e) {
                              toast.error("Failed to delete view", {
                                description:
                                  e instanceof Error ? e.message : String(e),
                              })
                            }
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </ScopedDrawerFooter>
          </div>
        </ScopedDrawerContent>
      </ScopedDrawerPortal>
    </ScopedDrawer>
  )
}

export default ViewPlanDrawer
