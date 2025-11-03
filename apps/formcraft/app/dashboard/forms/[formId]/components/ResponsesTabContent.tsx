"use client"

import { useEffect } from "react"
import { useFormEditorStore } from "../stores/useFormEditorStore"
import { useResponseViewsStore } from "../stores/useResponseViewsStore"
import Responses from "./responses/Responses"

export default function ResponsesTabContent() {
  const formFromStore = useFormEditorStore((state) => state.form)

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
        <WarnOnUnloadIfUnsavedPlan formId={formFromStore.id} />
        <DiscardUnsavedPlanOnReload formId={formFromStore.id} />
        {/* Hydrate saved views from server for this form; fall back to Default */}
        <HydrateSavedViews formId={formFromStore.id} />
        <Responses form={formFromStore} />
      </div>
    </div>
  )
}

function DiscardUnsavedPlanOnReload({ formId }: { formId: string }) {
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as any
      const isReload = nav && nav.type === "reload"
      if (!isReload) return
      const store = useResponseViewsStore.getState()
      const id = store.activeViewIdMap[formId] || "default"
      const view = store.views.find((v) => v.id === id && v.formId === formId)
      if (view && view.plan && !view.saved) {
        store.removeView(view.id, { id: formId } as any)
      }
    } catch (_) {
      // no-op
    }
  }, [formId])
  return null
}

function HydrateSavedViews({ formId }: { formId: string }) {
  const loadSavedViews = useResponseViewsStore((s) => s.loadSavedViews)
  const initDefault = useResponseViewsStore((s) => s.initDefault)
  const form = useFormEditorStore((s) => s.form)
  useEffect(() => {
    if (!formId) return
    initDefault(form || null)
    void loadSavedViews(formId)
  }, [formId])
  return null
}

function WarnOnUnloadIfUnsavedPlan({ formId }: { formId: string }) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      try {
        const store = useResponseViewsStore.getState()
        const id = store.activeViewIdMap[formId] || "default"
        const view = store.views.find((v) => v.id === id && v.formId === formId)
        if (view && view.plan && !view.saved) {
          e.preventDefault()
          e.returnValue = ""
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [formId])
  return null
}
