"use client"

import type { Form, Question } from "@formlink/schema"
import {
  Badge,
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@formlink/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "../../components/data-table/data-table-column-header"
import type { FilterFieldType } from "../../components/data-table/dataTableStore"
import type { FormResponse } from "../../hooks/useFormResponsesQuery"

export function generateFilterFieldsFromForm(form: Form): FilterFieldType[] {
  const questionFilters: FilterFieldType[] = !form?.questions?.length
    ? []
    : form.questions.map((question) => {
        const baseField = {
          value: `${question.id}`,
          label: question.title ?? question.id,
          defaultOpen: false,
          commandDisabled: false,
        }

        switch (question.type.name) {
          case "text":
          case "address":
          case "fileUpload":
            return {
              ...baseField,
              type: "input" as const,
            }
          case "multipleChoice":
          case "singleChoice":
            return {
              ...baseField,
              type: "checkbox" as const,
              options: Array.isArray((question as any).options)
                ? (question as any).options.map((opt: any) => ({
                    label: opt.label,
                    value: opt.value,
                  }))
                : [],
            }
          case "linearScale":
          case "rating":
            return {
              ...baseField,
              type: "slider" as const,
              min:
                typeof (question as any).validations?.min?.value === "number"
                  ? (question as any).validations.min.value
                  : 0,
              max:
                typeof (question as any).validations?.max?.value === "number"
                  ? (question as any).validations.max.value
                  : 10,
              step: 1,
            }
          case "date":
            return {
              ...baseField,
              type: "timerange" as const,
            }
          default:
            return {
              ...baseField,
              type: "input" as const,
            }
        }
      })

  const defaultSubmissionFilters: FilterFieldType[] = [
    {
      value: "created_at",
      label: "Created Time",
      type: "timerange" as const,
      defaultOpen: true,
      commandDisabled: false,
    },
    {
      value: "testmode",
      label: "Test Mode",
      type: "radio" as const,
      options: [
        { label: "Yes", value: "true" },
        { label: "No", value: "false" },
      ],
      defaultOpen: true,
      commandDisabled: false,
    },
    {
      value: "status",
      label: "Status",
      type: "radio" as const,
      options: [
        { label: "In Progress", value: "in_progress" },
        { label: "Complete", value: "completed" },
        { label: "Abandoned", value: "abandoned" },
      ],
      defaultOpen: true,
      commandDisabled: false,
    },
  ]

  return [...defaultSubmissionFilters, ...questionFilters]
}

export function generateTableColumnsFromForm(
  form: Form
): ColumnDef<FormResponse, any>[] {
  if (!form?.questions?.length) return []

  const baseColumns: ColumnDef<FormResponse, any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
    },
    {
      accessorKey: "submission_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Submission" />
      ),
    },

    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: (info) => {
        const value = info.getValue()
        return value ? new Date(value as string).toLocaleString() : ""
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
    },
    {
      accessorKey: "testmode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Test" />
      ),
    },
  ]

  const questionColumns: ColumnDef<FormResponse, any>[] = form.questions.map(
    (question: Question) => {
      const label = (question as any)?.title || question.id
      const maxHeader = 50
      const headerText = String(label)
      const headerShort =
        headerText.length > maxHeader
          ? headerText.slice(0, maxHeader) + "…"
          : headerText

      return {
        accessorKey: question.id,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={headerShort} />
        ),
        cell: (info) => {
          const row = info.row.original as any
          const value = row.answers ? row.answers[question.id] : undefined

          if (value == null || value === "") {
            return <span className="text-muted-foreground">—</span>
          }

          // Multi-select arrays: show up to 3 chips, then +N more
          if (Array.isArray(value)) {
            const items = value as any[]
            const show = items.slice(0, 3)
            const extra = items.length - show.length
            return (
              <div className="flex max-w-[240px] flex-wrap gap-1">
                {show.map((v, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="max-w-[110px] truncate"
                  >
                    {String(v)}
                  </Badge>
                ))}
                {extra > 0 ? (
                  <Badge variant="outline">+{extra} more</Badge>
                ) : null}
              </div>
            )
          }

          // File uploads: display filename if present
          if (typeof value === "object") {
            try {
              const name =
                (value as any)?.name || (value as any)?.filename || undefined
              if (name) {
                return (
                  <span
                    className="inline-block max-w-[240px] truncate"
                    title={name}
                  >
                    {name}
                  </span>
                )
              }
              return (
                <span className="inline-block max-w-[240px] truncate">
                  {JSON.stringify(value)}
                </span>
              )
            } catch {
              return (
                <span className="inline-block max-w-[240px] truncate">
                  [object]
                </span>
              )
            }
          }

          // Text-like: truncate to 100 chars with tooltip
          const text = String(value)
          const short = text.length > 100 ? text.slice(0, 100) + "…" : text
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-block max-w-[280px] truncate"
                  title={text}
                >
                  {short}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs break-words">
                {text}
              </TooltipContent>
            </Tooltip>
          )
        },
      }
    }
  )

  return [...baseColumns, ...questionColumns]
}
