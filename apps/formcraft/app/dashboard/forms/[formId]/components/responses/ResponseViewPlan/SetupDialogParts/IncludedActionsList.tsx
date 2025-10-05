"use client"

import { humanizeToolkit } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { Badge } from "@formlink/ui"
import React, { useMemo } from "react"

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

interface IncludedActionsListProps {
  currentItem: ActionItem
  includedActionsForCurrent: ActionItem[]
}

const STATUS_READY = "ready"

const ActionRow = React.memo(function ActionRow({
  item,
}: {
  item: ActionItem
}) {
  return (
    <div className="flex flex-col items-baseline justify-between gap-2">
      <div className="truncate text-sm">{item.label}</div>
      <div className="text-muted-foreground truncate font-mono text-xs">
        {item.toolSlug || item.slug}
      </div>
    </div>
  )
})

export function IncludedActionsList(props: IncludedActionsListProps) {
  const { currentItem, includedActionsForCurrent } = props

  const statusVariant = useMemo(
    () =>
      (currentItem.status || "").toLowerCase() === STATUS_READY
        ? "default"
        : "secondary",
    [currentItem.status]
  )
  const toolkitLabel = useMemo(
    () => humanizeToolkit(currentItem.toolkit || ""),
    [currentItem.toolkit]
  )

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={statusVariant}>{currentItem.status}</Badge>
        <span className="text-muted-foreground">Toolkit: {toolkitLabel}</span>
      </div>

      <div className="rounded-md border p-2">
        <div className="text-muted-foreground mb-1 text-sm font-medium">
          Actions included
        </div>
        <div className="max-w-100 space-y-1">
          {includedActionsForCurrent.map((it) => (
            <ActionRow key={it.slug} item={it} />
          ))}
        </div>
      </div>
    </>
  )
}
