"use client"

import { DataTable } from "@/app/components/data-table/data-table"
import { useDataTableStore } from "@/app/components/data-table/dataTableStore"
import { Form } from "@formlink/schema"
import {
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import React, { useEffect, useMemo, useState } from "react"
import {
  generateFilterFieldsFromForm, // This import should be correct now
  generateTableColumnsFromForm,
} from "./generateFilterFieldsFromForm"
import { useFormResponsesQuery } from "./useFormResponsesQuery"

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
    setFilterFields, // Add this action
  } = useDataTableStore()

  const {
    data: responsesData,
    isLoading,
    error,
    totalCount,
    totalCompletedCount,
    totalInProgressCount,
    totalFilteredCount,
    completedCount, // Filtered completed
    inProgressCount, // Filtered in-progress
    page, // current page from hook
    pageSize, // current page size from hook
  } = useFormResponsesQuery(
    form?.current_draft_version_id as string,
    columnFilters,
    pagination.pageIndex + 1, // TanStack table is 0-indexed, hook is 1-indexed
    pagination.pageSize
  )

  const tableData = responsesData ?? []

  const columns = React.useMemo(
    () => (form ? generateTableColumnsFromForm(form) : []),
    [form]
  )

  // Generate and set filter fields in the store when the form definition is available
  useEffect(() => {
    if (form) {
      const generatedFilterFields = generateFilterFieldsFromForm(form)
      setFilterFields(generatedFilterFields)
    }
    // Optional: Clear filter fields on unmount or when form is not available
    // return () => setFilterFields([]);
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

  const table = useReactTable({
    data: tableData,
    columns,
    state: tableState,
    rowCount: totalFilteredCount, // Total number of rows available after filtering
    manualPagination: true, // We are handling pagination server-side
    manualFiltering: true, // We are handling filtering server-side
    manualSorting: true, // Assuming sorting might also be server-side or needs to be wired up
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination, // This updates the pagination state in useDataTableStore
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // Keep for client-side state if needed, but actual sort is server-side
    getFacetedRowModel: getFacetedRowModel(), // Keep for client-side state
    getPaginationRowModel: getPaginationRowModel(), // Manages client-side pagination state
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    meta: {
      totalFilteredCount,
      totalCompletedCount,
      totalInProgressCount,
      totalCount,
    },
  })

  useEffect(() => {
    if (table && responsesData) {
      setTableInstance(table)
    }

    return () => {
      setTableInstance(null)
    }
  }, [table, responsesData, setTableInstance])

  if (isLoading) {
    return <div>Loading responses...</div>
  }

  if (error) {
    return <div>Error loading responses: {error.message}</div>
  }

  if (!table) {
    // This case should ideally not be hit if isLoading and error are handled,
    // as table instance should be created once data/columns are available.
    // However, keeping it as a fallback.
    return <div>Preparing responses table...</div>
  }

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
      {/* Placeholder for other cards if needed, e.g., total responses */}
      <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm md:p-6">
        <h3 className="text-muted-foreground text-sm font-medium">
          Total Responses
        </h3>
        <p className="text-2xl font-bold">{totalCount ?? 0}</p>
      </div>
    </div>
  )

  const hasActiveFilters = columnFilters && columnFilters.length > 0
  const showTable = totalFilteredCount > 0
  const showNoResultsDueToFilters = hasActiveFilters && totalFilteredCount === 0
  // Show this if no filters are applied AND there are no responses for the form at all.
  // totalCount reflects all responses for the form version, ignoring table filters.
  const showNoResultsOverall = !hasActiveFilters && totalCount === 0

  // If filters are applied and result is 0, tableData will be empty.
  // If no filters are applied and totalCount is 0, tableData will also be empty.
  // The original `if (!tableData || tableData.length === 0)` handles the "No responses found for this form yet"
  // when there are truly no responses for the form (totalCount === 0 and no filters).
  // We need to refine this.
  const showFilterToolbarAndCommand = totalCount > 0 // Show main filter UI if there are any responses at all for the form.
  // ResponsesFilter in Sidebar is separate and shown if `form` is loaded.
  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Responses</h2>
      {renderResponseCards()}

      {/* 
        If totalCount is 0, show "No responses found for this form yet." and nothing else for the table/filter area.
        Otherwise, show the DataTable container which includes filter command/toolbar, and then conditionally the table or a message.
      */}

      {!isLoading && totalCount === 0 && (
        <div className="mt-4 flex h-40 items-center justify-center rounded-md border border-dashed">
          <p className="text-muted-foreground">
            No responses found for this form yet.
          </p>
        </div>
      )}

      {/* This block renders if there are any responses for the form (totalCount > 0) */}
      {!isLoading && totalCount > 0 && (
        <>
          {/* DataTable will render its command bar & toolbar because showFilterControls will be true.
              It will also render the table. If tableData is empty (totalFilteredCount is 0),
              DataTable's internal TableBody will show "No results."
              We want to keep the filter command/toolbar visible in this case.
          */}
          <DataTable
            columns={columns}
            table={table}
            showFilterControls={showFilterToolbarAndCommand} // This will be true if totalCount > 0
            filterFields={useDataTableStore.getState().filterFields} // Pass filterFields for DataTableFilterCommand
            // isLoading prop for DataTable might be useful for its internal states if any
          />

          {/* Explicit message if filters are active and yield no results, shown *below* the DataTable's toolbar/command area.
              The DataTable itself will show "No results." in its body. This message is more prominent.
              Only show this if filters are active AND there are no filtered results.
          */}
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
