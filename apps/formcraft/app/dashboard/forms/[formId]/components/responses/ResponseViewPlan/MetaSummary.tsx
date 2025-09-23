"use client"

import { Section } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/Section"
import { Badge, Separator } from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import { Columns, Filter, Settings2 } from "lucide-react"
import React from "react"

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
}: {
  rationale?: string
  filters: Record<string, unknown>
  columns: string[]
  sort?: { by: string; dir: string } | undefined
}) {
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
          <div className="flex flex-wrap gap-1.5">
            {columns.length ? (
              columns.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className={cn(
                    "max-w-[160px] truncate",
                    !DEFAULT_COLUMNS.has(c)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : undefined
                  )}
                >
                  {c}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Auto</span>
            )}
          </div>
        </Section>

        <Section title="Sort" icon={<Settings2 className="h-3.5 w-3.5" />}>
          {sort ? (
            <Badge variant="outline">
              {sort.by} • {sort.dir}
            </Badge>
          ) : (
            <span className="text-muted-foreground">Default</span>
          )}
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
