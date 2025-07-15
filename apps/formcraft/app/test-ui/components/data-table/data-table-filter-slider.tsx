"use client"

import { useDebounce } from "@/app/hooks/use-debounce"
import { isArrayOfNumbers } from "@/app/lib/is-array"
import { Label } from "@formlink/ui"
import type { Table as TTable } from "@tanstack/react-table"
import { useEffect, useState } from "react"
import { InputWithAddons } from "../custom/input-with-addons"
import { Slider } from "../custom/slider"
import { FacetMetadataSchema } from "./data-table-filter-command-utils"
import { useDataTable } from "./data-table-provider"
import type { DataTableSliderFilterField } from "./types"

function getFilter(filterValue: unknown) {
  return typeof filterValue === "number"
    ? [filterValue, filterValue]
    : Array.isArray(filterValue) && isArrayOfNumbers(filterValue)
      ? filterValue.length === 1
        ? [filterValue[0], filterValue[0]]
        : filterValue
      : null
}

export function getFacetedMinMaxValues<TData>(
  facets?: Record<string, FacetMetadataSchema>
) {
  return (_: TTable<TData>, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min
    const max = facets?.[columnId]?.max
    if (typeof min === "number" && typeof max === "number") return [min, max]
    if (typeof min === "number") return [min, min]
    if (typeof max === "number") return [max, max]
    return undefined
  }
}

export function DataTableFilterSlider<TData>({
  value: _value,
  min: defaultMin,
  max: defaultMax,
}: DataTableSliderFilterField<TData>) {
  const value = _value as string
  const { table, columnFilters } = useDataTable()
  const column = table?.getColumn(value)
  const filterValue = columnFilters.find((i) => i.id === value)?.value
  const rawFilters = getFilter(filterValue)

  const sanitizeFilters = (
    currentFilters: (number | undefined)[] | null
  ): number[] | null => {
    if (!currentFilters) {
      return null
    }

    if (currentFilters.length === 0) {
      return null
    }
    const first = currentFilters[0]

    const second = currentFilters.length > 1 ? currentFilters[1] : first

    if (typeof first === "number" && typeof second === "number") {
      return [first, second]
    }

    return null
  }

  const filters = sanitizeFilters(rawFilters)
  const [input, setInput] = useState<number[] | null>(filters)
  const [min, max] = (table
    ? getFacetedMinMaxValues()(table, value)
    : undefined) ||
    column?.getFacetedMinMaxValues() || [defaultMin, defaultMax]

  const debouncedInput = useDebounce(input, 500)

  useEffect(() => {
    if (debouncedInput?.length === 2) {
      column?.setFilterValue(debouncedInput)
    }
  }, [debouncedInput])

  useEffect(() => {
    if (debouncedInput?.length !== 2) {
    } else if (!filters) {
      setInput(null)
    } else if (
      debouncedInput[0] !== filters[0] ||
      debouncedInput[1] !== filters[1]
    ) {
      setInput(filters)
    }
  }, [filters])

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-4">
        <div className="grid w-full gap-1.5">
          <Label
            htmlFor={`min-${value}`}
            className="text-muted-foreground px-2"
          >
            Min.
          </Label>
          <InputWithAddons
            placeholder="from"
            trailing="ms"
            containerClassName="mb-2 h-9 rounded-lg"
            type="number"
            name={`min-${value}`}
            id={`min-${value}`}
            value={`${input?.[0] ?? min}`}
            min={min}
            max={max}
            onChange={(e) =>
              setInput((prev) => [Number(e.target.value), prev?.[1] || max])
            }
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label
            htmlFor={`max-${value}`}
            className="text-muted-foreground px-2"
          >
            Max.
          </Label>
          <InputWithAddons
            placeholder="to"
            trailing="ms"
            containerClassName="mb-2 h-9 rounded-lg"
            type="number"
            name={`max-${value}`}
            id={`max-${value}`}
            value={`${input?.[1] ?? max}`}
            min={min}
            max={max}
            onChange={(e) =>
              setInput((prev) => [prev?.[0] || min, Number(e.target.value)])
            }
          />
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        value={input?.length === 2 ? input : [min, max]}
        onValueChange={(values) => setInput(values)}
      />
    </div>
  )
}
