"use client"

import { cn } from "@/lib/utils"
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Textarea,
  toast,
} from "@formlink/ui"
import { X } from "lucide-react"
import React, { useState } from "react"
import { useAI } from "../../hooks/use-ai"
import { getDefaultSettings, useFormStore } from "../../stores/useFormStore"

interface StoredComputedField {
  field_id: string
  prompt: string
  jsonata: string
}

interface AdditionalSettingsSectionProps {
  userId: string
}

const AddContextSectionStep: React.FC<AdditionalSettingsSectionProps> = ({
  userId,
}) => {
  const [currentQueryParam, setCurrentQueryParam] = useState("")
  const [computedFieldDescription, setComputedFieldDescription] = useState("")
  const [currentFieldId, setCurrentFieldId] = useState("")

  const form = useFormStore((state) => state.form)
  const updateSettingField = useFormStore((state) => state.updateSettingField)
  const aiComputedField = useAI()

  const computedFields =
    form?.settings?.additionalFields?.computedFromResponses ?? []
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

  const handleAddComputedField = async () => {
    if (
      !computedFieldDescription.trim() ||
      !currentFieldId.trim() ||
      !form ||
      !userId
    ) {
      toast({
        title: "Missing Information",
        description:
          "Please enter a field ID, description, and ensure form context is loaded.",
        status: "warning",
      })
      return
    }

    const isAuthenticated = true

    try {
      const result = await aiComputedField.mutateAsync({
        operationType: "generate-compute-field-expression",
        prompt: computedFieldDescription,
        userId: userId,
        isAuthenticated,
        questions: form.questions,
      })

      if (result.error) {
        toast({
          title: "AI Error",
          description:
            result.message || "Could not generate computed field expression.",
          status: "warning",
        })
      } else if (result.data) {
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
        const safeComputedFromResponses = Array.isArray(
          af.computedFromResponses
        )
          ? af.computedFromResponses
          : []
        const newComputed = [
          ...safeComputedFromResponses,
          {
            field_id: currentFieldId,
            prompt: computedFieldDescription,
            jsonata: result.data?.jsonataExpression || "",
          },
        ]
        const newAdditionalFields = {
          queryParamater: safeQueryParamater,
          computedFromResponses: newComputed,
        }
        updateSettingField("additionalFields", newAdditionalFields)
        setComputedFieldDescription("")
        setCurrentFieldId("")
        toast({
          title: "Computed Field Added",
          description: "Expression generated successfully.",
          status: "success",
        })
      } else {
        toast({
          title: "AI Error",
          description: "AI processing successful, but no expression returned.",
          status: "warning",
        })
      }
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message || "Could not connect to AI service.",
        status: "error",
      })
    }
  }

  const handleDeleteComputedField = (fieldIdToDelete: string) => {
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
    const newComputed = safeComputedFromResponses.filter(
      (f: any) => f.field_id !== fieldIdToDelete
    )
    const newAdditionalFields = {
      queryParamater: safeQueryParamater,
      computedFromResponses: newComputed,
    }
    updateSettingField("additionalFields", newAdditionalFields)
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
                {queryParams.map((param, index) => (
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
                          (p: string) => p !== param
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
