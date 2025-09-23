"use client"

import {
  ScrollArea,
  ScrollBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formlink/ui"
import type { ColumnDef, Table as TTable } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { DataTablePagination } from "../data-table/data-table-pagination"
import { useDataTableStore } from "../data-table/dataTableStore"
import DataTableActionBar from "./data-table-action-bar"
import DataTableToolbar from "./data-table-toolbar"

export interface DataTableProps<TData, TValue> {
  table: TTable<TData>
  columns: ColumnDef<TData, TValue>[]
  onExportAll?: () => void
  onExportSelected?: () => void
  isLoading?: boolean
  rightActions?: ReactNode
}

export function DataTable<TData, TValue>({
  table,
  columns,
  onExportAll,
  onExportSelected,
  isLoading,
  rightActions,
}: DataTableProps<TData, TValue>) {
  return (
    <div className="flex h-full w-full flex-col gap-3">
      <DataTableToolbar
        table={table}
        onExport={onExportAll}
        rightActions={rightActions}
      />
      <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
        <div className="relative z-0 rounded-md border">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-20">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header, idx) => (
                      <TableHead
                        key={header.id}
                        className={
                          idx === 0
                            ? "bg-muted/50 sticky left-0 z-30"
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
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
                      {row.getVisibleCells().map((cell, idx) => (
                        <TableCell
                          key={cell.id}
                          className={
                            idx === 0
                              ? "bg-background sticky left-0 z-10"
                              : undefined
                          }
                        >
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
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {isLoading ? (
            <div className="bg-card/90 pointer-events-none absolute top-2 right-2 z-40 flex items-center gap-2 rounded-md border px-2 py-1 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : null}
        </div>
        {table.getPageCount() > 1 && (
          <DataTablePagination
            table={table}
            pagination={useDataTableStore.getState().pagination}
            columnFilters={useDataTableStore.getState().columnFilters}
          />
        )}
      </div>
      <DataTableActionBar table={table} onExportSelected={onExportSelected} />
    </div>
  )
}

export default DataTable
