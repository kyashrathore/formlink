"use client"

import { cn } from "@/app/lib"
import { Label, RadioGroup, RadioGroupItem, Skeleton } from "@formlink/ui"
import { useDataTable } from "./data-table-provider"
import type { DataTableRadioFilterField, Option } from "./types"

export function DataTableFilterRadio<TData>({
  value: _value,
  options,
  component,
}: DataTableRadioFilterField<TData>) {
  const value = _value as string
  const { table, columnFilters, setColumnFilters } = useDataTable()

  if (!table) return null
  const column = table.getColumn(value)

  const filterValue = columnFilters.find((i) => i.id === value)?.value as
    | string
    | undefined

  const Component = component

  if (!options?.length) {
    return (
      <div className="border-border grid divide-y rounded-lg border">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 px-2 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-full" /> {}
            <Skeleton className="h-4 w-full rounded-sm" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <RadioGroup
      value={filterValue}
      onValueChange={(selectedValue: string | undefined) => {
        const newValue =
          selectedValue === filterValue ? undefined : selectedValue
        setColumnFilters((prev) => {
          const otherFilters = prev.filter((f) => f.id !== value)
          if (newValue === undefined) {
            return otherFilters
          }
          return [...otherFilters, { id: value, value: newValue }]
        })
      }}
      className="grid gap-2"
    >
      <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border empty:border-none">
        {options.map((option: Option, index: number) => {
          const radioId = `${value}-${String(option.value)}`
          return (
            <div
              key={String(option.value)}
              className={cn(
                "group hover:bg-accent/50 relative flex items-center space-x-2 px-2 py-2.5",
                index !== options.length - 1 ? "border-b" : undefined
              )}
            >
              <RadioGroupItem value={String(option.value)} id={radioId} />
              <Label
                htmlFor={radioId}
                className="text-foreground/70 group-hover:text-accent-foreground flex w-full cursor-pointer items-center gap-1 truncate"
              >
                {Component ? (
                  <Component {...option} />
                ) : (
                  <span className="truncate font-normal">{option.label}</span>
                )}
                {}
              </Label>
            </div>
          )
        })}
      </div>
    </RadioGroup>
  )
}
