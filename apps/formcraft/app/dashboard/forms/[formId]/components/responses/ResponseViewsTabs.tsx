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
        {/* Remove fixed height from TabsList (override with h-auto) */}
        <TabsList className="flex h-auto flex-wrap">
          {filteredViews.map((v) => {
            return (
              // Ensure inner chip wrapper has radius similar to parent and clips child
              <div
                key={v.id}
                className="mr-1 inline-flex items-center overflow-hidden rounded-lg"
              >
                {/* Restore rounded corners on active state for single/lone chip visuals */}
                <TabsTrigger
                  value={v.id}
                  className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:rounded-lg"
                >
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
