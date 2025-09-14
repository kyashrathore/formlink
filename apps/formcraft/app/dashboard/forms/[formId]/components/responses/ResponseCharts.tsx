"use client"

import type { RIPlanResponse } from "@/app/lib/ri/types"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@formlink/ui/ui/chart"
import React, { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

type Row = {
  submission_id: string
  created_at: string
  status: string
  answers?: Record<string, unknown>
}

export default function ResponseCharts({
  plan,
  rows,
  insights,
}: {
  plan: RIPlanResponse | undefined
  rows: Row[]
  insights?: Array<Record<string, unknown>>
}) {
  const specs = plan?.plan?.ui?.insights_spec || []
  if (!specs.length) return null
  const insightMap = new Map<string, any>()
  ;(insights || []).forEach((i: any) => insightMap.set(i?.type, i))

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {specs.map((spec, idx) => (
        <ChartCard
          key={idx}
          spec={spec as any}
          rows={rows}
          serverInsight={insightMap.get((spec as any).type)}
        />
      ))}
    </div>
  )
}

function ChartCard({
  spec,
  rows,
  serverInsight,
}: {
  spec: any
  rows: Row[]
  serverInsight?: any
}) {
  const type = spec?.type as string
  const args = (spec?.args || {}) as Record<string, any>

  if (type === "trend") {
    const data = useMemo(
      () => (serverInsight?.data as any[]) || groupByDay(rows),
      [rows, serverInsight]
    )
    // Detect multi-series
    const isMulti =
      Array.isArray(data) && data[0] && typeof data[0].series === "object"
    if (!isMulti) {
      const chartConfig: ChartConfig = {
        count: { label: "Responses", color: "var(--chart-1)" },
      }
      const shaped = data.map((d: any) => ({
        day: d.bucket ?? d.day,
        count: d.count,
      }))
      return (
        <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
          <LineChart
            accessibilityLayer
            data={shaped}
            margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis width={28} tickLine={false} axisLine={false} />
            <ChartTooltip
              content={<ChartTooltipContent labelKey="day" nameKey="name" />}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--color-count)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )
    }
    // Multi-series: flatten per series keys
    const seriesKeys = Array.from(
      data.reduce((set: Set<string>, d: any) => {
        Object.keys(d.series || {}).forEach((k) => set.add(k))
        return set
      }, new Set<string>())
    )
    const config: ChartConfig = {}
    seriesKeys.forEach((k, idx) => {
      ;(config as any)[k] = {
        label: k,
        color: `var(--chart-${((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5})`,
      }
    })
    const shaped = data.map((d: any) => ({
      day: d.bucket,
      ...d.series,
    }))
    return (
      <ChartContainer config={config} className="min-h-[220px] w-full">
        <LineChart
          accessibilityLayer
          data={shaped}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis width={28} tickLine={false} axisLine={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelKey="day" nameKey="name" />}
          />
          {seriesKeys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={`var(--color-${key})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    )
  }

  if (type === "breakdown") {
    const field = args.field || "status"
    const data = useMemo(
      () => (serverInsight?.data as any[]) || breakdown(rows, field),
      [rows, field, serverInsight]
    )
    const isMulti =
      Array.isArray(data) && data[0] && typeof data[0].series === "object"
    if (!isMulti) {
      const chartConfig: ChartConfig = {
        count: { label: "Count", color: "var(--chart-1)" },
      }
      return (
        <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis width={28} tickLine={false} axisLine={false} />
            <ChartTooltip
              content={<ChartTooltipContent labelKey="name" nameKey="name" />}
            />
            <Bar dataKey="count" radius={4} fill="var(--color-count)" />
          </BarChart>
        </ChartContainer>
      )
    }
    const seriesKeys = Array.from(
      data.reduce((set: Set<string>, d: any) => {
        Object.keys(d.series || {}).forEach((k) => set.add(k))
        return set
      }, new Set<string>())
    )
    const config: ChartConfig = {}
    seriesKeys.forEach((k, idx) => {
      ;(config as any)[k] = {
        label: k,
        color: `var(--chart-${((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5})`,
      }
    })
    const shaped = data.map((d: any) => ({ name: d.name, ...d.series }))
    const stacked = args.stacked !== false
    return (
      <ChartContainer config={config} className="min-h-[220px] w-full">
        <BarChart
          accessibilityLayer
          data={shaped}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis width={28} tickLine={false} axisLine={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelKey="name" nameKey="name" />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {seriesKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              fill={`var(--color-${key})`}
              radius={2}
              stackId={stacked ? "a" : undefined}
            />
          ))}
        </BarChart>
      </ChartContainer>
    )
  }

  // Fallback: nothing for 'count' or unknown
  return null
}

function groupByDay(rows: Row[]) {
  const map = new Map<string, number>()
  rows.forEach((r) => {
    const d = new Date(r.created_at)
    const key = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
    if (!key) return
    map.set(key, (map.get(key) || 0) + 1)
  })
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => ({ day, count, name: "Responses" }))
}

function breakdown(rows: Row[], field: string) {
  const map = new Map<string, number>()
  rows.forEach((r) => {
    let key: string | undefined
    if (field === "status") key = r.status
    else if (field === "created_at")
      key = new Date(r.created_at).toISOString().slice(0, 10)
    else key = String(r.answers?.[field] ?? "Unknown")
    map.set(key, (map.get(key) || 0) + 1)
  })
  let idx = 0
  return Array.from(map.entries()).map(([name, count]) => ({
    name,
    count,
    idx: idx++,
  }))
}
