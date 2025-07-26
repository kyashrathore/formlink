"use client"

import { Button } from "@formlink/ui"
import { Edit3, Eye, FileText } from "lucide-react"
import { useState } from "react"
import { usePanelState } from "../hooks/usePanelState"
import { cn } from "../lib"
import { useFormStore } from "../stores/useFormStore"
import { DeviceMode } from "./form/DevicePreviewFrame"
import FormEditor from "./form/FormEditor"
import FormModeControls, { FormMode } from "./form/FormModeControls"
import FormPreviewWithDevices from "./form/FormPreviewWithDevices"
import PreviewControls from "./form/PreviewControls"

const mockUser = {
  id: "test-user-id",
}

interface FormTabContentProps {
  formId: string
  shadcnCSSData?: {
    cssText: string
    version: number
  }
  onShadcnApplied?: (result: {
    success: boolean
    error?: string
    appliedRootVariables: string[]
    appliedDarkVariables: string[]
    warnings: string[]
  }) => void
}

export default function FormTabContent({
  shadcnCSSData,
  onShadcnApplied,
}: FormTabContentProps) {
  const { form } = useFormStore()
  const { editMode, toggleEditMode } = usePanelState()
  const [formMode, setFormMode] = useState<FormMode>("chat")
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")

  const isPreviewMode = !editMode

  if (!form) {
    return (
      <div className="bg-background flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md space-y-6 text-center">
            <div className="bg-primary/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <FileText className="text-primary h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-foreground text-2xl font-semibold">
                Start in Chat
              </h2>
              <p className="text-muted-foreground">
                Use the chat panel to describe your form. The AI will help you
                build it step by step, and changes will appear here in
                real-time.
              </p>
            </div>
            <div className="text-muted-foreground bg-muted/50 rounded-lg p-4 text-sm">
              💡 Try: "Create a contact form with name, email, and message
              fields"
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasFormContent = form.questions && form.questions.length > 0

  return (
    <div className="bg-background flex h-full flex-col overflow-auto">
      {}
      <div
        className={cn(
          "border-border bg-background flex items-center justify-between border-b px-4",
          isPreviewMode ? "py-0" : "py-1"
        )}
      >
        {}
        <div className="flex items-center">
          {hasFormContent && isPreviewMode && (
            <FormModeControls
              formMode={formMode}
              onFormModeChange={setFormMode}
            />
          )}
        </div>

        {}
        <div className="flex items-center space-x-3">
          {}
          {hasFormContent && isPreviewMode && (
            <>
              <PreviewControls
                deviceMode={deviceMode}
                onDeviceModeChange={setDeviceMode}
              />
              <div className="bg-border h-4 w-px" />
            </>
          )}

          {}
          {hasFormContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleEditMode}
              className="flex items-center space-x-1.5"
            >
              {isPreviewMode ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  <span>Edit</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Preview</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {}
        <div
          className={`absolute inset-0 z-10 ${isPreviewMode ? "block" : "hidden"}`}
        >
          <div className="h-full p-4">
            {}
            {hasFormContent && (
              <FormPreviewWithDevices
                form={form}
                className="h-full"
                showControls={false}
                formMode={formMode}
                onFormModeChange={setFormMode}
                deviceMode={deviceMode}
                onDeviceModeChange={setDeviceMode}
                shadcnCSSData={shadcnCSSData}
                onShadcnApplied={onShadcnApplied}
              />
            )}
          </div>
        </div>

        {}
        <div
          className={`absolute inset-0 ${!isPreviewMode ? "block" : "hidden"}`}
        >
          <div className="h-full p-4">
            <FormEditor user={mockUser} selectedTab="form" />
          </div>
        </div>
      </div>
    </div>
  )
}
