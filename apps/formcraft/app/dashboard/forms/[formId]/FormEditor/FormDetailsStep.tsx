"use client"

import { SupabaseClient } from "@formlink/db"
import { Form } from "@formlink/schema"
import {
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@formlink/ui"
import { ChevronDown, ChevronRight } from "lucide-react"
import React, { useState } from "react"
import InlineEditableField from "./InlineEditableField"
import { useFormStore } from "./useFormStore"

interface FormStartStepProps {
  handleUpdateFormDetails: <
    K extends keyof Pick<Form, "title" | "description">,
  >(
    field: K,
    value: Form[K]
  ) => void
}

const FormDetailsStep: React.FC<FormStartStepProps> = ({
  handleUpdateFormDetails,
}) => {
  const { form } = useFormStore()

  const [isFormDetailsOpen, setIsFormDetailsOpen] = useState(false)

  return (
    <div
      id="form-details-step"
      data-spy-section="form-details-step"
      className="flex w-full scroll-mt-8 flex-col"
    >
      <div className="mb-4 text-lg font-semibold"> Form Details</div>
      <Card className="p-0">
        <Collapsible
          open={isFormDetailsOpen}
          onOpenChange={setIsFormDetailsOpen}
        >
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between py-4 pl-4 text-sm">
            <div>Edit form title and description</div>
            {isFormDetailsOpen ? (
              <ChevronDown className="mr-2 size-5" />
            ) : (
              <ChevronRight className="mr-2 size-5" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t p-4">
            <div className="mt-2 mb-4">
              <InlineEditableField
                id={`form-title`}
                label="Form Title"
                defaultValue={form?.title}
                onConfirm={(value) => handleUpdateFormDetails("title", value)}
                placeholder="Enter Form Title"
                hideLabel
                className="text-2xl font-medium tracking-tight"
              />
              <div className="mt-1 mb-8">
                <InlineEditableField
                  id={`form-intro`}
                  label="Form description"
                  defaultValue={form?.description}
                  onConfirm={(value) =>
                    handleUpdateFormDetails("description", value)
                  }
                  placeholder="Add description for the form..."
                  hideLabel
                  className="text-muted-foreground text-base"
                  useTextArea
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}

export default FormDetailsStep
