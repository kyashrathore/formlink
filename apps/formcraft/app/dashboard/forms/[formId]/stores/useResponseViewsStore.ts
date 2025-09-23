"use client"

import type { RIPlan, RIPlanResponse } from "@/app/lib/ri/types"
import type { Form } from "@formlink/schema"
import { toast } from "@formlink/ui"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useDataTableStore } from "../components/data-table/dataTableStore"

export type ViewSort = { by: string; dir: "asc" | "desc" }

export interface ResponseView {
  id: string
  formId: string
  name: string
  description?: string
  columns: string[]
  sort?: ViewSort
  filters: { id: string; value: unknown }[]
  pageSize: number
  correlationId?: string
  saved?: boolean
  plan?: RIPlanResponse
  insights?: any[]
  actionSlugs?: string[]
  // New: per-view actions with params
  actions?: ActionInView[]
}

export type ActionInView = {
  slug: string
  provider?: "composio" | "usesend"
  toolkit?: string
  toolConnectionId?: string
  params?: Record<string, unknown>
}

export interface ResponseViewsState {
  views: ResponseView[]
  activeViewIdMap: Record<string, string>
  lastPlanStatusMap: Record<
    string,
    { correlationId?: string; status: "unsaved" | "saved" | "discarded" }
  >
  initDefault: (form: Form | null) => void
  loadSavedViews: (formId: string) => Promise<void>
  addOrUpdateFromPlan: (
    plan: RIPlanResponse,
    form: Form | null,
    formIdOverride?: string
  ) => string
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

async function persistViewUpdate(view: ResponseView) {
  try {
    if (!view.formId || view.id === "default") return
    const payload: any = {
      name: view.name,
      columns: view.columns,
      filters: view.filters,
      sort: view.sort,
    }
    if (Array.isArray(view.actions)) payload.actions = view.actions
    const res = await fetch(`/api/forms/${view.formId}/views/${view.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as any
      throw new Error(data?.error || `Failed to update view`)
    }
    toast({
      title: "View updated",
      description: `Saved changes to "${view.name}"`,
      status: "success",
    })
  } catch (e) {
    console.error("[views] persist update failed", e)
    toast({
      title: "Failed to update view",
      description: e instanceof Error ? e.message : String(e),
      status: "error",
    })
  }
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
      lastPlanStatusMap: {},

      initDefault: (form) => {
        // Reset table to default state
        applyDefaultToTable()
        if (!form?.id) return
        set((state) => ({
          ...state,
          activeViewIdMap: { ...state.activeViewIdMap, [form.id]: "default" },
        }))
      },

      // Load saved views for this form from the server and replace any local copies
      loadSavedViews: async (formId: string) => {
        try {
          const res = await fetch(`/api/forms/${formId}/views`, {
            method: "GET",
            credentials: "include",
          })
          if (!res.ok) return
          const json = (await res.json().catch(() => ({}))) as any
          const rows: any[] = Array.isArray(json?.views) ? json.views : []
          const mapped: ResponseView[] = rows.map((row) => ({
            id: row.id,
            formId: row.form_id || formId,
            name: row.name || "Saved View",
            description: row.description || undefined,
            columns: Array.isArray(row.columns) ? row.columns : [],
            sort: row.sort_config || undefined,
            filters: Array.isArray(row.filters) ? row.filters : [],
            pageSize: 20,
            saved: true,
            insights: Array.isArray(row.insights_spec) ? row.insights_spec : [],
            actionSlugs: Array.isArray(row.action_slugs)
              ? (row.action_slugs as any[]).filter((s) => typeof s === "string")
              : [],
            actions: Array.isArray((row as any).actions)
              ? ((row as any).actions as any[])
              : [],
          }))
          set((state) => {
            const keep = state.views.filter(
              (v) => v.formId !== formId || v.id === "default" || !v.saved
            )
            const nextViews = [...keep, ...mapped]
            const currentActive = state.activeViewIdMap[formId]
            const activeExists = nextViews.some((v) => v.id === currentActive)
            return {
              views: nextViews,
              activeViewIdMap: {
                ...state.activeViewIdMap,
                [formId]:
                  activeExists && currentActive ? currentActive : "default",
              },
            }
          })
        } catch {
          // ignore
        }
      },

      addOrUpdateFromPlan: (resp, form, formIdOverride) => {
        const plan = resp.plan
        const id = resp.correlationId || `ri-${Date.now()}`
        const resolvedFormId = form?.id || formIdOverride || "__unknown__"
        const view: ResponseView = {
          id,
          formId: resolvedFormId,
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
          if (existingIdx >= 0) {
            const wasSaved = Boolean(nextViews[existingIdx]?.saved)
            nextViews[existingIdx] = {
              ...nextViews[existingIdx],
              ...view,
              // if user is refining an existing saved view, keep it marked saved
              saved: wasSaved || view.saved,
            }
            // persist updates for previously saved views
            if (wasSaved) {
              void persistViewUpdate(nextViews[existingIdx])
            }
          } else nextViews.push(view)
          const nextActive = resolvedFormId
            ? { ...state.activeViewIdMap, [resolvedFormId]: id }
            : { ...state.activeViewIdMap }
          const nextStatus: ResponseViewsState["lastPlanStatusMap"] = {
            ...state.lastPlanStatusMap,
            [resolvedFormId]: {
              correlationId: resp.correlationId,
              status: "unsaved",
            },
          }
          return {
            views: nextViews,
            activeViewIdMap: nextActive,
            lastPlanStatusMap: nextStatus,
          }
        })
        return id
      },

      setActiveView: (id, form) => {
        const state = get()
        const formId = form?.id
        if (!formId) return
        if (id === "default") {
          applyDefaultToTable()
          set({
            activeViewIdMap: { ...state.activeViewIdMap, [formId]: "default" },
          })
          return
        }
        const view = state.views.find((v) => v.id === id && v.formId === formId)
        if (!view) return
        applyViewToTable(view, form)
        set({ activeViewIdMap: { ...state.activeViewIdMap, [formId]: id } })
      },

      removeView: (id, form) => {
        const formId = form?.id
        const stateBefore = get()
        const view = stateBefore.views.find((v) => v.id === id)
        set((state) => {
          const nextViews = state.views.filter((v) => v.id !== id)
          const nextMap = { ...state.lastPlanStatusMap }
          if (formId && view?.plan && !view?.saved) {
            nextMap[formId] = {
              correlationId: view.correlationId,
              status: "discarded",
            }
          }
          return { views: nextViews, lastPlanStatusMap: nextMap }
        })
        if (formId && get().activeViewIdMap[formId] === id) {
          applyDefaultToTable()
          set({
            activeViewIdMap: { ...get().activeViewIdMap, [formId]: "default" },
          })
        }
      },
    }),
    {
      name: "response-views-store",
      version: 2,
      // Drop any previously persisted `views` and only persist minimal UX state
      migrate: (persisted: any, version: number) => {
        if (!persisted || version < 2) {
          return {
            views: [
              {
                id: "default",
                formId: "__global__",
                name: "Default",
                columns: [],
                filters: [],
                pageSize: 10,
              },
            ],
            activeViewIdMap: (persisted && persisted.activeViewIdMap) || {},
            lastPlanStatusMap: (persisted && persisted.lastPlanStatusMap) || {},
          }
        }
        return persisted
      },
      partialize: (state) => ({
        activeViewIdMap: state.activeViewIdMap,
        lastPlanStatusMap: state.lastPlanStatusMap,
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
