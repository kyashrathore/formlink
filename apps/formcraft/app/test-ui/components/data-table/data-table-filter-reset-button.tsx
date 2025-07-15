"use client"

import { Button } from "@formlink/ui"
import { X } from "lucide-react"
import { useDataTable } from "./data-table-provider"
import type { DataTableFilterField } from "./types"

export function DataTableFilterResetButton<TData>({
  value: _value,
}: DataTableFilterField<TData>) {
  const { columnFilters, table, setColumnFilters } = useDataTable()
  const value = _value as string
  const column = table?.getColumn(value)
  const filterValue = columnFilters.find((f) => f.id === value)?.value

  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : []

  if (filters.length === 0) return null
  return (
    <Button
      variant="outline"
      className="h-5 rounded-full px-1.5 py-1 font-mono text-[10px]"
      onClick={(e) => {
        e.stopPropagation()
        setColumnFilters((prev) => prev.filter((f) => f.id !== value))
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.code === "Enter") {
          setColumnFilters((prev) => prev.filter((f) => f.id !== value))
        }
      }}
      asChild
    >
      <div role="button" tabIndex={0}>
        <span>{filters.length}</span>
        <X className="text-muted-foreground ml-1 h-2.5 w-2.5" />
      </div>
    </Button>
  )
}
