"use client"

import { useDebounce } from "@/app/hooks/use-debounce"
import { cn } from "@/app/lib"
import {
  Button,
  Calendar,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@formlink/ui"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import * as React from "react"
import type { DateRange } from "react-day-picker"
import { kbdVariants } from "../custom/kbd"
import type { DatePreset } from "../data-table/types"

const defaultPresets: DatePreset[] = []

interface DatePickerWithRangeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  presets?: DatePreset[]
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  presets = defaultPresets,
}: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!open) return

      presets.map((preset) => {
        if (preset.shortcut === e.key) {
          setDate({ from: preset.from, to: preset.to })
        }
      })
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setDate, presets, open])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            size="sm"
            className={cn(
              "hover:bg-muted/50 max-w-full justify-start truncate text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <span className="truncate">
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </span>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col justify-between sm:flex-row">
            <div className="hidden sm:block">
              <DatePresets
                onSelect={setDate}
                selected={date}
                presets={presets}
              />
            </div>
            <div className="block p-3 sm:hidden">
              <DatePresetsSelect
                onSelect={setDate}
                selected={date}
                presets={presets}
              />
            </div>
            <Separator orientation="vertical" className="h-auto w-px" />
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={1}
            />
          </div>
          <Separator />
          <CustomDateRange onSelect={setDate} selected={date} />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function DatePresets({
  selected,
  onSelect,
  presets,
}: {
  selected: DateRange | undefined
  onSelect: (date: DateRange | undefined) => void
  presets: DatePreset[]
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-muted-foreground mx-3 text-xs uppercase">Date Range</p>
      <div className="grid gap-1">
        {presets.map(({ label, shortcut, from, to }) => {
          const isActive = selected?.from === from && selected?.to === to
          return (
            <Button
              key={label}
              variant={isActive ? "outline" : "ghost"}
              size="sm"
              onClick={() => onSelect({ from, to })}
              className={cn(
                "flex items-center justify-between gap-6",
                !isActive && "border border-transparent"
              )}
            >
              <span className="mr-auto">{label}</span>
              <span className={cn(kbdVariants(), "uppercase")}>{shortcut}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function DatePresetsSelect({
  selected,
  onSelect,
  presets,
}: {
  selected: DateRange | undefined
  onSelect: (date: DateRange | undefined) => void
  presets: DatePreset[]
}) {
  function findPreset(from?: Date, to?: Date) {
    return presets.find((p) => p.from === from && p.to === to)?.shortcut
  }
  const [value, setValue] = React.useState<string | undefined>(
    findPreset(selected?.from, selected?.to)
  )

  React.useEffect(() => {
    const preset = findPreset(selected?.from, selected?.to)
    if (preset === value) return
    setValue(preset)
  }, [selected, presets])

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const preset = presets.find((p) => p.shortcut === v)
        if (preset) {
          onSelect({ from: preset.from, to: preset.to })
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Date Presets" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Date Presets</SelectLabel>
          {presets.map(({ label, shortcut }) => {
            return (
              <SelectItem
                key={label}
                value={shortcut}
                className="flex items-center justify-between [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:justify-between"
              >
                <span>{label}</span>
                <span
                  className={cn(
                    kbdVariants(),
                    "ml-2 h-5 leading-snug uppercase"
                  )}
                >
                  {shortcut}
                </span>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function CustomDateRange({
  selected,
  onSelect,
}: {
  selected: DateRange | undefined
  onSelect: (date: DateRange | undefined) => void
}) {
  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(
    selected?.from
  )
  const [dateTo, setDateTo] = React.useState<Date | undefined>(selected?.to)
  const debounceDateFrom = useDebounce(dateFrom, 1000)
  const debounceDateTo = useDebounce(dateTo, 1000)

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return ""
    const utcDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return utcDate.toISOString().slice(0, 16)
  }

  React.useEffect(() => {
    onSelect({ from: debounceDateFrom, to: debounceDateTo })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceDateFrom, debounceDateTo])

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-muted-foreground text-xs uppercase">Custom Range</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid w-full gap-1.5">
          <Label htmlFor="from">Start</Label>
          <Input
            key={formatDateForInput(selected?.from)}
            type="datetime-local"
            id="from"
            name="from"
            defaultValue={formatDateForInput(selected?.from)}
            onChange={(e) => {
              const newDate = new Date(e.target.value)
              if (!Number.isNaN(newDate.getTime())) {
                setDateFrom(newDate)
              }
            }}
            disabled={!selected?.from}
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="to">End</Label>
          <Input
            key={formatDateForInput(selected?.to)}
            type="datetime-local"
            id="to"
            name="to"
            defaultValue={formatDateForInput(selected?.to)}
            onChange={(e) => {
              const newDate = new Date(e.target.value)
              if (!Number.isNaN(newDate.getTime())) {
                setDateTo(newDate)
              }
            }}
            disabled={!selected?.to}
          />
        </div>
      </div>
    </div>
  )
}
