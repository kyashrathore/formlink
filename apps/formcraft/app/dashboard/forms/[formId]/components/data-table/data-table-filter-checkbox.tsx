"use client"

import { cn } from "@/app/lib"
import { formatCompactNumber } from "@/app/lib/format"
import { Checkbox, Label, Skeleton } from "@formlink/ui"
import { Search } from "lucide-react"
import { useState } from "react"
import { InputWithAddons } from "../custom/input-with-addons"
import { useDataTable } from "./data-table-provider"
import type { DataTableCheckboxFilterField } from "./types"

export function DataTableFilterCheckbox<TData>({
  value: _value,
  options,
  component,
}: DataTableCheckboxFilterField<TData>) {
  const value = _value as string
  const [inputValue, setInputValue] = useState("")
  const { table, columnFilters, setColumnFilters } = useDataTable()
  if (!table) return null
  const column = table.getColumn(value)
  const filterValue = columnFilters.find((i) => i.id === value)?.value
  const facetedValue = column?.getFacetedUniqueValues()

  const Component = component

  const filterOptions = options?.filter(
    (option) =>
      inputValue === "" ||
      option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : []

  if (!filterOptions?.length)
    return (
      <div className="border-border grid divide-y rounded-lg border">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 px-2 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
          </div>
        ))}
      </div>
    )

  if (!filterOptions?.length) return null

  return (
    <div className="grid gap-2">
      {options && options.length > 4 ? (
        <InputWithAddons
          placeholder="Search"
          leading={<Search className="mt-0.5 h-4 w-4" />}
          containerClassName="h-9 rounded-lg"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      ) : null}
      <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border empty:border-none">
        {filterOptions.map((option, index) => {
          const checked = filters.includes(option.value)
          return (
            <div
              key={String(option.value)}
              className={cn(
                "group hover:bg-accent/50 relative flex items-center space-x-2 px-2 py-2.5",
                index !== filterOptions.length - 1 ? "border-b" : undefined
              )}
            >
              <Checkbox
                id={`${value}-${option.value}`}
                checked={checked}
                onCheckedChange={(checked) => {
                  const optVal =
                    typeof option.value === "string"
                      ? option.value.toLowerCase()
                      : option.value
                  const newValue = checked
                    ? [...(filters || []), optVal]
                    : filters?.filter((value) =>
                        typeof value === "string" && typeof optVal === "string"
                          ? value.toLowerCase() !== optVal
                          : value !== optVal
                      )

                  setColumnFilters((prev) => {
                    const otherFilters = prev.filter((f) => f.id !== value)
                    const updated = [
                      ...otherFilters,
                      { id: value, value: newValue },
                    ]

                    // Column filters updated on checkbox change
                    return updated
                  })
                }}
              />
              <Label
                htmlFor={`${value}-${option.value}`}
                className="text-foreground/70 group-hover:text-accent-foreground flex w-full items-center justify-center gap-1 truncate"
              >
                {Component ? (
                  <Component {...option} />
                ) : (
                  <span className="truncate font-normal">{option.label}</span>
                )}
                <span className="ml-auto flex items-center justify-center font-mono text-xs">
                  {false ? (
                    <Skeleton className="h-4 w-4" />
                  ) : facetedValue?.has(option.value) ? (
                    formatCompactNumber(facetedValue.get(option.value) || 0)
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const optVal =
                      typeof option.value === "string"
                        ? option.value.toLowerCase()
                        : option.value
                    setColumnFilters((prev) => {
                      const otherFilters = prev.filter((f) => f.id !== value)
                      const updated = [
                        ...otherFilters,
                        { id: value, value: [optVal] },
                      ]

                      // Column filters updated on only button click
                      return updated
                    })
                  }}
                  className={cn(
                    "text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 hidden font-normal backdrop-blur-sm group-hover:block",
                    "ring-offset-background focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  )}
                >
                  <span className="px-2">only</span>
                </button>
              </Label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
