"use client"

import { Button } from "@formlink/ui"
import { Save, X } from "lucide-react"
import React from "react"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import {
  saveActiveView,
  useResponseViewsStore,
} from "../../stores/useResponseViewsStore"

export default function ResponseViewsTabs() {
  const form = useFormEditorStore((s) => s.form)
  const { views, activeViewId, setActiveView, removeView } =
    useResponseViewsStore()

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {views.map((v) => {
        const isActive = v.id === activeViewId
        return (
          <div
            key={v.id}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${isActive ? "bg-accent border-accent-foreground/20" : "bg-muted"}`}
          >
            <button
              className={`font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}
              onClick={() => setActiveView(v.id, form || null)}
            >
              {v.name}
            </button>
            {v.id !== "default" && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-5 w-5"
                onClick={() => removeView(v.id)}
                aria-label={`Close ${v.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            {v.id !== "default" && !v.saved && isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-5 w-5"
                onClick={() => saveActiveView()}
                aria-label={`Save ${v.name}`}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
