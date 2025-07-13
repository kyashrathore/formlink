"use client"

import EditableUrlInput from "@/app/components/EditableUrlInput"
import { Card } from "@formlink/ui"
import React, { useState } from "react"
import { useFormStore } from "./useFormStore"

const Integrations = ({ userId }: { userId: string }) => {
  const webhookUrl = useFormStore(
    (state) => state.form?.settings?.integrations?.webhookUrl || ""
  )
  const updateSettingField = useFormStore((state) => state.updateSettingField)
  const [isPayloadExpanded, setIsPayloadExpanded] = useState(false)

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
    {
      "q_id": "q_car_body_type",
      "answer": "sedan",
      "is_additional_field": false
    },
    {
      "q_id": "q_car_fuel_type",
      "answer": ["gasoline"],
      "is_additional_field": false
    },
    {
      "q_id": "q_car_seating_capacity",
      "answer": "7plus",
      "is_additional_field": false
    },
    {
      "q_id": "q_car_features",
      "answer": ["sunroof"],
      "is_additional_field": false
    },
    {
      "q_id": "q_car_usage",
      "answer": "commuting",
      "is_additional_field": false
    }
  ]
}`

  const handleWebhookSave = (url: string) => {
    updateSettingField("integrations", { webhookUrl: url })
  }

  return (
    <div
      id="webhook-step"
      data-spy-section="webhook-step"
      className="flex w-full scroll-mt-8 flex-col"
    >
      <div className="mb-2 text-lg font-semibold">Setup Webhook</div>
      <Card className="p-4">
        <EditableUrlInput
          label="Webhook URL"
          enabledText="Enable webhook"
          initialValue={webhookUrl}
          onSave={handleWebhookSave}
        />
        {}
        {webhookUrl && (
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
        )}
      </Card>
    </div>
  )
}

export default Integrations
