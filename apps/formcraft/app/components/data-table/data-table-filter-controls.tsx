"use client"

import { generateFilterFieldsFromForm } from "@/app/dashboard/forms/[formId]/lib/responses/generateFilterFieldsFromForm"
import { useFormStore } from "@/app/dashboard/forms/[formId]/stores/useFormStore"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@formlink/ui"
import type React from "react"
import { useEffect } from "react"
import { DataTableFilterCheckbox } from "./data-table-filter-checkbox"
import { DataTableFilterInput } from "./data-table-filter-input"
import { DataTableFilterRadio } from "./data-table-filter-radio"
import { DataTableFilterResetButton } from "./data-table-filter-reset-button"
import { DataTableFilterSlider } from "./data-table-filter-slider"
import { DataTableFilterTimerange } from "./data-table-filter-timerange"
import { useDataTableStore } from "./dataTableStore"

const submissionFilters = ["status", "testmode"]
export function DataTableFilterControls() {
  const { filterFields, setFilterFields, table } = useDataTableStore()
  const { form } = useFormStore()

  useEffect(() => {
    if (form?.questions?.length) {
      setFilterFields(generateFilterFieldsFromForm(form))
    }
  }, [form, setFilterFields])

  const submissionFilterFields = filterFields?.filter(({ value }) =>
    submissionFilters.includes(value)
  )

  if (table?.options?.meta?.totalCount === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        No filters available.
      </div>
    )
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={submissionFilterFields?.map(({ value }) => value as string)}
    >
      {submissionFilterFields?.map((field) => {
        const value = field.value as string
        return (
          <AccordionItem key={value} value={value} className="border-none">
            <AccordionTrigger className="data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground w-full px-2 py-0 hover:no-underline">
              <div className="flex w-full items-center justify-between gap-2 truncate py-2 pr-2">
                <div className="flex items-center gap-2 truncate">
                  <p className="text-sm font-medium">{field.label}</p>
                  {value !== field.label.toLowerCase() &&
                  !field.commandDisabled ? (
                    <p className="text-muted-foreground mt-px truncate font-mono text-[10px]">
                      {value}
                    </p>
                  ) : null}
                </div>
                {}
                {field.type === "checkbox" && (
                  <DataTableFilterResetButton
                    type="checkbox"
                    value={field.value}
                    label={field.label}
                    options={field.options}
                    defaultOpen={field.defaultOpen}
                    commandDisabled={field.commandDisabled}
                  />
                )}
                {field.type === "radio" && (
                  <DataTableFilterResetButton
                    type="radio"
                    value={field.value}
                    label={field.label}
                    options={field.options}
                    defaultOpen={field.defaultOpen}
                    commandDisabled={field.commandDisabled}
                  />
                )}
                {field.type === "slider" && (
                  <DataTableFilterResetButton
                    type="slider"
                    value={field.value}
                    label={field.label}
                    min={field.min ?? 0}
                    max={field.max ?? 10}
                    defaultOpen={field.defaultOpen}
                    commandDisabled={field.commandDisabled}
                  />
                )}
                {field.type === "input" && (
                  <DataTableFilterResetButton
                    type="input"
                    value={field.value}
                    label={field.label}
                    defaultOpen={field.defaultOpen}
                    commandDisabled={field.commandDisabled}
                  />
                )}
                {field.type === "timerange" && (
                  <DataTableFilterResetButton
                    type="timerange"
                    value={field.value}
                    label={field.label}
                    defaultOpen={field.defaultOpen}
                    commandDisabled={field.commandDisabled}
                  />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-1">
                {(() => {
                  switch (field.type) {
                    case "checkbox": {
                      return (
                        <DataTableFilterCheckbox
                          type="checkbox"
                          value={field.value}
                          label={field.label}
                          options={field.options}
                          defaultOpen={field.defaultOpen}
                          commandDisabled={field.commandDisabled}
                        />
                      )
                    }
                    case "radio": {
                      return (
                        <DataTableFilterRadio
                          type="radio"
                          value={field.value}
                          label={field.label}
                          options={field.options}
                          defaultOpen={field.defaultOpen}
                          commandDisabled={field.commandDisabled}
                        />
                      )
                    }
                    case "slider": {
                      return (
                        <DataTableFilterSlider
                          type="slider"
                          value={field.value}
                          label={field.label}
                          min={field.min ?? 0}
                          max={field.max ?? 10}
                          defaultOpen={field.defaultOpen}
                          commandDisabled={field.commandDisabled}
                        />
                      )
                    }
                    case "input": {
                      return (
                        <DataTableFilterInput
                          type="input"
                          value={field.value}
                          label={field.label}
                          defaultOpen={field.defaultOpen}
                          commandDisabled={field.commandDisabled}
                        />
                      )
                    }
                    case "timerange": {
                      return (
                        <DataTableFilterTimerange
                          type="timerange"
                          value={field.value}
                          label={field.label}
                          defaultOpen={field.defaultOpen}
                          commandDisabled={field.commandDisabled}
                        />
                      )
                    }
                  }
                })()}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
