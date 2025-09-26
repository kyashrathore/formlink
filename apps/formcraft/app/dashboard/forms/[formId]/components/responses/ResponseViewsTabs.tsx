"use client"

import { Tabs, TabsList, TabsTrigger } from "@formlink/ui"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import { useResponseViewsStore } from "../../stores/useResponseViewsStore"

export default function ResponseViewsTabs() {
  const form = useFormEditorStore((s) => s.form)
  const { views, activeViewIdMap, setActiveView, removeView } =
    useResponseViewsStore()
  const formId = form?.id
  const filteredViews = (views || []).filter(
    (v) => v.formId === formId || v.id === "default"
  )
  const activeViewId = (formId && activeViewIdMap[formId]) || "default"

  return (
    <div className="flex items-center">
      <Tabs
        value={activeViewId}
        onValueChange={(val) => setActiveView(val, form || null)}
      >
        <TabsList className="flex flex-wrap">
          {filteredViews.map((v) => {
            return (
              <div key={v.id} className="mr-1 inline-flex items-center">
                <TabsTrigger value={v.id} className="px-3 py-1.5 text-sm">
                  {v.name}
                </TabsTrigger>
              </div>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}
