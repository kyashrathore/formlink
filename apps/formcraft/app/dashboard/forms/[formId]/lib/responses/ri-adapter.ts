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
    const allKeys = deriveAllColumnKeys(form)
    const requested = new Set(plan.ui?.columns || [])
    const columnVisibility = allKeys.reduce<Record<string, boolean>>(
      (acc, key) => {
        if (key === "select") acc[key] = true
        else acc[key] = requested.size ? requested.has(key) : true
        return acc
      },
      {}
    )
    // Order: select, requested columns, then the rest
    const rest = allKeys.filter((k) => k !== "select" && !requested.has(k))
    const order = ["select", ...Array.from(requested), ...rest]
    store.setColumnVisibility(columnVisibility)
    store.setColumnOrder(order)
  }
}
