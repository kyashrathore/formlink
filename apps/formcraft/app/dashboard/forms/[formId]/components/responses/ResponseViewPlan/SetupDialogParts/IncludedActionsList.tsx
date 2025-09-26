"use client"

import { humanizeToolkit } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { Badge } from "@formlink/ui"
import React from "react"

export type ActionItem = {
  slug: string
  label: string
  provider: string
  toolkit?: string
  status: string
  configured: boolean
  configLabel?: string
  toolSlug?: string
  toolLabel?: string
  uiStatus?: "ready" | "needs_auth" | "needs_setup"
}

export function IncludedActionsList({
  currentItem,
  includedActionsForCurrent,
}: {
  currentItem: ActionItem
  includedActionsForCurrent: ActionItem[]
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Badge
          variant={
            (currentItem.status || "").toLowerCase() === "ready"
              ? "default"
              : "secondary"
          }
        >
          {currentItem.status}
        </Badge>
        <span className="text-muted-foreground">
          Toolkit: {humanizeToolkit(currentItem.toolkit || "")}
        </span>
      </div>

      <div className="rounded-md border p-2">
        <div className="text-muted-foreground mb-1 text-sm font-medium">
          Actions included
        </div>
        <div className="max-w-100 space-y-1">
          {includedActionsForCurrent.map((it) => (
            <div
              key={it.slug}
              className="flex flex-col items-baseline justify-between gap-2"
            >
              <div className="truncate text-sm">{it.label}</div>
              <div className="text-muted-foreground truncate font-mono text-xs">
                {it.toolSlug || it.slug}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
