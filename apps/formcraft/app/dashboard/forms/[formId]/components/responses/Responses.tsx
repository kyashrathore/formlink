"use client"

import { Form } from "@formlink/schema"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import React, { useEffect, useMemo } from "react"
import { useFormResponsesQuery } from "../../hooks/useFormResponsesQuery"
import {
  generateFilterFieldsFromForm,
  generateTableColumnsFromForm,
} from "../../lib/responses/generateFilterFieldsFromForm"
import DataTable from "../data-table/data-table"
import { useDataTableStore } from "../data-table/dataTableStore"
import APIKeyManager from "./APIKeyManager"

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

  const {
    data: responsesData,
    isLoading,
    error,
    totalCount,
    totalCompletedCount,
    totalInProgressCount,
    totalFilteredCount,
  } = useFormResponsesQuery(
    form?.current_draft_version_id as string,
    columnFilters,
    pagination.pageIndex + 1,
    pagination.pageSize
  )

  const tableData = responsesData ?? []

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

  const showFilterToolbarAndCommand = totalCount > 0

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Responses</h2>
      {renderResponseCards()}

      {}

      {!isLoading && totalCount === 0 && (
        <div className="mt-4 flex h-40 items-center justify-center rounded-md border border-dashed">
          <p className="text-muted-foreground">
            No responses found for this form yet.
          </p>
        </div>
      )}

      {}
      {!isLoading && totalCount > 0 && (
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
    </div>
  )
}

export default Responses
