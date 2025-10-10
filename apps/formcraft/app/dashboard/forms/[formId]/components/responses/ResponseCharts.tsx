"use client"

import type { RIPlanResponse } from "@/app/lib/ri/types"
import type { Form } from "@formlink/schema"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@formlink/ui"
import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import InsightsGrid from "./insights/InsightsGrid"

export default function ResponseCharts({
  plan,
  insights,
  form,
  search,
  totals,
}: {
  plan: RIPlanResponse | undefined
  insights?: Array<Record<string, unknown>>
  form?: Form
  search?: Record<string, unknown>
  totals?: {
    totalCount: number
    totalCompletedCount: number
    totalInProgressCount: number
    totalFilteredCount: number
  }
}) {
  const specs = plan?.plan?.ui?.insights_spec || []
  if (!specs.length) return null
  const serverInsights = (insights as any[]) || []

  const items = specs
    .map((spec, idx) => {
      const type = (spec as any)?.type as string
      const args = ((spec as any)?.args || {}) as any
      const variant =
        (args?.layout_variant as "small" | "medium" | "large" | undefined) ??
        (type === "metric" && args?.by ? "large" : undefined) ??
        (type === "count" ? "small" : undefined)
      const layout = (spec as any)?.args?.layout as any | undefined
      const si = serverInsights[idx] as any

      // Suppress redundant status breakdowns with <=1 bucket
      if (type === "breakdown") {
        const field = (spec as any)?.args?.field || "status"
        const dataArr = Array.isArray(si?.data) ? si.data : []
        const isSingleSeries = !(
          dataArr[0] && typeof dataArr[0].series === "object"
        )
        if (field === "status" && isSingleSeries && dataArr.length <= 1) {
          return null
        }
      }

      return {
        key: idx,
        type,
        variant,
        layout,
        node: (
          <ChartCard
            spec={spec as any}
            serverInsight={serverInsights[idx]}
            form={form}
            plan={plan}
            search={search}
            totals={totals}
          />
        ),
      }
    })
    .filter(Boolean) as any[]

  return <InsightsGrid items={items} />
}

function ChartCard({
  spec,
  serverInsight,
  form,
  plan,
  search,
  totals,
}: {
  spec: any
  serverInsight?: any
  form?: Form
  plan?: RIPlanResponse | undefined
  search?: Record<string, unknown>
  totals?: {
    totalCount: number
    totalCompletedCount: number
    totalInProgressCount: number
    totalFilteredCount: number
  }
}) {
  const type = spec?.type as string
  const args = (spec?.args || {}) as Record<string, any>
  const minPoints = 3
  const title =
    (args?.title as string | undefined) ??
    getTitle(type, args, form, serverInsight)
  const description =
    (args?.description as string | undefined) ?? getDescription(type, args)
  const isTextSpec = type === "text" || type === "summary"
  const [summaries, setSummaries] = React.useState<
    Array<{ title?: string; content: string }>
  >([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const content = String(args?.content || "").trim()

  React.useEffect(() => {
    if (!isTextSpec) return undefined

    let mounted = true

    const loadSummaries = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/ri/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formId: (form as any)?.id,
            formVersionId:
              (form as any)?.current_published_version_id ||
              (form as any)?.current_draft_version_id ||
              undefined,
            plan: {
              rpc: (plan as any)?.plan?.rpc || {},
              ui: { insights_spec: [spec] },
            },
            search,
          }),
        })
        const json = await res.json()
        if (mounted && Array.isArray(json?.summaries)) {
          setSummaries(json.summaries)
        }
      } catch {
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadSummaries()

    return () => {
      mounted = false
    }
  }, [isTextSpec, spec, form, plan, search])

  if (isTextSpec) {
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle>
            {title || (type === "summary" ? "Summary" : "Insights")}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-muted-foreground text-sm">
              Loading summaries…
            </div>
          ) : summaries.length > 0 ? (
            <div className="space-y-4">
              {summaries.map((s, idx) => (
                <div key={idx} className="space-y-1">
                  {s.title && (
                    <div className="text-sm leading-snug font-bold">
                      {s.title}
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-line">
                    {s.content}
                  </div>
                </div>
              ))}
            </div>
          ) : summaries.length === 0 ? (
            <EmptyChartState />
          ) : content ? (
            <div className="text-sm leading-relaxed whitespace-pre-line">
              {content}
            </div>
          ) : (
            <EmptyChartState />
          )}
        </CardContent>
      </Card>
    )
  }

  if (type === "trend") {
    const preferred = String(args.chart || "line").toLowerCase()
    const data = Array.isArray(serverInsight?.data)
      ? (serverInsight.data as any[])
      : []
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
      const hasEnough = shaped.length >= minPoints
      const target = Number(args?.thresholds?.target ?? NaN)
      const showTarget = !isNaN(target)
      return (
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle>
              <span title={title} className="block max-w-full truncate">
                {title}
              </span>
            </CardTitle>
            <CardDescription>
              <span title={description} className="block max-w-full truncate">
                {description}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden">
            {hasEnough ? (
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-full w-full"
              >
                {preferred === "area" ? (
                  <AreaChart
                    accessibilityLayer
                    data={shaped}
                    margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelKey="day"
                          nameKey="name"
                          formatter={(val: any) => (
                            <span className="flex w-full items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                Responses
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {Number(val).toLocaleString()}
                              </span>
                            </span>
                          )}
                        />
                      }
                    />
                    {showTarget && (
                      <ReferenceLine
                        y={target}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      fill="var(--color-count)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                ) : preferred === "bar" ? (
                  <BarChart
                    accessibilityLayer
                    data={shaped}
                    margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelKey="day"
                          nameKey="name"
                          formatter={(val: any) => (
                            <span className="flex w-full items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                Responses
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {Number(val).toLocaleString()}
                              </span>
                            </span>
                          )}
                        />
                      }
                    />
                    {showTarget && (
                      <ReferenceLine
                        y={target}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Bar dataKey="count" radius={4} fill="var(--color-count)" />
                  </BarChart>
                ) : (
                  <LineChart
                    accessibilityLayer
                    data={shaped}
                    margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelKey="day"
                          nameKey="name"
                          formatter={(val: any) => (
                            <span className="flex w-full items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                Responses
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {Number(val).toLocaleString()}
                              </span>
                            </span>
                          )}
                        />
                      }
                    />
                    {showTarget && (
                      <ReferenceLine
                        y={target}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ChartContainer>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
          {/* Footer removed per UX request */}
        </Card>
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
    const hasEnough = shaped.length >= minPoints
    const target = Number(args?.thresholds?.target ?? NaN)
    const showTarget = !isNaN(target)
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle>
            <span title={title} className="block max-w-full truncate">
              {title}
            </span>
          </CardTitle>
          <CardDescription>
            <span title={description} className="block max-w-full truncate">
              {description}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden">
          {hasEnough ? (
            <ChartContainer
              config={config}
              className="aspect-auto h-full w-full"
            >
              {preferred === "bar" ? (
                <BarChart
                  accessibilityLayer
                  data={shaped}
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelKey="day"
                        nameKey="name"
                        formatter={(val: any) => (
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-muted-foreground">
                              Responses
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {Number(val).toLocaleString()}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  {showTarget && (
                    <ReferenceLine
                      y={target}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                    />
                  )}
                  {seriesKeys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={`var(--color-${key})`}
                      radius={2}
                    />
                  ))}
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              ) : preferred === "area" ? (
                <AreaChart
                  accessibilityLayer
                  data={shaped}
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelKey="day"
                        nameKey="name"
                        formatter={(val: any) => (
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-muted-foreground">
                              Responses
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {Number(val).toLocaleString()}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  {showTarget && (
                    <ReferenceLine
                      y={target}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                    />
                  )}
                  {seriesKeys.map((key) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={`var(--color-${key})`}
                      fill={`var(--color-${key})`}
                      fillOpacity={0.2}
                    />
                  ))}
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              ) : (
                <LineChart
                  accessibilityLayer
                  data={shaped}
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelKey="day"
                        nameKey="name"
                        formatter={(val: any) => (
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-muted-foreground">
                              Responses
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {Number(val).toLocaleString()}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  {showTarget && (
                    <ReferenceLine
                      y={target}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                    />
                  )}
                  {seriesKeys.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={`var(--color-${key})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  <ChartLegend content={<ChartLegendContent />} />
                </LineChart>
              )}
            </ChartContainer>
          ) : (
            <EmptyChartState />
          )}
        </CardContent>
        {/* Footer removed per UX request */}
      </Card>
    )
  }

  if (type === "metric") {
    const field = args.field as string | undefined
    const by = args.by as string | undefined
    const agg = (args.agg as string | undefined) || "avg"
    const fmt = (args.format as string | undefined) || "number"
    const formatVal = (n: number) =>
      fmt === "currency"
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(n)
        : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
            n
          )

    // Series (metric by category) → bar chart
    const seriesData = Array.isArray(serverInsight?.data)
      ? (serverInsight.data as any[])
      : undefined
    if (by && seriesData && seriesData.length) {
      const config: ChartConfig = {
        value: { label: agg.toUpperCase(), color: "var(--chart-1)" },
      }
      const shaped = seriesData.map((d) => ({ name: d.name, value: d.value }))
      const hasEnough = shaped.length >= 1
      const fieldLabel = getFieldLabelFromForm(field || "", form) || field
      return (
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle>
              <span
                title={title || `${agg.toUpperCase()} ${fieldLabel}`}
                className="block max-w-full truncate"
              >
                {title || `${agg.toUpperCase()} ${fieldLabel}`}
              </span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden">
            {hasEnough ? (
              <ChartContainer
                config={config}
                className="aspect-auto h-full w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={shaped}
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={<AxisTick max={16} />}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelKey="name"
                        nameKey="name"
                        formatter={(
                          val: any,
                          name: any,
                          _item?: any,
                          _idx?: number,
                          payload?: any
                        ) => {
                          const payloadName = Array.isArray(payload)
                            ? payload[0]?.name
                            : typeof payload === "object" && payload !== null
                              ? (payload as { name?: unknown }).name
                              : undefined
                          const labelValue =
                            typeof payloadName === "string"
                              ? payloadName
                              : String(name)

                          return (
                            <span className="flex w-full items-center justify-between gap-2">
                              <span className="text-muted-foreground max-w-[160px] truncate">
                                <span title={labelValue}>{labelValue}</span>
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {formatVal(Number(val))}
                              </span>
                            </span>
                          )
                        }}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={4} fill="var(--color-value)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
          {/* Footer removed per UX request */}
        </Card>
      )
    }
    // Single KPI metric
    const value = Number(serverInsight?.data?.value ?? NaN)
    const show = isFinite(value)
    const fieldLabel = getFieldLabelFromForm(field || "", form) || field
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle>
            <span
              title={title || `${agg.toUpperCase()} ${fieldLabel}`}
              className="block max-w-full truncate"
            >
              {title || `${agg.toUpperCase()} ${fieldLabel}`}
            </span>
          </CardTitle>
          {description && (
            <CardDescription>
              <span title={description} className="block max-w-[16rem]">
                {description}
              </span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex items-center gap-3">
            <div className="shrink-0 text-5xl leading-none font-bold tabular-nums">
              {show ? formatVal(value) : "–"}
            </div>
            <div className="bg-border h-10 w-px" />
            <div className="text-muted-foreground min-w-0 flex-1 text-sm">
              <span
                title={(args?.label as string) || fieldLabel || ""}
                className="block max-w-[2/5] truncate"
              >
                {(args?.label as string) || fieldLabel}
              </span>
            </div>
          </div>
        </CardContent>
        {/* Footer removed per UX request */}
      </Card>
    )
  }

  if (type === "breakdown") {
    const field = args.field || "status"
    const preferred = String(args.chart || "bar").toLowerCase()
    const data = Array.isArray(serverInsight?.data)
      ? (serverInsight.data as any[])
      : []
    const isMulti =
      Array.isArray(data) && data[0] && typeof data[0].series === "object"
    if (!isMulti) {
      const chartConfig: ChartConfig = {
        count: { label: "Count", color: "var(--chart-1)" },
      }
      const buckets = data?.length || 0
      const hasEnough = buckets >= 1
      if (field === "status" && buckets <= 1) {
        return null
      }
      const target = Number(args?.thresholds?.target ?? NaN)
      const showTarget = !isNaN(target)
      return (
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle>
              <span title={title} className="block max-w-full truncate">
                {title}
              </span>
            </CardTitle>
            <CardDescription>
              <span title={description} className="block max-w-full truncate">
                {description}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden">
            {hasEnough ? (
              preferred === "pie" ? (
                <ChartContainer
                  config={{}}
                  className="aspect-auto h-full w-full"
                >
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.map((_: any, i: number) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={`var(--chart-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5})`}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent nameKey="name" />}
                    />
                  </PieChart>
                </ChartContainer>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-full w-full"
                >
                  <BarChart
                    accessibilityLayer
                    data={data}
                    margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={<AxisTick max={16} />}
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelKey="name"
                          nameKey="name"
                          formatter={(
                            val: any,
                            name: any,
                            _item?: any,
                            _idx?: number,
                            payload?: any
                          ) => {
                            const payloadName = Array.isArray(payload)
                              ? payload[0]?.name
                              : typeof payload === "object" && payload !== null
                                ? (payload as { name?: unknown }).name
                                : undefined
                            const labelValue =
                              typeof payloadName === "string"
                                ? payloadName
                                : String(name)

                            return (
                              <span className="flex w-full items-center justify-between gap-2">
                                <span className="text-muted-foreground max-w-[160px] truncate">
                                  <span title={labelValue}>{labelValue}</span>
                                </span>
                                <span className="font-mono font-medium tabular-nums">
                                  {Number(val).toLocaleString()} Responses
                                </span>
                              </span>
                            )
                          }}
                        />
                      }
                    />
                    {showTarget && (
                      <ReferenceLine
                        y={target}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Bar dataKey="count" radius={4} fill="var(--color-count)" />
                  </BarChart>
                </ChartContainer>
              )
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
          {/* Footer removed per UX request */}
        </Card>
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
    const hasEnough = (shaped?.length || 0) >= 1
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden">
          {hasEnough ? (
            <ChartContainer
              config={config}
              className="aspect-auto h-full w-full"
            >
              <BarChart
                accessibilityLayer
                data={shaped}
                margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={<AxisTick max={16} />}
                />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelKey="name"
                      nameKey="name"
                      formatter={(
                        val: any,
                        name: any,
                        _item?: any,
                        _idx?: number,
                        payload?: any
                      ) => {
                        const payloadName = Array.isArray(payload)
                          ? payload[0]?.name
                          : typeof payload === "object" && payload !== null
                            ? (payload as { name?: unknown }).name
                            : undefined
                        const labelValue =
                          typeof payloadName === "string"
                            ? payloadName
                            : String(name)

                        return (
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-muted-foreground max-w-[160px] truncate">
                              <span title={labelValue}>{labelValue}</span>
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {Number(val).toLocaleString()} Responses
                            </span>
                          </span>
                        )
                      }}
                    />
                  }
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
          ) : (
            <EmptyChartState />
          )}
        </CardContent>
        {/* Footer removed per UX request */}
      </Card>
    )
  }

  if (type === "count") {
    const label = (args?.label as string | undefined) ?? "Count"
    const composite = args?.composite as any
    let value: number
    if (composite) {
      const env: Record<string, number> = {
        completed: totals?.totalCompletedCount ?? 0,
        total: totals?.totalFilteredCount ?? totals?.totalCount ?? 0,
        in_progress: totals?.totalInProgressCount ?? 0,
      }
      value = safeEvalFormula(String(composite.formula || "0"), env)
    } else {
      value = Number(serverInsight?.count ?? 0)
    }
    const thresholds = args?.thresholds as any
    const target = Number(thresholds?.target ?? NaN)
    const tone = getTone(value, thresholds)
    const comparison = args?.comparison as any
    const deltaToTarget = !isNaN(target) ? value - target : undefined
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle>{(args?.title as string) ?? label}</CardTitle>
          {((args?.description as string) || label) && (
            <CardDescription>
              {(args?.description as string) ??
                "Total matching the current filters"}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex items-center gap-3">
            <div className="shrink-0 text-5xl leading-none font-bold tabular-nums">
              {formatNumber(value)}
            </div>
            <div className="bg-border h-10 w-px" />
            <div className="text-muted-foreground min-w-0 flex-1 text-sm">
              <span title={label} className="block max-w-[12rem] truncate">
                {label}
              </span>
              {comparison?.baseline === "target" && !isNaN(target) && (
                <span
                  className="ml-0.5 block truncate"
                  title={`${deltaToTarget! >= 0 ? "+" : ""}${formatNumber(deltaToTarget!)} vs target`}
                >
                  ({deltaToTarget! >= 0 ? "+" : ""}
                  {formatNumber(deltaToTarget!)} vs target)
                </span>
              )}
            </div>
            {tone.badge && (
              <Badge className={tone.className}>{tone.badge}</Badge>
            )}
          </div>
        </CardContent>
        {/* Footer removed per UX request */}
      </Card>
    )
  }

  // Fallback: nothing for 'count' or unknown
  return null
}

function getTitle(
  type: string,
  args: Record<string, any>,
  form?: Form,
  serverInsight?: any
) {
  if (type === "trend") {
    const win = args.window as string | undefined
    return `Responses Trend${win ? ` (${win})` : ""}`
  }
  if (type === "breakdown") {
    const rawField = args.field || serverInsight?.field || "status"
    const baseField =
      typeof rawField === "string" && rawField.includes(":")
        ? rawField.split(":")[0]
        : rawField
    const human =
      serverInsight?.field_label || getFieldLabelFromForm(baseField, form)
    return `Breakdown by ${human || String(baseField)}`
  }
  if (type === "count") return args?.label || "Count"
  return "Insight"
}

function getDescription(type: string, args: Record<string, any>) {
  if (type === "trend") {
    const by = args.by ? ` by ${args.by}` : ""
    const win = args.window ? ` over ${args.window}` : ""
    const field =
      args.field && args.field !== "created_at" ? ` using ${args.field}` : ""
    return `Daily submissions${by}${win}${field}.`
  }
  if (type === "breakdown") {
    const by = args.by ? `, grouped by ${args.by}` : ""
    const field = args.field || "status"
    return `Top categories for ${field}${by}.`
  }
  return ""
}

function EmptyChartState() {
  return (
    <div className="bg-muted/30 text-muted-foreground flex h-[220px] w-full items-center justify-center rounded-md border border-dashed">
      Not enough data yet.
    </div>
  )
}

// SVG axis tick with truncation + native tooltip for long labels
function AxisTick({ x, y, payload, max = 16 }: any) {
  const raw = String(payload?.value ?? "")
  const text = raw.length > max ? raw.slice(0, max - 1) + "…" : raw
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={16} textAnchor="middle" className="fill-muted-foreground">
        <title>{raw}</title>
        {text}
      </text>
    </g>
  )
}

function getFieldLabelFromForm(field: string, form?: Form): string | undefined {
  const q = form?.questions?.find((qq: any) => qq?.id === field)
  return (q as any)?.title || (q as any)?.label || undefined
}

function formatNumber(n: number) {
  if (!isFinite(n)) return "–"
  return Math.abs(n) >= 1000 ? n.toLocaleString() : n.toString()
}

function getTone(
  value: number,
  thresholds?: { warning?: number; critical?: number; target?: number }
) {
  if (!thresholds) return { badge: null as any, className: "" }
  const { target, warning, critical } = thresholds as any
  if (typeof target === "number" && value >= target)
    return { badge: "On Target", className: "bg-emerald-600 text-white" }
  if (typeof critical === "number" && value < critical)
    return { badge: "Critical", className: "bg-red-600 text-white" }
  if (typeof warning === "number" && value < warning)
    return { badge: "Watch", className: "bg-amber-500 text-white" }
  return { badge: null as any, className: "" }
}

function safeEvalFormula(expr: string, env: Record<string, number>) {
  let s = expr
  Object.keys(env).forEach((k) => {
    const re = new RegExp(`\\b${k}\\b`, "g")
    s = s.replace(re, String(env[k]))
  })
  if (!/^[-+*/().\d\s%]+$/.test(s)) {
    s = s.replace(/[A-Za-z]+/g, "")
  }
  try {
    const val = Function(`return (${s})`)()
    return typeof val === "number" && isFinite(val) ? val : 0
  } catch {
    return 0
  }
}
