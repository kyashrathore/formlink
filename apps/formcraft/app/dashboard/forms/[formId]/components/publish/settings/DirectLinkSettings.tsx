"use client"

import CopiableLink from "@/app/dashboard/forms/[formId]/components/share/CopiableLink"
import { getFormFillerFBasePath } from "@/app/lib/config"
import { Form } from "@formlink/schema"

interface DirectLinkSettingsProps {
  form: Form
  formId: string
  shortId?: string
}

export default function DirectLinkSettings({
  form,
  formId,
  shortId,
}: DirectLinkSettingsProps) {
  const publicUrl = `${getFormFillerFBasePath()}/${shortId || formId}`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-medium">Public Link</h3>
        <CopiableLink
          value={publicUrl}
          label="Form URL"
          description="Share this link directly with your users."
        />
      </div>

      <div>
        <h3 className="mb-2 font-medium">Test Link</h3>
        <CopiableLink
          value={publicUrl + "?formlinkai_testmode=true"}
          label="Test URL"
          description="Responses will be saved as drafts."
        />
      </div>
    </div>
  )
}
