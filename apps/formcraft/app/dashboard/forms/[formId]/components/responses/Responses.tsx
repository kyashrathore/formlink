"use client"

import LifecyclePlanDrawer from "@/app/dashboard/forms/[formId]/components/responses/LifecyclePlanDrawer"
import { requiresParamsForSlug } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import ViewPlanDrawer from "@/app/dashboard/forms/[formId]/components/responses/ViewPlanDrawer"
import { Form } from "@formlink/schema"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { toast } from "sonner"
import { useActionTools } from "../../hooks/useActionTools"
import { useAutomationsConfig } from "../../hooks/useAutomationsConfig"
import { useFormResponsesQuery } from "../../hooks/useFormResponsesQuery"
import {
  generateFilterFieldsFromForm,
  generateTableColumnsFromForm,
} from "../../lib/responses/generateFilterFieldsFromForm"
import { useAutomationsPlanStore } from "../../stores/useAutomationsPlanStore"
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
  // Lifecycle drawer state
  const lifecyclePlan = useAutomationsPlanStore((s) => s.plan)
  const lifecycleOpen = useAutomationsPlanStore((s) => s.open)
  const setLifecycleOpen = useAutomationsPlanStore((s) => s.setOpen)
  const clearLifecyclePlan = useAutomationsPlanStore((s) => s.clear)
  const { config: lifecycleConfig } = useAutomationsConfig(form?.id)
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLifecycleOpen(true)}
          >
            Submission Automations
          </Button>
        </div>
      </div>
      {/** Removed redundant Submission Automations summary card on default view */}
      {showPlan || isEphemeralPlan ? (
        <ViewPlanDrawer
          formId={form.id}
          open={true}
          onOpenChange={(o) => {
            if (!o) setShowPlan(false)
          }}
          onDismiss={() => setShowPlan(false)}
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

      {/* Lifecycle Plan Drawer (component) */}
      <LifecyclePlanDrawer
        formId={form.id}
        open={Boolean(lifecycleOpen)}
        onOpenChange={(o) => {
          if (!o) clearLifecyclePlan()
          setLifecycleOpen(Boolean(o))
        }}
        lifecycleConfig={lifecycleConfig as any}
        plan={lifecyclePlan as any}
        onDismiss={clearLifecyclePlan}
      />
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
      toast("No responses selected", {
        description: "Select responses to run an action.",
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
      toast.error("Action failed", {
        description: json?.error || `Execution failed (${res.status})`,
      })
      return
    }
    const status = String(json?.status || "").toLowerCase()
    if (status === "completed") {
      toast.success("Action completed", {
        description: `${t.label || t.slug} ran on ${selectedSubmissionIds.length} response(s).`,
      })
    } else {
      toast("Action queued", {
        description: `${t.label || t.slug} enqueued.`,
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
      toast.success("Generated 100 test responses")
    } catch (e) {
      console.error(e)
      toast.error("Failed to generate test data")
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
      toast.success("Test data cleaned")
    } catch (e) {
      console.error(e)
      toast.error("Failed to cleanup test data")
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

// (moved) PlanPreviewForRightPanel has been refactored into ViewPlanDrawer component.
