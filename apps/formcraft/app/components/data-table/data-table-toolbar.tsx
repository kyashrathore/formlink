"use client"

import { useHotKey } from "@/app/hooks/use-hot-key"
import { formatCompactNumber } from "@/app/lib/format"
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formlink/ui"
import type { Table } from "@tanstack/react-table"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useMemo } from "react"
import { Kbd } from "../custom/kbd"
import { DataTableFilterControlsDrawer } from "./data-table-filter-controls-drawer"
import { useDataTable } from "./data-table-provider"
import { DataTableResetButton } from "./data-table-reset-button"
import { DataTableViewOptions } from "./data-table-view-options"

interface DataTableToolbarProps<TData = unknown> {
  table: Table<TData>
  renderActions?: () => React.ReactNode
  isLoading?: boolean
  columnFilters?: any
  enableColumnOrdering?: boolean
}

export function DataTableToolbar<TData>({
  table,
  renderActions,
  isLoading,
  columnFilters,
  enableColumnOrdering = false,
}: DataTableToolbarProps<TData>) {
  const filters = table.getState().columnFilters

  const rows = useMemo(
    () => ({
      total: table.getCoreRowModel().rows.length,
      filtered: table.getFilteredRowModel().rows.length,
    }),
    [isLoading, columnFilters]
  )

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="block sm:hidden">
          <DataTableFilterControlsDrawer />
        </div>
        <div>
          <p className="text-muted-foreground hidden text-sm sm:block">
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            of{" "}
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.total)}
            </span>{" "}
            row(s) <span className="sr-only sm:not-sr-only">filtered</span>
          </p>
          <p className="text-muted-foreground block text-sm sm:hidden">
            <span className="font-mono font-medium">{rows.filtered}</span>{" "}
            row(s)
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {filters.length ? <DataTableResetButton /> : null}
        {renderActions?.()}
        <DataTableViewOptions
          table={table}
          enableColumnOrdering={enableColumnOrdering}
        />
      </div>
    </div>
  )
}
