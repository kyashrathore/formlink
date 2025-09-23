"use client"

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@formlink/ui"
import type { Table } from "@tanstack/react-table"
import { CalendarClock, CheckCircle2, FlaskConical } from "lucide-react"
import * as React from "react"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  onExport?: () => void
  rightActions?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  onExport,
  rightActions,
}: DataTableToolbarProps<TData>) {
  const [query, setQuery] = React.useState("")

  // Optional: Hook to propagate a generic search value into your filter state.
  // Here we just hold it locally to match DiceUI's layout without changing server API.

  // Facet helpers
  const setFilter = (id: string, value: any) => {
    const col = table.getColumn(id as any)
    if (!col) return
    if (value === undefined || value === null || value === "")
      col.setFilterValue(undefined)
    else col.setFilterValue(value)
  }
  // Toggle multi-select values for enum facets (e.g., status)
  const toggleFilterValue = (id: string, value: any) => {
    const col = table.getColumn(id as any)
    if (!col) return
    const current = col.getFilterValue() as any
    if (Array.isArray(current)) {
      const exists = current.includes(value)
      const next = exists
        ? current.filter((v: any) => v !== value)
        : [...current, value]
      col.setFilterValue(next.length ? next : undefined)
    } else if (current === undefined || current === null || current === "") {
      col.setFilterValue([value])
    } else {
      // switch from single to array
      col.setFilterValue(current === value ? undefined : [current, value])
    }
  }
  const activeFilters = table.getState().columnFilters
  const hasFilters = (activeFilters?.length || 0) > 0

  const getFilterValue = (id: string) =>
    activeFilters?.find((f) => (f as any).id === id)?.value
  const statusVal = getFilterValue("status") as string | string[] | undefined
  const testVal = getFilterValue("testmode") as
    | boolean
    | string
    | string[]
    | undefined
  const createdVal = getFilterValue("created_at") as string | undefined

  const createdLabel = (() => {
    if (!createdVal) return undefined
    const since = new Date(createdVal)
    if (isNaN(since.getTime())) return `Since ${createdVal}`
    const days = Math.round(
      (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000)
    )
    if (Math.abs(days - 7) <= 1) return "Last 7d"
    if (Math.abs(days - 30) <= 2) return "Last 30d"
    if (Math.abs(days - 90) <= 3) return "Last 90d"
    return `Since ${since.toISOString().slice(0, 10)}`
  })()

  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64"
        />
        {/* Facets: Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${statusVal ? "border-dashed" : ""}`}
            >
              <CheckCircle2 className="h-4 w-4" /> Status
              {statusVal ? (
                <span className="text-muted-foreground text-[11px]">
                  {Array.isArray(statusVal)
                    ? statusVal.length > 1
                      ? `${statusVal.length} selected`
                      : statusVal[0] === "completed"
                        ? "Completed"
                        : statusVal[0] === "in_progress"
                          ? "In Progress"
                          : String(statusVal[0])
                    : statusVal === "completed"
                      ? "Completed"
                      : statusVal === "in_progress"
                        ? "In Progress"
                        : String(statusVal)}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilter("status", undefined)}>
              Any
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={
                Array.isArray(statusVal)
                  ? statusVal.includes("completed")
                  : statusVal === "completed"
              }
              onCheckedChange={() => toggleFilterValue("status", "completed")}
            >
              Completed
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={
                Array.isArray(statusVal)
                  ? statusVal.includes("in_progress")
                  : statusVal === "in_progress"
              }
              onCheckedChange={() => toggleFilterValue("status", "in_progress")}
            >
              In Progress
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={
                Array.isArray(statusVal)
                  ? statusVal.includes("abandoned")
                  : statusVal === "abandoned"
              }
              onCheckedChange={() => toggleFilterValue("status", "abandoned")}
            >
              Abandoned
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Facets: Test Mode */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${testVal !== undefined && testVal !== null && testVal !== "" ? "border-dashed" : ""}`}
            >
              <FlaskConical className="h-4 w-4" /> Test
              {testVal !== undefined && testVal !== null && testVal !== "" ? (
                <span className="text-muted-foreground text-[11px]">
                  {Array.isArray(testVal)
                    ? (testVal as string[]).sort().join(", ")
                    : String(testVal) === "true"
                      ? "Yes"
                      : String(testVal) === "false"
                        ? "No"
                        : String(testVal)}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilter("testmode", undefined)}>
              Any
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={
                Array.isArray(testVal)
                  ? (testVal as string[]).includes("true")
                  : String(testVal) === "true"
              }
              onCheckedChange={() => toggleFilterValue("testmode", "true")}
            >
              Yes
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={
                Array.isArray(testVal)
                  ? (testVal as string[]).includes("false")
                  : String(testVal) === "false"
              }
              onCheckedChange={() => toggleFilterValue("testmode", "false")}
            >
              No
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Facets: Created Time */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${createdVal ? "border-dashed" : ""}`}
            >
              <CalendarClock className="h-4 w-4" /> Created
              {createdVal ? (
                <span className="text-muted-foreground text-[11px]">
                  {createdLabel}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() =>
                setFilter(
                  "created_at",
                  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
                )
              }
            >
              Last 7d
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setFilter(
                  "created_at",
                  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                )
              }
            >
              Last 30d
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setFilter(
                  "created_at",
                  new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
                )
              }
            >
              Last 90d
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFilter("created_at", undefined)}
            >
              All time
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Columns control moved to kebab menu on the right */}
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters(true)}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {rightActions}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              •••
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onExport ? (
              <DropdownMenuItem onClick={onExport}>Export CSV</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default DataTableToolbar
