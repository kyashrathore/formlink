"use client"

import { Button } from "@formlink/ui"
import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const sorted = column.getIsSorted()
  return (
    <div className="group flex w-full items-center justify-between gap-2">
      <span className="truncate" title={title}>
        {title}
      </span>
      {column.getCanSort() ? (
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 transition-opacity ${
            sorted ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={() => column.toggleSorting(sorted === "asc")}
          aria-label={
            sorted
              ? `Sort ${sorted === "asc" ? "descending" : "ascending"}`
              : "Sort"
          }
        >
          {sorted === "desc" ? (
            <ArrowDown className="h-4 w-4" />
          ) : sorted === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ChevronsUpDown className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
  )
}
