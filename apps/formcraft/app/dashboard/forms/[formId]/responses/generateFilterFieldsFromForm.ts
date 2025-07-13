import type { FilterFieldType } from "@/app/components/data-table/dataTableStore"
import type { Form } from "@formlink/schema"
import type { ColumnDef, Row } from "@tanstack/react-table"
import type { FormResponse } from "./useFormResponsesQuery"

export function generateFilterFieldsFromForm(form: Form): FilterFieldType[] {
  const questionFilters: FilterFieldType[] = !form?.questions?.length
    ? []
    : form.questions.map((question) => {
        const baseField = {
          value: `${question.id}`,
          label: question.id,
          defaultOpen: false,
          commandDisabled: false,
        }

        switch (question.questionType) {
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
      accessorKey: "submission_id",
      header: "Submission ID",
    },

    {
      accessorKey: "created_at",
      header: "Created At",
      cell: (info) => {
        const value = info.getValue()
        return value ? new Date(value as string).toLocaleString() : ""
      },
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      accessorKey: "testmode",
      header: "Testmode",
    },
  ]

  const questionColumns: ColumnDef<FormResponse, any>[] = form.questions.map(
    (question) => {
      let filterFn: any = undefined
      switch (question.questionType) {
        case "multipleChoice":
        case "singleChoice":
          filterFn = "arrIncludesSomeCaseInsensitive"
          break
        case "rating":
        case "linearScale":
          filterFn = "inNumberRange"
          break
        case "date":
          filterFn = "inNumberRange"
          break
        case "text":
        case "address":
        case "fileUpload":
        default:
          filterFn = "includesString"
          break
      }
      return {
        accessorKey: question.id,
        header: question.id,
        cell: (info) => {
          const row = info.row.original as any
          const value = row.answers ? row.answers[question.id] : undefined
          if (Array.isArray(value)) {
            return value.join(", ")
          }
          if (typeof value === "object" && value !== null) {
            return JSON.stringify(value)
          }
          return value ?? ""
        },
      }
    }
  )

  return [...baseColumns, ...questionColumns]
}
