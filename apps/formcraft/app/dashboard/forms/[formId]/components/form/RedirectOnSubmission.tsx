"use client"

import EditableUrlInput from "@/app/components/EditableUrlInput"
import { Card } from "@formlink/ui"
import { useFormEditorStore } from "../../stores/useFormEditorStore"

const RedirectOnSubmission = () => {
  const redirectUrl = useFormEditorStore(
    (state) => state.form?.settings?.redirectOnSubmissionUrl || ""
  )
  const updateSettingField = useFormEditorStore(
    (state) => state.updateSettingField
  )
  const shouldHideControls = false

  const handleRedirectSave = (url: string) => {
    updateSettingField("redirectOnSubmissionUrl", url)
  }

  return (
    <div
      id="redirect-on-submission-step"
      data-spy-section="redirect-on-submission-step"
      className="mt-8 flex w-full scroll-mt-8 flex-col"
    >
      <div className="mb-2 text-lg font-semibold">Redirect On Submission</div>
      <Card className="p-4">
        <EditableUrlInput
          label="Redirect URL"
          enabledText="Enable redirect on submission"
          initialValue={redirectUrl}
          onSave={handleRedirectSave}
          hideActionButtons={shouldHideControls}
        />
      </Card>
    </div>
  )
}

export default RedirectOnSubmission
