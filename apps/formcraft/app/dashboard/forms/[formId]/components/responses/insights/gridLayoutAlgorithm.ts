/**
 * Defines the structure for an input item.
 */
import React from "react"

export type InsightItem = {
  key: React.Key
  type: string
  variant?: "small" | "medium" | "large"
  node: React.ReactNode
  layout?: { colSpan?: number; rowSpan?: number; minH?: number } | undefined
}

/**
 * Defines the structure for a laid-out item, including its style.
 */
export type LayoutItem = Omit<InsightItem, "layout"> & {
  style: {
    gridColumn: string
    gridRow: string
  }
}

/**
 * The final output containing the layout and container styles.
 */
export type GridLayout = {
  items: LayoutItem[]
  containerStyle: React.CSSProperties
}

/**
 * Arranges InsightItem objects into a dense, gap-free 12-column grid layout.
 *
 * - Small items are normalized into pairs (stacks) in a 2-row high area
 * - Medium items occupy full height (2 rows) with width 3 columns
 * - Large items occupy full height (2 rows) with width 6 columns
 * - Rows are greedily packed and last item in a row is expanded to fill leftover space
 */
export const generateGridLayout = (items: InsightItem[]): GridLayout => {
  if (!items || items.length === 0) {
    return { items: [], containerStyle: {} }
  }

  const smallItems = items.filter((item) => item.variant === "small")
  const mediumItems = items.filter((item) => item.variant === "medium")
  const largeItems = items.filter((item) => item.variant === "large")

  // Normalize small cards into stacks of two, padding with placeholders if needed
  const smallCardStacks: Array<
    | { type: "small-stack"; width: number; items: InsightItem[] }
  > = []
  let placeholderCount = 0
  for (let i = 0; i < smallItems.length; i += 2) {
    const stackItems: InsightItem[] = [smallItems[i] as InsightItem]
    if (i + 1 < smallItems.length) {
      stackItems.push(smallItems[i + 1] as InsightItem)
    } else {
      // Default: add placeholder for odd small; we may remove it later if it forms a row alone
      placeholderCount++
      stackItems.push({
        key: `placeholder-${placeholderCount}`,
        type: "placeholder",
        variant: "small",
        node: null,
      })
    }
    smallCardStacks.push({ type: "small-stack", width: 3, items: stackItems })
  }

  // Pack larger items first for a more optimal layout
  const itemQueue: Array<
    | { type: "large"; width: number; items: InsightItem[] }
    | { type: "medium"; width: number; items: InsightItem[] }
    | { type: "small-stack"; width: number; items: InsightItem[] }
  > = [
    ...largeItems.map((item) => ({
      type: "large" as const,
      width: 6,
      items: [item],
    })),
    ...mediumItems.map((item) => ({
      type: "medium" as const,
      width: 3,
      items: [item],
    })),
    ...smallCardStacks,
  ]

  // Greedy row packing into 12 columns
  const layoutRows: (typeof itemQueue)[] = []
  type QItem = (typeof itemQueue)[number]
  const expandRowToFill = (row: QItem[], remainingSpace: number) => {
    if (remainingSpace <= 0 || row.length === 0) return
    const smalls = row.filter((r) => r.type === 'small-stack')
    if (smalls.length > 0) {
      const base = Math.floor(remainingSpace / smalls.length)
      let extra = remainingSpace % smalls.length
      for (const s of smalls) {
        s.width += base + (extra > 0 ? 1 : 0)
        if (extra > 0) extra--
      }
    } else {
      // fallback: expand last item
      row[row.length - 1]!.width += remainingSpace
    }
  }
  let currentRow: typeof itemQueue = []
  let currentRowWidth = 0

  itemQueue.forEach((qItem) => {
    if (currentRowWidth + qItem.width <= 12) {
      currentRow.push(qItem)
      currentRowWidth += qItem.width
    } else {
      const remainingSpace = 12 - currentRowWidth
      if (remainingSpace > 0 && currentRow.length > 0) {
        expandRowToFill(currentRow as QItem[], remainingSpace)
      }
      layoutRows.push(currentRow)
      currentRow = [qItem]
      currentRowWidth = qItem.width
    }
  })

  if (currentRow.length > 0) {
    const remainingSpace = 12 - currentRowWidth
    if (remainingSpace > 0) {
      expandRowToFill(currentRow as QItem[], remainingSpace)
    }
    layoutRows.push(currentRow)
  }

  // If a row has exactly one small-stack whose second item is a placeholder, convert it to a small-single (no placeholder)
  for (let r = 0; r < layoutRows.length; r++) {
    const row = layoutRows[r]!
    if (row.length === 1 && row[0]!.type === 'small-stack') {
      const ss = row[0] as any
      const hasPlaceholder = (ss.items || []).some((it: InsightItem) => it?.type === 'placeholder')
      if (hasPlaceholder) {
        const real = (ss.items as InsightItem[]).find((it) => it?.type !== 'placeholder')
        if (real) {
          row[0] = { type: 'small-stack', width: ss.width, items: [real] } as any
          // we will render it as a single half-height by using the small-single branch below
          ;(row[0] as any).type = 'small-single'
        }
      }
    }
  }

  // Generate CSS positions
  const finalLayoutItems: LayoutItem[] = []
  let currentCssRow = 1
  layoutRows.forEach((row) => {
    let currentCssCol = 1
    row.forEach((qItem) => {
      const itemWidth = qItem.width
      if (qItem.type === "large" || qItem.type === "medium") {
        const originalItem = qItem.items[0]!
        finalLayoutItems.push({
          ...originalItem,
          style: {
            gridColumn: `${currentCssCol} / span ${itemWidth}`,
            gridRow: `${currentCssRow} / span 2`,
          },
        })
      } else if (qItem.type === "small-stack") {
        const [topItem, bottomItem] = qItem.items
        finalLayoutItems.push({
          ...(topItem as InsightItem),
          style: {
            gridColumn: `${currentCssCol} / span ${itemWidth}`,
            gridRow: `${currentCssRow} / span 1`,
          },
        })
        finalLayoutItems.push({
          ...(bottomItem as InsightItem),
          style: {
            gridColumn: `${currentCssCol} / span ${itemWidth}`,
            gridRow: `${currentCssRow + 1} / span 1`,
          },
        })
      } else if (qItem.type === "small-single") {
        const [topItem] = qItem.items
        finalLayoutItems.push({
          ...(topItem as InsightItem),
          style: {
            gridColumn: `${currentCssCol} / span ${itemWidth}`,
            gridRow: `${currentCssRow} / span 1`,
          },
        })
      }
      currentCssCol += itemWidth
    })
    currentCssRow += 2
  })

  const containerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gridAutoRows: "200px",
    gap: "1rem",
  }

  return { items: finalLayoutItems, containerStyle }
}
