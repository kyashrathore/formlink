"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formlink/ui"
import type { ColumnDef, Table as TTable } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import {
  createParser,
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
} from "nuqs/server"
import { DataTablePagination } from "./data-table-pagination"
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
  filterFields?: DataTableFilterField<TData>[]
  isLoading?: boolean
  showFilterControls?: boolean
}

export function DataTable<TData, TValue>({
  table,
  columns,
}: DataTableProps<TData, TValue>) {
  return (
    <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
      <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
        {}
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
