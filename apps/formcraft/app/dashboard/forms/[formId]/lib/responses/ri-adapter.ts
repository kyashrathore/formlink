"use client"

import type { RIPlan, RIPlanResponse } from "@/app/lib/ri/types"
import type { Form } from "@formlink/schema"
import { useDataTableStore } from "../../components/data-table/dataTableStore"

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function deriveAllColumnKeys(form: Form): string[] {
  const base = ["select", "submission_id", "created_at", "status", "testmode"]
  const qIds = Array.isArray(form?.questions)
    ? form.questions.map((q: any) => q?.id).filter(Boolean)
    : []
  return [...base, ...qIds]
}

function toColumnFilters(plan: RIPlan) {
  const filters: { id: string; value: unknown }[] = []
  const pushEntries = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj || {})) {
      if (value !== undefined) filters.push({ id: key, value })
    }
  }
  pushEntries(plan.rpc?.submission_filters || {})
  pushEntries(plan.rpc?.answer_filters || {})
  return filters
}

export function applyRIPlanToUI(resp: RIPlanResponse, form: Form | null) {
  const plan = resp.plan
  const store = useDataTableStore.getState()

  // Pagination
  const pageSize = clamp(plan.rpc?.page_size ?? 20, 10, 200)
  store.setPagination({ pageIndex: 0, pageSize })

  // Sorting
  if (plan.ui?.sort?.by) {
    store.setSorting([
      {
        id: plan.ui.sort.by,
        desc: (plan.ui.sort.dir || "desc") === "desc",
      },
    ])
  } else {
    store.setSorting([])
  }

  // Filters
  store.setColumnFilters(toColumnFilters(plan))

  // Column visibility and order (best effort)
  if (form) {
    const requested = new Set(plan.ui?.columns || [])
    if (requested.size > 0) {
      store.setColumnVisibility((prev) => {
        const next = { ...prev }
        requested.forEach((key) => {
          if (key) next[key] = true
        })
        return next
      })

      store.setColumnOrder((prev) => {
        const baseOrder = prev.length ? [...prev] : deriveAllColumnKeys(form)
        const existing = new Set(baseOrder)
        let changed = false
        requested.forEach((key) => {
          if (!key) return
          if (!existing.has(key)) {
            baseOrder.push(key)
            existing.add(key)
            changed = true
          }
        })
        return changed ? baseOrder : prev.length ? prev : baseOrder
      })
    } else {
      store.setColumnOrder((prev) =>
        prev.length ? prev : deriveAllColumnKeys(form)
      )
    }
  }
}
