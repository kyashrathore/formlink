"use client"

import { useFormEditorStore } from "@/app/dashboard/forms/[formId]/stores/useFormEditorStore"
import { Card } from "@formlink/ui"
import { useState } from "react"
import ActionsManagerCard from "../responses/ActionsManagerCard"
import EditableUrlInput from "./EditableUrlInput"

const examplePayload = `{
  "submissionId": "fd639ed1-2540-457f-91b0-4b395d2dbc85",
  "versionId": "220b6147-65f5-45b8-be65-f65f81b797da",
  "submissionStatus": "completed",
  "testmode": true,
  "answers": [
    {
      "q_id": "q_car_budget",
      "answer": "20000_35000",
      "is_additional_field": false
    },
    // ...
  ]
}`

const Integrations = () => {
  const formId = useFormEditorStore((state) => state.form?.id)
  const webhookUrl = useFormEditorStore(
    (state) => state.form?.settings?.integrations?.webhookUrl || ""
  )
  const updateSettingField = useFormEditorStore(
    (state) => state.updateSettingField
  )
  const [isPayloadExpanded, setIsPayloadExpanded] = useState(false)

  const handleWebhookSave = (url: string) => {
    updateSettingField("integrations", { webhookUrl: url })
  }

  if (!formId) return null

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Actions Config Section */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Actions & Integrations</h2>
          <p className="text-muted-foreground text-sm">
            Configure actions triggered after a response is received. Manage
            connections in the{" "}
            <a
              href="/dashboard/integrations"
              className="underline underline-offset-2"
            >
              Dashboard
            </a>
            .
          </p>
        </div>
        <div className="rounded-md border bg-transparent">
          <ActionsManagerCard
            formId={formId}
            mode="lifecycle"
            showHeader={true}
          />
        </div>
      </section>

      {/* Webhook Section */}
      <div id="webhook-step" className="flex w-full scroll-mt-8 flex-col">
        <div className="mb-2 text-lg font-semibold">Setup Webhook</div>
        <Card className="border-muted-foreground/30 p-4">
          <EditableUrlInput
            label="Webhook URL"
            enabledText="Enable webhook"
            initialValue={webhookUrl}
            onSave={handleWebhookSave}
          />
          {webhookUrl ? (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Example Payload:
                </p>
                <button
                  onClick={() => setIsPayloadExpanded(!isPayloadExpanded)}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {isPayloadExpanded ? "Show less" : "Show more"}
                </button>
              </div>
              <pre
                className={`mt-1 rounded-md bg-gray-100 p-3 text-xs whitespace-pre-wrap text-gray-800 dark:bg-gray-800 dark:text-gray-200 ${
                  isPayloadExpanded ? "max-h-none" : "max-h-20 overflow-hidden"
                }`}
              >
                {examplePayload}
              </pre>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

export default Integrations
