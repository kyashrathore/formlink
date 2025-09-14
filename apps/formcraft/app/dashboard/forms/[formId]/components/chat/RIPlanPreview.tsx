"use client"

import type { RIPlanResponse } from "@/app/lib/ri/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import {
  CheckCircle2,
  Columns,
  Filter,
  LineChart,
  Save,
  Settings2,
  Table,
  TrendingUp,
} from "lucide-react"
import React from "react"

export default function RIPlanPreview({
  plan,
  saved,
  onSave,
  onOpenResponses,
  onCopyJson,
}: {
  plan: RIPlanResponse
  saved?: boolean
  onSave?: () => void
  onOpenResponses?: () => void
  onCopyJson?: () => void
}) {
  const viewName = plan?.plan?.meta?.view_name || "Smart View"
  const filters = {
    ...(plan?.plan?.rpc?.submission_filters || {}),
    ...(plan?.plan?.rpc?.answer_filters || {}),
  } as Record<string, unknown>
  const columns = plan?.plan?.ui?.columns || []
  const sort = plan?.plan?.ui?.sort
  const insights = plan?.plan?.ui?.insights_spec || []
  const actions = plan?.plan?.actions || []
  const rationale = plan?.plan?.meta?.rationale

  return (
    <Card className="border-muted-foreground/20 bg-muted/30 mb-2">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LineChart className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-sm font-semibold">{viewName}</CardTitle>
            {saved ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </Badge>
            ) : (
              <Badge variant="outline">In‑progress</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!saved && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSave}
                className="gap-1"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            )}
            <Button size="sm" onClick={onOpenResponses} className="gap-1">
              <Table className="h-3.5 w-3.5" /> Open Responses
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rationale ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {rationale}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Section title="Filters" icon={<Filter className="h-3.5 w-3.5" />}>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(filters).length === 0 ? (
                <span className="text-muted-foreground text-xs">None</span>
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
                    className="max-w-[160px] truncate"
                  >
                    {c}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">Auto</span>
              )}
            </div>
          </Section>

          <Section title="Sort" icon={<Settings2 className="h-3.5 w-3.5" />}>
            {sort ? (
              <Badge variant="outline">
                {sort.by} • {sort.dir}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-xs">Default</span>
            )}
          </Section>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Section
            title="Insights"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          >
            <div className="flex flex-wrap gap-1.5">
              {insights.length ? (
                insights.map((ins: any, i: number) => (
                  <Badge key={i} variant="secondary">
                    {ins.type}
                    {ins.args?.window ? ` • ${ins.args.window}` : ""}
                    {ins.args?.field ? ` • ${ins.args.field}` : ""}
                    {ins.args?.by ? ` • by ${ins.args.by}` : ""}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">None</span>
              )}
            </div>
          </Section>

          <Section title="Actions" icon={<Settings2 className="h-3.5 w-3.5" />}>
            <div className="flex flex-wrap gap-1.5">
              {actions?.length ? (
                actions.map((a: any, i: number) => (
                  <Badge key={i} variant="outline">
                    {a.title || a.action_key}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">None</span>
              )}
            </div>
          </Section>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCopyJson}>
            Copy JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="text-foreground/80 flex items-center gap-2 text-xs font-medium">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
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
