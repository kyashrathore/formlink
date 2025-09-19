"use client"

import React, { useMemo } from "react"
import {
  generateGridLayout,
  type InsightItem as AlgoInsightItem,
} from "./gridLayoutAlgorithm"

type IncomingInsightItem = {
  key: React.Key
  type: string
  variant?: string
  node: React.ReactNode
  layout?: { colSpan?: number; rowSpan?: number; minH?: number }
}

// Map provided layout (and type) to a layout variant understood by the algorithm
function toLayoutVariant(item: IncomingInsightItem): 'small' | 'medium' | 'large' {
  const v = String(item.variant || '').toLowerCase()
  const col = item.layout?.colSpan
  const row = item.layout?.rowSpan

  if (typeof col === 'number' || typeof row === 'number') {
    if ((row ?? 0) === 1 && (col ?? 0) <= 3) return 'small'
    if ((col ?? 0) <= 3) return 'medium'
    if ((col ?? 0) >= 6) return 'large'
  }

  const t = item.type
  if (t === 'count' || t === 'kpi' || t === 'metric') return 'small'
  if (v === 'pie' || v === 'donut') return 'medium'
  if (t === 'trend' || t === 'breakdown') return 'large'
  if (t === 'text' || t === 'summary') return 'large'
  return 'large'
}

export default function InsightsGrid({ items }: { items: IncomingInsightItem[] }) {
  const preparedItems: AlgoInsightItem[] = useMemo(() => {
    return items.map((it) => {
      const v = String(it.variant || '').toLowerCase()
      const provided = v === 'small' || v === 'medium' || v === 'large' ? (v as 'small'|'medium'|'large') : undefined
      // Force count to small regardless of provided variant
      const forced: 'small' | undefined = it.type === 'count' ? 'small' : undefined
      return {
        key: it.key,
        type: it.type,
        node: it.node,
        variant: forced ?? provided ?? toLayoutVariant(it),
      }
    })
  }, [items])

  const { items: laidOutItems, containerStyle } = useMemo(
    () => generateGridLayout(preparedItems),
    [preparedItems]
  )

  return (
    <div className="mb-6" style={containerStyle}>
      {laidOutItems.map((item) => {
        if (item.type === 'placeholder') {
          return (
            <div key={item.key} style={item.style} className="h-full rounded-lg border border-dashed bg-muted/10 text-muted-foreground flex items-center justify-center">
              <span className="text-xs">Add another insight</span>
            </div>
          )
        }
        return (
          <div key={item.key} style={item.style} className="h-full min-h-0 overflow-hidden">
            {item.node}
          </div>
        )
      })}
    </div>
  )
}
