"use client"

import { Button, Card, CardContent } from "@formlink/ui"
import type { Table } from "@tanstack/react-table"
import * as React from "react"

interface DataTableActionBarProps<TData> {
  table: Table<TData>
  onExportSelected?: () => void
}

export function DataTableActionBar<TData>({
  table,
  onExportSelected,
}: DataTableActionBarProps<TData>) {
  const selectedCount = table.getSelectedRowModel().rows.length
  if (selectedCount === 0) return null

  return (
    <div className="sticky bottom-2 z-40 flex w-full justify-center">
      <Card className="shadow-lg">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="text-sm font-medium">{selectedCount} selected</div>
          {onExportSelected ? (
            <Button size="sm" variant="secondary" onClick={onExportSelected}>
              Export Selected
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => table.resetRowSelection()}
          >
            Clear
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default DataTableActionBar
