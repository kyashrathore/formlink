"use client"

import { Form } from "@formlink/schema"
import { Alert, AlertDescription, AlertTitle } from "@formlink/ui"
import React from "react"
import AdditionalFieldsSection from "./AdditionalFieldsSection"
import FormDetailsStep from "./FormDetailsStep"
import FormJourneyStep from "./FormJourneyStep"
import Integrations from "./Integrations"
// import NotifyOnSubmission from "./NotifyOnSubmission"
import QuestionsStep from "./QuestionsStep"
import RedirectOnSubmission from "./RedirectOnSubmission"
import { useFormStore } from "./useFormStore"

type FormEditorProps = {
  user: any
  selectedTab: string
}

const FormEditor = ({ user, selectedTab }: FormEditorProps) => {
  const { updateFormField, form } = useFormStore()

  const handleUpdateFormDetails = <
    K extends keyof Pick<Form, "title" | "description">,
  >(
    field: K,
    value: Form[K]
  ) => {
    if (form && form[field] !== value) {
      const valueToSave =
        typeof value === "string" &&
        value.trim() === "" &&
        field === "description"
          ? undefined
          : value
      updateFormField(field, valueToSave || "")
    }
  }
  return (
    <div className="flex flex-col items-center">
      {form?.current_published_version_id &&
        !form?.current_draft_version_id && (
          <Alert className="mb-4">
            <AlertTitle>Form is published.</AlertTitle>
            <AlertDescription>
              Adding, removing, or reordering questions, and changing question
              types are not permitted on a published version.
            </AlertDescription>
          </Alert>
        )}
      <FormDetailsStep handleUpdateFormDetails={handleUpdateFormDetails} />
      <FormJourneyStep userId={user?.id} selectedTab={selectedTab} />
      <QuestionsStep userId={user?.id} selectedTab={selectedTab} />
      <AdditionalFieldsSection userId={user?.id} />
      <RedirectOnSubmission userId={user?.id} selectedTab={selectedTab} />
      <div className="min-h-screen" />
    </div>
  )
}

export default FormEditor
