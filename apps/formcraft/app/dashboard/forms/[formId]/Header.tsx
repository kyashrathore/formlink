"use client"

import FormlinkLogo from "@/app/components/FormlinkLogo"
import { AppInfo } from "@/app/components/layout/app-info"
import UserMenu from "@/app/components/layout/user-menu"
import { cn } from "@/app/lib"
import { useMobile } from "@/hooks/use-mobile"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  toast,
} from "@formlink/ui"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { selectIsDirty, useFormStore } from "./FormEditor/useFormStore"

export default function FormPageHeader(props: {
  title?: string
  user: any
  formId: string
}) {
  const { formId } = props
  const isMobile = useMobile()
  const formFromStore = useFormStore((state) => state.form)
  const isDirty = useFormStore(selectIsDirty)
  const updateSnapshot = useFormStore((state) => state.updateSnapshot)

  const updateFormMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const data = (await res.json()) as any
      if (!res.ok) {
        throw new Error(data.error || "Failed to update form")
      }
      return data
    },
    onSuccess: () => {
      updateSnapshot()
    },
    onError: (error: Error) => {
      console.error("Failed to update form:", error.message)
      toast({
        title: "Failed to update form",
        description: error.message,
        status: "error",
      })
    },
  })

  const publishFormMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/forms/${formId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = (await res.json()) as any
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish form")
      }
      return data
    },
    onSuccess: () => {
      toast({
        title: "Form published successfully!",
        description: "Your form is now live.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to publish form",
        description: error.message,
        status: "error",
      })
    },
  })

  return (
    <>
      <div
        className={cn(
          "bg-background fixed top-0 right-0 z-50 flex items-center justify-between p-2",
          isMobile ? "w-full min-w-0" : "w-fit"
        )}
      >
        <div className="flex items-center py-2"></div>
        <div
          className={cn(
            "flex justify-end gap-4",
            isMobile ? "w-full min-w-0" : "w-fit"
          )}
        >
          <div className="flex items-center gap-4">
            {formFromStore?.current_published_version_id &&
            !formFromStore?.current_draft_version_id ? (
              <>
                <Button
                  onClick={() => {
                    if (isDirty && formFromStore) {
                      updateFormMutation.mutate(formFromStore)
                    }
                  }}
                  disabled={
                    !isDirty || updateFormMutation.isPending || !formFromStore
                  }
                >
                  {updateFormMutation.isPending
                    ? "Saving..."
                    : isDirty
                      ? "Save and Publish Updates"
                      : "Published"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (formFromStore) {
                      updateFormMutation.mutate(formFromStore)
                    } else {
                      console.warn("No form data in store to save.")
                    }
                  }}
                  disabled={updateFormMutation.isPending || !formFromStore}
                >
                  {updateFormMutation.isPending ? "Saving..." : "Save Form"}
                  {isDirty && !updateFormMutation.isPending && (
                    <span
                      className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500"
                      title="You have unsaved changes"
                    ></span>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    publishFormMutation.mutate()
                  }}
                  disabled={publishFormMutation.isPending}
                >
                  {publishFormMutation.isPending
                    ? "Publishing..."
                    : "Publish Form"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="h-9" />
    </>
  )
}
