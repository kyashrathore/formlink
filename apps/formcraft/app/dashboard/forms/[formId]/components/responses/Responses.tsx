"use client"

import { Form } from "@formlink/schema"
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
import { DataTable } from "../data-table/data-table"
import { useDataTableStore } from "../data-table/dataTableStore"

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
          {}
          <DataTable
            columns={columns}
            table={table}
            showFilterControls={showFilterToolbarAndCommand}
            filterFields={useDataTableStore.getState().filterFields}
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
