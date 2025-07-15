"use client"

import { useFormStore } from "../stores/useFormStore"
import Responses from "./responses/Responses"

export default function ResponsesTabContent() {
  const formFromStore = useFormStore((state) => state.form)

  if (!formFromStore) {
    return (
      <div className="bg-background flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="space-y-4 text-center">
            <h3 className="text-foreground text-xl font-semibold">
              No Form Data
            </h3>
            <p className="text-muted-foreground mx-auto max-w-xs text-sm">
              Please create or load a form to view responses.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="flex-1 overflow-auto p-4">
        <Responses form={formFromStore} />
      </div>
    </div>
  )
}
