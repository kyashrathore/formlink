"use client"

import ResponseViewPlan from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan"
import { requiresParamsForSlug } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { Form } from "@formlink/schema"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
  Button as UIButton,
} from "@formlink/ui"
import {
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import React, { useEffect, useMemo, useState } from "react"
import { useActionTools } from "../../hooks/useActionTools"
import { useFormResponsesQuery } from "../../hooks/useFormResponsesQuery"
import {
  generateFilterFieldsFromForm,
  generateTableColumnsFromForm,
} from "../../lib/responses/generateFilterFieldsFromForm"
import type { ResponseViewsState } from "../../stores/useResponseViewsStore"
import { useResponseViewsStore } from "../../stores/useResponseViewsStore"
import DataTable from "../data-table/data-table"
import { useDataTableStore } from "../data-table/dataTableStore"
import APIKeyManager from "./APIKeyManager"
import ResponseCharts from "./ResponseCharts"
import ResponseViewsTabs from "./ResponseViewsTabs"

interface ResponsesProps {
  form: Form
}

const Responses: React.FC<ResponsesProps> = ({ form }) => {
  const {
    columnFilters,
    setColumnFilters,
    sorting,
    setSorting,
    pagination,
    setPagination,
    rowSelection,
    setRowSelection,
    columnOrder,
    setColumnOrder,
    columnVisibility,
    setColumnVisibility,
    setTableInstance,
    setFilterFields,
  } = useDataTableStore()

  const activeViewPlan = useResponseViewsStore((s) => {
    const formId = form?.id
    if (!formId) return undefined
    const id = s.activeViewIdMap[formId] || "default"
    const view = s.views.find(
      (v) => v.id === id && (v.formId === formId || v.id === "default")
    )
    return view?.plan
  })

  const activeViewMeta = useResponseViewsStore((s) => {
    const formId = form?.id
    if (!formId) return undefined
    const id = s.activeViewIdMap[formId] || "default"
    return s.views.find((v) => v.id === id && v.formId === formId)
  })

  const isDefaultView = useResponseViewsStore((s) => {
    const formId = form?.id
    if (!formId) return true
    return (s.activeViewIdMap[formId] || "default") === "default"
  })

  const insightsSpecForQuery =
    (activeViewPlan?.plan?.ui?.insights_spec as any) ||
    (activeViewMeta?.insights as any) ||
    []

  const {
    data: responsesData,
    isLoading,
    totalCount,
    totalCompletedCount,
    totalInProgressCount,
    totalFilteredCount,
    insights,
  } = useFormResponsesQuery(
    form?.current_draft_version_id as string,
    columnFilters,
    pagination.pageIndex + 1,
    pagination.pageSize,
    insightsSpecForQuery
  )

  const tableData = responsesData ?? []
  // Also look for an ephemeral (unsaved) plan even if it isn't the active view yet
  const ephemeralView = useResponseViewsStore((s) => {
    const formId = form?.id
    if (!formId) return undefined
    const candidates = s.views.filter(
      (v) => v.formId === formId && !v.saved && v.plan
    )
    return candidates.length ? candidates[candidates.length - 1] : undefined
  })
  // Consider any plan present (active or ephemeral)
  const isEphemeralPlan = Boolean(ephemeralView)
  const [showPlan, setShowPlan] = useState<boolean>(false)
  useEffect(() => {
    if (isEphemeralPlan) setShowPlan(true)
  }, [isEphemeralPlan])
  // Always show the plan card whenever a plan exists; dismiss removes the ephemeral view

  const columns = React.useMemo(
    () => (form ? generateTableColumnsFromForm(form) : []),
    [form]
  )

  useEffect(() => {
    if (form) {
      const generatedFilterFields = generateFilterFieldsFromForm(form)
      setFilterFields(generatedFilterFields)
    }
  }, [form, setFilterFields])

  const tableState = useMemo(
    () => ({
      columnFilters,
      sorting,
      pagination,
      rowSelection,
      columnOrder,
      columnVisibility,
    }),
    [
      columnFilters,
      sorting,
      pagination,
      rowSelection,
      columnOrder,
      columnVisibility,
    ]
  )

  const table = useReactTable<any>({
    data: tableData,
    columns,
    state: tableState,
    rowCount: totalFilteredCount,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    meta: {
      totalFilteredCount,
      totalCompletedCount,
      totalInProgressCount,
      totalCount,
    },
  })

  const selectedSubmissionIds = useMemo(() => {
    return table
      .getSelectedRowModel()
      .rows.map((row) => (row.original as any).submission_id)
  }, [table, rowSelection])

  const allowedActionSlugs = useMemo(() => {
    const fromPlan = (activeViewPlan?.plan?.actions || [])
      .map((a: any) => a?.action_key)
      .filter(Boolean)
    if (fromPlan.length) return fromPlan
    return Array.isArray(activeViewMeta?.actionSlugs)
      ? (activeViewMeta!.actionSlugs as string[]) || []
      : []
  }, [activeViewPlan, activeViewMeta?.actionSlugs])

  // Stable search object for child components and caching
  const search = useMemo(() => {
    const s: Record<string, unknown> = {
      form_version_id: form?.current_draft_version_id,
    }
    for (const f of useDataTableStore.getState().columnFilters) {
      if (
        (f as any)?.id &&
        (f as any).value !== undefined &&
        (f as any).value !== null
      ) {
        s[(f as any).id] = (f as any).value
      }
    }
    return s
  }, [form?.current_draft_version_id, columnFilters])

  async function doExportCsv(selectedOnly: boolean) {
    // Build search
    const search: Record<string, unknown> = {
      form_version_id: form?.current_draft_version_id,
    }
    for (const f of useDataTableStore.getState().columnFilters) {
      if (f?.id && f.value !== undefined && f.value !== null) {
        search[(f as any).id] = (f as any).value
      }
    }
    const selected = selectedOnly
      ? table
          .getSelectedRowModel()
          .rows.map((r) => (r.original as any).submission_id)
      : []
    const res = await fetch(`/api/forms/${form.id}/responses/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "csv",
        search: JSON.stringify(search),
        submission_ids: selected.length ? selected : undefined,
      }),
    })
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `responses-${form?.title || form?.id}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (table && responsesData) {
      setTableInstance(table)
    }

    return () => {
      setTableInstance(null)
    }
  }, [table, responsesData, setTableInstance])

  // Keep page content static; let table show loading overlay.

  const renderResponseCards = () => (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm md:p-6">
        <h3 className="text-muted-foreground text-sm font-medium">
          Total Completed
        </h3>
        <p className="text-2xl font-bold">{totalCompletedCount ?? 0}</p>
      </div>
      <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm md:p-6">
        <h3 className="text-muted-foreground text-sm font-medium">
          Total In Progress
        </h3>
        <p className="text-2xl font-bold">{totalInProgressCount ?? 0}</p>
      </div>
      {}
      <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm md:p-6">
        <h3 className="text-muted-foreground text-sm font-medium">
          Total Responses
        </h3>
        <p className="text-2xl font-bold">{totalCount ?? 0}</p>
      </div>
    </div>
  )

  const hasActiveFilters = columnFilters && columnFilters.length > 0

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Responses</h2>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ResponseViewsTabs />
        <div className="flex items-center gap-2">
          {/* Show Response Plan button when a view exists or an ephemeral plan is present and sheet is closed */}
          {!showPlan && (activeViewMeta || isEphemeralPlan) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPlan(true)}
            >
              Response View
            </Button>
          ) : null}
        </div>
      </div>
      {showPlan || isEphemeralPlan ? (
        <PlanPreviewForRightPanel
          formId={form.id}
          onDismiss={() => {
            setShowPlan(false)
          }}
        />
      ) : null}
      {isDefaultView && renderResponseCards()}
      <ResponseCharts
        plan={
          activeViewPlan ||
          (activeViewMeta?.insights && activeViewMeta.insights.length
            ? ({
                plan: { ui: { insights_spec: activeViewMeta.insights } },
              } as any)
            : undefined)
        }
        insights={insights as any}
        form={form}
        search={search}
        totals={{
          totalCount: totalCount ?? 0,
          totalCompletedCount: totalCompletedCount ?? 0,
          totalInProgressCount: totalInProgressCount ?? 0,
          totalFilteredCount: totalFilteredCount ?? 0,
        }}
      />

      {!isLoading && totalCount === 0 && (
        <div className="mt-4 flex h-40 items-center justify-center rounded-md border border-dashed">
          <p className="text-muted-foreground">
            No responses found for this form yet.
          </p>
        </div>
      )}

      {}
      {!isLoading && (
        <>
          <div className="mb-2 hidden">
            {/* Export is moved to the toolbar/action bar for DiceUI parity. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  // Build search param including form_version_id and active filters
                  const search: Record<string, unknown> = {
                    form_version_id: form?.current_draft_version_id,
                  }
                  for (const f of useDataTableStore.getState().columnFilters) {
                    if (f?.id && f.value !== undefined && f.value !== null) {
                      search[f.id] = f.value as any
                    }
                  }
                  // Selected submissions
                  const selected = table
                    .getSelectedRowModel()
                    .rows.map((r) => (r.original as any).submission_id)

                  const res = await fetch(
                    `/api/forms/${form.id}/responses/export`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        format: "csv",
                        search: JSON.stringify(search),
                        submission_ids: selected.length ? selected : undefined,
                      }),
                    }
                  )
                  if (!res.ok) throw new Error(`Export failed (${res.status})`)
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `responses-${form?.title || form?.id}.csv`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                } catch (e) {
                  console.error(e)
                  alert("Export failed. Please try again.")
                }
              }}
            >
              Export CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Hook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Generated React Hook</DialogTitle>
                </DialogHeader>
                <pre className="bg-muted max-h-[60vh] overflow-auto rounded-md p-3 text-xs">
                  {`
// Fetch with your API key
fetch('/api/views/VIEW_ID/generate-hook?framework=react')
  .then(r=>r.json()).then(console.log)
`}
                </pre>
              </DialogContent>
            </Dialog>
            <APIKeyManager />
          </div>
          {/* DiceUI action bar handles bulk actions */}
          {}
          <DataTable
            columns={columns}
            table={table}
            isLoading={isLoading}
            onExportAll={async () => {
              try {
                await doExportCsv(false)
              } catch (e) {
                console.error(e)
                alert("Export failed.")
              }
            }}
            onExportSelected={async () => {
              try {
                await doExportCsv(true)
              } catch (e) {
                console.error(e)
                alert("Export failed.")
              }
            }}
            rightActions={
              <ResponseActionsMenu
                formId={form.id}
                allowedSlugs={allowedActionSlugs}
                selectedSubmissionIds={selectedSubmissionIds}
                onSetupRequest={() => {}}
              />
            }
          />

          {}
          {hasActiveFilters && totalFilteredCount === 0 && (
            <div className="mt-4 flex h-40 items-center justify-center rounded-md border border-dashed">
              <p className="text-muted-foreground">
                No responses match your current filters.
              </p>
            </div>
          )}
        </>
      )}

      {/* Removed ActionsExecutionDialog in favor of a compact dropdown menu */}
    </div>
  )
}

export default Responses

function ResponseActionsMenu({
  formId,
  allowedSlugs,
  selectedSubmissionIds,
  onSetupRequest,
}: {
  formId: string
  allowedSlugs: string[]
  selectedSubmissionIds: string[]
  onSetupRequest?: () => void
}) {
  const activeViewId = useResponseViewsStore((s) => {
    const id = s.activeViewIdMap[formId] || "default"
    const view = s.views.find((v) => v.id === id && v.formId === formId)
    return view?.saved ? view.id : undefined
  })
  const activeView = useResponseViewsStore((s) => {
    const id = s.activeViewIdMap[formId] || "default"
    return s.views.find((v) => v.id === id && v.formId === formId)
  })

  const { tools, enabled: remoteEnabled } = useActionTools({
    formId,
    enabled: Boolean(formId),
    viewId: activeViewId,
  })

  const readyItems = useMemo(() => {
    const allow = new Set((allowedSlugs || []).filter(Boolean))
    return tools
      .filter((t) => allow.has(t.slug))
      .filter((tool) => {
        const isUseSend = tool.provider === "usesend"
        const providerOk = isUseSend || remoteEnabled
        const status = (tool.authStatus || "unknown").toLowerCase()
        const authReady =
          isUseSend || status === "ready" || status === "connected"
        // Per‑view configured only
        const needsParams = requiresParamsForSlug(tool.slug)
        const viewConfigured = Boolean(
          (activeView as any)?.actions?.some(
            (a: any) =>
              a?.slug === tool.slug &&
              a?.params &&
              Object.keys(a.params || {}).length > 0
          )
        )
        const ready = needsParams ? viewConfigured : true
        return providerOk && authReady && ready
      })
      .map((tool) => ({ tool }))
  }, [tools, allowedSlugs, remoteEnabled, activeView])

  async function run(slug: string) {
    const t = tools.find((x) => x.slug === slug)
    if (!t) return
    if (!selectedSubmissionIds.length) {
      toast({
        title: "No responses selected",
        description: "Select responses to run an action.",
        status: "warning",
      })
      return
    }
    const payload = {
      formId,
      submissionIds: selectedSubmissionIds,
      action: {
        kind: t.provider === "usesend" ? "email" : "composio",
        slug: t.slug,
        // No runtime overrides here; rely on view params for composio
        params: {},
        idempotencyKey: `${Date.now().toString(16)}-${Math.random()
          .toString(16)
          .slice(2)}`,
      },
      // Let server validate/merge view params
      viewId: activeViewId,
    }
    const res = await fetch("/api/actions/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      toast({
        title: "Action failed",
        description: json?.error || `Execution failed (${res.status})`,
        status: "error",
      })
      return
    }
    const status = String(json?.status || "").toLowerCase()
    if (status === "completed") {
      toast({
        title: "Action completed",
        description: `${t.label || t.slug} ran on ${selectedSubmissionIds.length} response(s).`,
        status: "success",
      })
    } else {
      toast({
        title: "Action queued",
        description: `${t.label || t.slug} enqueued.`,
        status: "info",
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UIButton size="sm" variant="outline">
          Actions
        </UIButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Configured actions</DropdownMenuLabel>
        {readyItems.length ? null : (
          <DropdownMenuItem disabled>No configured actions</DropdownMenuItem>
        )}
        {readyItems.map(({ tool }) => (
          <DropdownMenuItem key={tool.slug} onClick={() => run(tool.slug)}>
            {tool.label || tool.slug}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {process.env.NEXT_PUBLIC_ENABLE_TESTDATA === "true" ? (
          <MoreActionsSubmenu formId={formId} />
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSetupRequest?.()}
          className="text-muted-foreground text-xs"
        >
          Setup actions…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MoreActionsSubmenu({ formId }: { formId: string }) {
  const { pagination, setPagination, setColumnFilters } = useDataTableStore()
  async function generate() {
    try {
      const res = await fetch(`/api/responses/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId, count: 100 }),
      })
      if (!res.ok) throw new Error("Failed to generate test data")
      const filters = [...useDataTableStore.getState().columnFilters]
      const hasTestmode = filters.some((f) => (f as any).id === "testmode")
      if (!hasTestmode) filters.push({ id: "testmode", value: true } as any)
      setColumnFilters(filters as any)
      setPagination({ pageIndex: 0, pageSize: pagination.pageSize })
      toast({ title: "Generated 100 test responses", status: "success" })
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to generate test data", status: "error" })
    }
  }
  async function cleanup() {
    try {
      if (!confirm("Delete all test data for this form?")) return
      const res = await fetch(`/api/responses/cleanup`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId }),
      })
      if (!res.ok) throw new Error("Failed to cleanup test data")
      setPagination({ pageIndex: 0, pageSize: pagination.pageSize })
      toast({ title: "Test data cleaned", status: "success" })
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to cleanup test data", status: "error" })
    }
  }
  return (
    <>
      <DropdownMenuLabel>More actions</DropdownMenuLabel>
      <DropdownMenuItem onClick={generate}>
        Generate 100 Test Responses
      </DropdownMenuItem>
      <DropdownMenuItem onClick={cleanup} variant="destructive">
        Clean Test Data
      </DropdownMenuItem>
    </>
  )
}

function PlanPreviewForRightPanel({
  formId,
  onDismiss,
}: {
  formId: string
  onDismiss?: () => void
}) {
  const [open, setOpen] = useState(true)
  const { renderPlan, renderView } = useResponseViewsStore((s) => {
    const activeId = s.activeViewIdMap[formId] || "default"
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
      // Compute configured action slugs at save time (intersection of plan actions and configured configs)
      const suggestedSlugs: string[] = Array.from(
        new Set(
          ((plan?.plan?.actions as any[]) || [])
            .map((a: any) => a?.action_key)
            .filter(Boolean)
        )
      )
      // Transitional: store suggested slugs as-is; readiness now computed from view params + auth
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
        nextViews[idx] = {
          ...existing,
          id: newId,
          saved: true,
        }
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

      toast({
        title: "View saved",
        description: `Saved "${viewMeta.name}"`,
        status: "success",
      })
    } catch (error) {
      toast({
        title: "Failed to save view",
        description: error instanceof Error ? error.message : String(error),
        status: "error",
      })
    }
  }

  if (!plan && !viewMeta) return null
  const viewName = plan?.plan?.meta?.view_name || viewMeta?.name || "Smart View"

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) onDismiss?.()
      }}
      direction="right"
    >
      <DrawerContent className="p-0 data-[vaul-drawer-direction=right]:sm:max-w-xl">
        <DrawerHeader className="bg-background sticky top-0 z-10 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DrawerTitle className="text-base font-semibold">
                {viewName}
              </DrawerTitle>
              {saved ? (
                <span className="text-xs text-emerald-600">Saved</span>
              ) : (
                <span className="text-muted-foreground text-xs">Unsaved</span>
              )}
            </div>
            <DrawerClose asChild>
              <Button size="icon" variant="ghost" aria-label="Close plan">
                ×
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="flex h-[calc(100vh-56px)] flex-col">
          <div className="flex-1 overflow-y-auto">
            {plan || viewMeta ? (
              <ResponseViewPlan
                plan={
                  plan || {
                    plan_version: "ri.v1",
                    correlationId: "view",
                    plan: {
                      meta: {
                        view_name: viewMeta?.name || "Smart View",
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
          <DrawerFooter className="border-t p-3">
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
                                text || `Failed to delete view (${res.status})`
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
                            toast({ title: "View deleted", status: "success" })
                          } catch (e) {
                            toast({
                              title: "Failed to delete view",
                              description:
                                e instanceof Error ? e.message : String(e),
                              status: "error",
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
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
