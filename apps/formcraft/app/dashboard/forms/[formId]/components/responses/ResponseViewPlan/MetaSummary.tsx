"use client"

import { Section } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/Section"
import { DndContext, DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import { Columns, Filter, GripVertical, Settings2, X } from "lucide-react"
import { useMemo } from "react"
import { useResponseViewsStore } from "../../../stores/useResponseViewsStore"
import { useDataTableStore } from "../../data-table/dataTableStore"

const DEFAULT_COLUMNS = new Set([
  "select",
  "submission_id",
  "created_at",
  "status",
  "testmode",
])

export function MetaSummary({
  rationale,
  filters,
  columns,
  sort,
  formId,
}: {
  rationale?: string
  filters: Record<string, unknown>
  columns: string[]
  sort?: { by: string; dir: string } | undefined
  formId?: string
}) {
  const activeView = useResponseViewsStore((s) => {
    if (!formId) return null
    const id = s.activeViewIdMap[formId] || "default"
    return s.views.find((v) => v.id === id && v.formId === formId) || null
  })

  const { setColumnOrder, setColumnVisibility, setSorting } =
    useDataTableStore()

  const canRemove = (key: string) => key !== "select"

  function commitColumns(next: string[]) {
    if (!formId || !activeView) return
    useResponseViewsStore.setState((state: any) => {
      const id = state.activeViewIdMap[formId]
      const idx = state.views.findIndex(
        (v: any) => v.id === id && v.formId === formId
      )
      if (idx < 0) return state
      const v = state.views[idx] as any
      const nextView = {
        ...v,
        columns: next,
        saved: false,
        plan: v.plan
          ? {
              ...v.plan,
              plan: {
                ...v.plan.plan,
                ui: { ...(v.plan.plan.ui || {}), columns: next },
              },
            }
          : v.plan,
      }
      const nextViews = [...state.views]
      nextViews[idx] = nextView
      return { views: nextViews }
    })
    setColumnOrder((prev) => {
      const keep = prev.filter((k) => k === "select" || next.includes(k))
      const rest = next.filter((k) => k !== "select")
      return [
        "select",
        ...rest,
        ...keep.filter((k) => k !== "select" && !rest.includes(k)),
      ]
    })
    setColumnVisibility((prev) => ({
      ...prev,
      ...Object.fromEntries(columns.map((k) => [k, false])),
      ...Object.fromEntries(next.map((k) => [k, true])),
    }))
  }

  function commitSort(by?: string, dir?: "asc" | "desc") {
    if (!formId || !activeView) return
    const next = by && dir ? { by, dir } : undefined
    useResponseViewsStore.setState((state: any) => {
      const id = state.activeViewIdMap[formId]
      const idx = state.views.findIndex(
        (v: any) => v.id === id && v.formId === formId
      )
      if (idx < 0) return state
      const v = state.views[idx] as any
      const nextView = {
        ...v,
        sort: next,
        saved: false,
        plan: v.plan
          ? {
              ...v.plan,
              plan: {
                ...v.plan.plan,
                ui: { ...(v.plan.plan.ui || {}), sort: next },
              },
            }
          : v.plan,
      }
      const nextViews = [...state.views]
      nextViews[idx] = nextView
      return { views: nextViews }
    })
    if (by && dir) setSorting([{ id: by, desc: dir === "desc" }])
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = columns.findIndex((c) => c === active.id)
    const to = columns.findIndex((c) => c === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(columns, from, to)
    commitColumns(next)
  }

  const sortFields = useMemo(() => columns.filter(Boolean), [columns])

  return (
    <>
      {rationale ? (
        <p className="text-muted-foreground leading-relaxed">{rationale}</p>
      ) : null}
      <div className="space-y-2">
        <Section title="Filters" icon={<Filter className="h-3.5 w-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(filters).length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              Object.entries(filters).map(([k, v]) => (
                <Badge
                  key={k}
                  variant="secondary"
                  className="max-w-[180px] truncate"
                >
                  {k}: {formatValue(v)}
                </Badge>
              ))
            )}
          </div>
        </Section>

        <Section title="Columns" icon={<Columns className="h-3.5 w-3.5" />}>
          {columns.length ? (
            <DndContext onDragEnd={onDragEnd}>
              <SortableContext
                items={columns}
                strategy={horizontalListSortingStrategy}
              >
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                  {columns.map((c) => (
                    <SortableChip
                      key={c}
                      id={c}
                      label={c}
                      highlight={!DEFAULT_COLUMNS.has(c)}
                      onRemove={
                        canRemove(c)
                          ? () => commitColumns(columns.filter((x) => x !== c))
                          : undefined
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <span className="text-muted-foreground">Auto</span>
          )}
        </Section>

        <Section title="Sorting" icon={<Settings2 className="h-3.5 w-3.5" />}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={sort?.by || ""}
                onValueChange={(v) =>
                  commitSort(
                    v || undefined,
                    sort?.dir === "desc" ? "desc" : "asc"
                  )
                }
              >
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {sortFields.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sort?.dir === "desc" ? "desc" : "asc"}
                onValueChange={(v) => commitSort(sort?.by, v as "asc" | "desc")}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
              {sort?.by ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => commitSort(undefined, undefined)}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              ) : null}
            </div>
            <div>
              <Button variant="outline" size="sm" disabled>
                + Add Sort
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <Separator />
    </>
  )
}

function formatValue(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function SortableChip({
  id,
  label,
  highlight,
  onRemove,
}: {
  id: string
  label: string
  highlight?: boolean
  onRemove?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style as any}
      className={cn(
        "group relative flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm",
        highlight ? "border-primary/40 bg-primary/10 text-primary" : "bg-muted"
      )}
    >
      <button
        className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center"
        aria-label="Drag"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {onRemove ? (
        <button
          className="text-muted-foreground hover:text-destructive invisible h-5 w-5 rounded group-hover:visible"
          onClick={onRemove}
          aria-label="Remove column"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="h-5 w-5" />
      )}
    </div>
  )
}
