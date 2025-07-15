"use client"

import { isArrayOfDates } from "@/app/lib/is-array"
import { useMemo } from "react"
import type { DateRange } from "react-day-picker"
import { DatePickerWithRange } from "../custom/date-picker-with-range"
import { useDataTable } from "./data-table-provider"
import type { DataTableTimerangeFilterField } from "./types"

export function DataTableFilterTimerange<TData>({
  value: _value,
  presets,
}: DataTableTimerangeFilterField<TData>) {
  const value = _value as string
  const { table, columnFilters, setColumnFilters } = useDataTable()
  const column = table?.getColumn(value)
  const filterValue = columnFilters.find((i) => i.id === value)?.value

  const date: DateRange | undefined = useMemo(
    () =>
      filterValue instanceof Date
        ? { from: filterValue, to: undefined }
        : Array.isArray(filterValue) && isArrayOfDates(filterValue)
          ? { from: filterValue?.[0], to: filterValue?.[1] }
          : undefined,
    [filterValue]
  )

  const setDate = (date: DateRange | undefined) => {
    if (!date) return
    if (date.from && !date.to) {
      setColumnFilters((prev) => {
        const otherFilters = prev.filter((f) => f.id !== value)
        return [...otherFilters, { id: value, value: [date.from] }]
      })
    }
    if (date.to && date.from) {
      setColumnFilters((prev) => {
        const otherFilters = prev.filter((f) => f.id !== value)
        return [...otherFilters, { id: value, value: [date.from, date.to] }]
      })
    }
  }

  return <DatePickerWithRange {...{ date, setDate, presets }} />
}
