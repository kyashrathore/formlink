"use client"

import {
  getDefaultSettings,
  useFormStore,
} from "@/app/dashboard/forms/[formId]/stores/useFormStore"
import { Button, Card, Input, Label } from "@formlink/ui"
import { X } from "lucide-react"
import { useState } from "react"

interface StoredComputedField {
  field_id: string
  prompt: string
  jsonata: string
}

const AddContextSectionStep = () => {
  const [currentQueryParam, setCurrentQueryParam] = useState("")

  const form = useFormStore((state) => state.form)
  const updateSettingField = useFormStore((state) => state.updateSettingField)

  const queryParams = form?.settings?.additionalFields?.queryParamater ?? []

  const handleAddQueryParam = () => {
    const trimmed = currentQueryParam.trim()
    if (!trimmed) return
    const currentSettings = form?.settings || getDefaultSettings()
    let currentAF = currentSettings.additionalFields
    if (!currentAF) currentAF = getDefaultSettings().additionalFields
    const af = currentAF as {
      queryParamater: string[]
      computedFromResponses: StoredComputedField[]
    }
    const safeQueryParamater = Array.isArray(af.queryParamater)
      ? af.queryParamater
      : []
    const safeComputedFromResponses = Array.isArray(af.computedFromResponses)
      ? af.computedFromResponses
      : []

    const newParams = trimmed
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && !safeQueryParamater.includes(v))

    if (newParams.length > 0) {
      const newQueryParams = [...safeQueryParamater, ...newParams]
      const newAdditionalFields = {
        queryParamater: newQueryParams,
        computedFromResponses: safeComputedFromResponses,
      }
      updateSettingField("additionalFields", newAdditionalFields)
      setCurrentQueryParam("")
    }
  }

  return (
    <div
      id="additional-fields-step"
      data-spy-section="additional-fields-step"
      className="mt-8 flex w-full scroll-mt-8 flex-col"
    >
      <div className="mb-4 text-lg font-semibold">Additional Fields</div>
      <Card className="space-y-6 p-6">
        {}
        <div className="space-y-4">
          <h3 className="mb-0 text-sm font-semibold">
            Extract Query Parameters
          </h3>
          <p className="text-muted-foreground text-sm">
            Add URL query parameters (comma seperated values e.g.,{" "}
            <code className="bg-muted rounded px-1">utm_source</code>,{" "}
            <code className="bg-muted rounded px-1">ref</code>) you want to
            extract and store with each response.
          </p>
          <div className="flex items-end space-x-2">
            <div className="flex-grow space-y-2">
              <Label htmlFor="query-param-input">Parameter Name</Label>
              <Input
                id="query-param-input"
                placeholder="Enter query parameter name"
                value={currentQueryParam}
                onChange={(e) => setCurrentQueryParam(e.target.value)}
              />
            </div>
            <Button onClick={handleAddQueryParam} variant="outline" size="sm">
              Add
            </Button>
          </div>
          {queryParams.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-sm font-medium">Parameters to extract:</p>
              <ul className="text-muted-foreground list-inside list-disc pl-4 text-sm">
                {queryParams.map((param) => (
                  <li key={param}>
                    {param}
                    <button
                      type="button"
                      className="text-destructive ml-2 text-xs"
                      onClick={() => {
                        const currentSettings =
                          form?.settings || getDefaultSettings()
                        let currentAF = currentSettings.additionalFields
                        if (!currentAF)
                          currentAF = getDefaultSettings().additionalFields
                        const af = currentAF as {
                          queryParamater: string[]
                          computedFromResponses: StoredComputedField[]
                        }
                        const safeQueryParamater = Array.isArray(
                          af.queryParamater
                        )
                          ? af.queryParamater
                          : []
                        const safeComputedFromResponses = Array.isArray(
                          af.computedFromResponses
                        )
                          ? af.computedFromResponses
                          : []
                        const newQueryParams = safeQueryParamater.filter(
                          (p) => p !== param
                        )
                        const newAdditionalFields = {
                          queryParamater: newQueryParams,
                          computedFromResponses: safeComputedFromResponses,
                        }
                        updateSettingField(
                          "additionalFields",
                          newAdditionalFields
                        )
                      }}
                      aria-label={`Remove query param ${param}`}
                    >
                      <X className="inline size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {}
      </Card>
    </div>
  )
}

export default AddContextSectionStep
