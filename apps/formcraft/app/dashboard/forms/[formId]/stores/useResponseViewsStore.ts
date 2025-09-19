"use client"

import type { RIPlan, RIPlanResponse } from "@/app/lib/ri/types"
import type { Form } from "@formlink/schema"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useDataTableStore } from "../components/data-table/dataTableStore"

export type ViewSort = { by: string; dir: "asc" | "desc" }

export interface ResponseView {
  id: string
  formId: string
  name: string
  columns: string[]
  sort?: ViewSort
  filters: { id: string; value: unknown }[]
  pageSize: number
  correlationId?: string
  saved?: boolean
  plan?: RIPlanResponse
}

interface ResponseViewsState {
  views: ResponseView[]
  activeViewIdMap: Record<string, string>
  initDefault: (form: Form | null) => void
  addOrUpdateFromPlan: (plan: RIPlanResponse, form: Form | null) => string
  setActiveView: (id: string, form: Form | null) => void
  removeView: (id: string, form?: Form | null) => void
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function deriveAllColumnKeys(form: Form | null): string[] {
  if (!form)
    return ["select", "submission_id", "created_at", "status", "testmode"]
  const base = ["select", "submission_id", "created_at", "status", "testmode"]
  const qIds = Array.isArray((form as any).questions)
    ? (form as any).questions.map((q: any) => q?.id).filter(Boolean)
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

function applyViewToTable(view: ResponseView, form: Form | null) {
  const store = useDataTableStore.getState()
  store.setPagination({ pageIndex: 0, pageSize: clamp(view.pageSize, 10, 200) })
  if (view.sort?.by) {
    store.setSorting([{ id: view.sort.by, desc: view.sort.dir === "desc" }])
  } else {
    store.setSorting([])
  }
  store.setColumnFilters(view.filters)

  // Column visibility/order
  const allKeys = deriveAllColumnKeys(form)
  const requested = new Set(view.columns || [])
  const columnVisibility = allKeys.reduce<Record<string, boolean>>(
    (acc, key) => {
      if (key === "select") acc[key] = true
      else acc[key] = requested.size ? requested.has(key) : true
      return acc
    },
    {}
  )
  const rest = allKeys.filter((k) => k !== "select" && !requested.has(k))
  const order = ["select", ...Array.from(requested), ...rest]
  store.setColumnVisibility(columnVisibility)
  store.setColumnOrder(order)
}

function applyDefaultToTable() {
  const store = useDataTableStore.getState()
  store.setPagination({ pageIndex: 0, pageSize: 10 })
  store.setSorting([])
  store.setColumnFilters([])
  store.setColumnVisibility({})
  store.setColumnOrder([])
}

export const useResponseViewsStore = create<ResponseViewsState>()(
  persist(
    (set, get) => ({
      views: [
        {
          id: "default",
          formId: "__global__",
          name: "Default",
          columns: [],
          sort: undefined,
          filters: [],
          pageSize: 10,
        },
      ],
      activeViewIdMap: {},

      initDefault: (form) => {
        // Reset table to default state
        applyDefaultToTable()
        if (!form?.id) return
        set((state) => ({
          ...state,
          activeViewIdMap: { ...state.activeViewIdMap, [form.id]: "default" },
        }))
      },

      addOrUpdateFromPlan: (resp, form) => {
        const plan = resp.plan
        const id = resp.correlationId || `ri-${Date.now()}`
        const view: ResponseView = {
          id,
          formId: form?.id || "__unknown__",
          name: plan.meta?.view_name || "Smart View",
          columns: plan.ui?.columns || [],
          sort: plan.ui?.sort,
          filters: toColumnFilters(plan),
          pageSize: clamp(plan.rpc?.page_size ?? 20, 10, 200),
          correlationId: resp.correlationId,
          saved: false,
          plan: resp,
        }
        // Apply immediately
        applyViewToTable(view, form)

        set((state) => {
          const existingIdx = state.views.findIndex((v) => v.id === id)
          const nextViews = [...state.views]
          if (existingIdx >= 0)
            nextViews[existingIdx] = { ...nextViews[existingIdx], ...view }
          else nextViews.push(view)
          const fId = form?.id
          const nextActive = fId
            ? { ...state.activeViewIdMap, [fId]: id }
            : { ...state.activeViewIdMap }
          return { views: nextViews, activeViewIdMap: nextActive }
        })
        return id
      },

      setActiveView: (id, form) => {
        const state = get()
        const formId = form?.id
        if (!formId) return
        if (id === "default") {
          applyDefaultToTable()
          set({ activeViewIdMap: { ...state.activeViewIdMap, [formId]: "default" } })
          return
        }
        const view = state.views.find((v) => v.id === id && v.formId === formId)
        if (!view) return
        applyViewToTable(view, form)
        set({ activeViewIdMap: { ...state.activeViewIdMap, [formId]: id } })
      },

      removeView: (id, form) => {
        const formId = form?.id
        set((state) => ({ views: state.views.filter((v) => v.id !== id) }))
        if (formId && get().activeViewIdMap[formId] === id) {
          applyDefaultToTable()
          set({ activeViewIdMap: { ...get().activeViewIdMap, [formId]: "default" } })
        }
      },
    }),
    {
      name: "response-views-store",
      partialize: (state) => ({
        views: state.views,
        activeViewIdMap: state.activeViewIdMap,
      }),
    }
  )
)

export function saveActiveView() {
  const store = useResponseViewsStore.getState()
  // Cannot infer current formId here; rely on current activeViewId across forms
  // This helper will save whichever active view was last set via setActiveView
  const activeEntry = Object.entries(store.activeViewIdMap)[0]
  if (!activeEntry) return
  const [, id] = activeEntry
  if (id === "default") return
  const v = store.views.find((x) => x.id === id)
  if (!v) return
  v.saved = true
  // touch store
  useResponseViewsStore.setState({ views: [...store.views] })
}
