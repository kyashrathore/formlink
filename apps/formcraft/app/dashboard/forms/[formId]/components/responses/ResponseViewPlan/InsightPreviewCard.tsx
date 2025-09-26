"use client"

import { Badge } from "@formlink/ui"
import React from "react"

type InsightSpec = { type: string; args?: Record<string, any> }

export function InsightPreviewCard({ spec }: { spec: InsightSpec }) {
  const { type } = spec || ({} as any)
  const args = (spec?.args || {}) as Record<string, any>
  const desc = toDescriptor(type, args)

  return (
    <div className="rounded-md border p-2">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="text-xs leading-snug font-semibold">{desc.title}</div>
      </div>
      {desc.subtitle ? (
        <div className="text-muted-foreground mb-1 text-[11px] leading-snug">
          {desc.subtitle}
        </div>
      ) : null}
      <div className="h-12 w-full">
        <IconChart type={String(type)} args={args} />
      </div>
    </div>
  )
}

function IconChart({
  type,
  args,
}: {
  type: string
  args: Record<string, any>
}) {
  const preferred = String(
    args.chart || (type === "count" ? "bar" : "line")
  ).toLowerCase()
  const stroke = "currentColor"
  const fill = "hsl(var(--primary))"

  if (type === "pie") return <SvgStackedBarHorizontal />
  if (type === "breakdown") return <SvgStackedBarHorizontal />
  if (type === "topk") return <SvgBarsHorizontal />
  if (type === "count") return <SvgZero />
  if (preferred === "area") return <SvgArea />
  return <SvgLine />
}

function SvgLine() {
  return (
    <svg
      viewBox="0 0 100 40"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="text-muted-foreground"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points="0,28 20,20 40,24 60,12 80,16 100,10"
      />
    </svg>
  )
}

function SvgArea() {
  return (
    <svg
      viewBox="0 0 100 40"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <path
        d="M0 28 L20 20 L40 24 L60 12 L80 16 L100 10 L100 40 L0 40 Z"
        fill="hsl(var(--muted-foreground))"
        opacity="0.15"
      />
      <polyline
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="1.4"
        points="0,28 20,20 40,24 60,12 80,16 100,10"
      />
    </svg>
  )
}

function SvgBarsVertical() {
  return (
    <svg
      viewBox="0 0 100 40"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <rect
        x="6"
        y="18"
        width="10"
        height="20"
        rx="2"
        fill="hsl(var(--primary))"
      />
      <rect
        x="26"
        y="10"
        width="10"
        height="28"
        rx="2"
        fill="hsl(var(--primary))"
      />
      <rect
        x="46"
        y="14"
        width="10"
        height="24"
        rx="2"
        fill="hsl(var(--primary))"
      />
      <rect
        x="66"
        y="6"
        width="10"
        height="32"
        rx="2"
        fill="hsl(var(--primary))"
      />
      <rect
        x="86"
        y="12"
        width="10"
        height="26"
        rx="2"
        fill="hsl(var(--primary))"
      />
    </svg>
  )
}

function SvgBarsHorizontal() {
  return (
    <svg
      viewBox="0 0 100 40"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <rect
        x="6"
        y="6"
        width="70"
        height="8"
        rx="2"
        fill="hsl(var(--primary))"
      />
      <rect
        x="6"
        y="18"
        width="48"
        height="8"
        rx="2"
        fill="hsl(var(--primary))"
      />
      <rect
        x="6"
        y="30"
        width="28"
        height="8"
        rx="2"
        fill="hsl(var(--primary))"
      />
    </svg>
  )
}

function SvgStackedBarHorizontal() {
  // Segmented line to suggest distribution/share
  return (
    <svg
      viewBox="0 0 100 40"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      {/* track */}
      <rect x="6" y="17" width="88" height="6" rx="0" fill="#F3F4F6" />
      {/* segments with visible shade differences and small gaps (2px) */}
      <rect x="6" y="17" width="28" height="6" rx="0" fill="#6B7280" />
      <rect x="36" y="17" width="22" height="6" rx="0" fill="#9CA3AF" />
      <rect x="60" y="17" width="16" height="6" rx="0" fill="#D1D5DB" />
      <rect x="78" y="17" width="16" height="6" rx="0" fill="#E5E7EB" />
    </svg>
  )
}

// Pie now uses the same segmented bar visual via SvgStackedBarHorizontal

function SvgZero() {
  return (
    <div className="text-foreground flex h-full w-full items-center justify-start pl-1.5 text-xl font-semibold">
      0
    </div>
  )
}

function toDescriptor(type: string, args: Record<string, any>) {
  const field = safeLabel(args.field)
  const by = safeLabel(args.by)
  const window = args.window ? String(args.window) : ""
  const op = String(args.op || "").toUpperCase()
  const k = args.k ? Number(args.k) : undefined

  switch (type) {
    case "trend": {
      const subtitle = `${field ? `Over ${field}` : "Over time"}${by ? ` • by ${by}` : ""}${window ? ` • ${window}` : ""}`
      return { title: "Trend", field, by, window, subtitle }
    }
    case "count": {
      const subtitle = `${by ? `Grouped by ${by}` : "Total responses"}${window ? ` • ${window}` : ""}`
      return { title: "Count", field: field || undefined, by, window, subtitle }
    }
    case "metric": {
      const title = "Metric"
      const which = op || "AGG"
      const fpart = field ? `${field}` : "value"
      const subtitle = `${which} of ${fpart}${by ? ` • by ${by}` : ""}${window ? ` • ${window}` : ""}`
      return { title, field, by, window, subtitle }
    }
    case "breakdown": {
      // For breakdown, treat 'field' as the dimension; only show 'by' if distinct
      const subtitle = `Distribution of ${field || by || "field"}${window ? ` • ${window}` : ""}`
      return {
        title: "Breakdown",
        field: field || undefined,
        by: by || undefined,
        window,
        subtitle,
      }
    }
    case "topk": {
      const extra = k ? `top ${k}` : "top"
      const subtitle = `Most frequent ${field || "values"}${k ? ` • top ${k}` : ""}${window ? ` • ${window}` : ""}`
      return { title: "Top Values", field, by, window, extra, subtitle }
    }
    case "pie": {
      const subtitle = `Share of ${field || by || "field"}${window ? ` • ${window}` : ""}`
      return { title: "Share", field, by: by || undefined, window, subtitle }
    }
    case "summary":
    case "text": {
      return {
        title: args.title || "Summary",
        field: undefined,
        by: undefined,
        window,
        subtitle: String(args.description || ""),
      }
    }
    default:
      return { title: args.title || "Insight", field, by, window }
  }
}

function safeLabel(v: unknown) {
  if (!v) return ""
  const s = String(v)
  return s.length > 28 ? `${s.slice(0, 25)}…` : s
}

export default InsightPreviewCard
