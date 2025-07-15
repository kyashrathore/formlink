"use client"

import { useLocalStorage } from "@/app/hooks/use-local-storage"
import { cn } from "@/app/lib"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formlink/ui"
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  createParser,
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
} from "nuqs/server"
import * as React from "react"
import { DataTableFilterCommand } from "./data-table-filter-command"
import { DataTableFilterControls } from "./data-table-filter-controls"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { useDataTableStore } from "./dataTableStore"
import type { DataTableFilterField } from "./types"

export const ARRAY_DELIMITER = ","
export const SLIDER_DELIMITER = "-"
export const SPACE_DELIMITER = "_"
export const RANGE_DELIMITER = "-"
export const SORT_DELIMITER = "."

export const parseAsSort = createParser({
  parse(queryValue) {
    const [id, desc] = queryValue.split(".")
    if (!id && !desc) return null
    return { id, desc: desc === "desc" }
  },
  serialize(value) {
    return `${value.id}.${value.desc ? "desc" : "asc"}`
  },
})

export const searchParamsParser = {
  q_car_fuel_type: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
}

export const searchParamsCache = createSearchParamsCache(searchParamsParser)

export interface DataTableProps<TData, TValue> {
  table: TTable<TData>
  columns: ColumnDef<TData, TValue>[]
  filterFields?: DataTableFilterField<TData>[] // filterFields for DataTableFilterCommand
  isLoading?: boolean
  showFilterControls?: boolean // Prop to control visibility of filter UI
  // setShowFilterControls is part of the interface but not used in this specific implementation path
}

export function DataTable<TData, TValue>({
  table,
  columns,
  filterFields = [],
  isLoading,
  showFilterControls = true, // Default to true if not provided
}: DataTableProps<TData, TValue>) {
  // DataTableFilterCommand primarily uses filterFields from useDataTableStore.
  // The filterFields prop passed here can be a fallback or for direct use if the store isn't populated yet.
  // searchParamsParser is defined globally in this file.

  return (
    <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
      <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
        {/* <>
            <DataTableFilterCommand
              table={table}
              filterFields={filterFields} 
              isLoading={isLoading}
              searchParamsParser={searchParamsParser}
            />
            <DataTableToolbar table={table} isLoading={isLoading} />
          </> */}
        <div className="z-0 rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {table.getPageCount() > 1 && (
          <DataTablePagination
            table={table}
            pagination={useDataTableStore.getState().pagination}
            columnFilters={useDataTableStore.getState().columnFilters}
          />
        )}
      </div>
    </div>
  )
}
