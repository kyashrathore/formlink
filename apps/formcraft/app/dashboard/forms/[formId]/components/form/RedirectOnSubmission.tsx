"use client"

import EditableUrlInput from "@/app/components/EditableUrlInput"
import { Card } from "@formlink/ui"
import React from "react"
import { useMobile } from "../../hooks/use-mobile"
import { useFormStore } from "../../stores/useFormStore"

const RedirectOnSubmission = ({
  userId,
  selectedTab,
}: {
  userId: string
  selectedTab: string
}) => {
  const redirectUrl = useFormStore(
    (state) => state.form?.settings?.redirectOnSubmissionUrl || ""
  )
  const updateSettingField = useFormStore((state) => state.updateSettingField)
  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"

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
