"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@formlink/ui"
import React from "react"
import {
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  BarChart as RechartsBarChart,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts"

interface BarChartProps {
  chartData: any[]
  chartConfig: ChartConfig
  title: string
  description: string
  dataKeys: string[]
  xAxisDataKey: string
  layout?: "horizontal" | "vertical"
  showLabel?: boolean
  radius?: number
  interactive?: boolean
  activeKey?: string
  onActiveChange?: (key: string) => void
  mixed?: boolean
  activeBar?: boolean
  negative?: boolean
}
/**
 * A versatile bar chart component that wraps Recharts BarChart.
 * It supports different variants like default, multiple, labeled, and vertical layouts.
 *
 * @param {BarChartProps} props - The props for the component.
 * @param {any[]} props.chartData - The data to be displayed in the chart.
 * @param {ChartConfig} props.chartConfig - The configuration for the chart.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.description - The description of the chart.
 * @param {string[]} props.dataKeys - The keys from the data to be plotted.
 * @param {string} props.xAxisDataKey - The key from the data for the X-axis.
 * @param {'horizontal' | 'vertical'} [props.layout='horizontal'] - The layout of the chart.
 * @param {boolean} [props.showLabel=false] - Whether to show labels on the bars.
 *
 * @example
 * // Default Bar Chart
 * <BarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Bar Chart"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 * />
 *
 * @example
 * // Multiple Bar Chart
 * <BarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Bar Chart - Multiple"
 *   description="January - June 2024"
 *   dataKeys={["desktop", "mobile"]}
 *   xAxisDataKey="month"
 * />
 *
 * @example
 * // Bar Chart with Label
 * <BarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Bar Chart - Label"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 *   showLabel={true}
 * />
 *
 * @example
 * // Vertical Bar Chart
 * <BarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Bar Chart - Vertical"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 *   layout="vertical"
 * />
 */
export function BarChartWrapper({
  chartData,
  chartConfig,
  title,
  description,
  dataKeys,
  xAxisDataKey,
  layout = "horizontal",
  showLabel = false,
  radius = 4,
  interactive = false,
  activeKey,
  onActiveChange,
  mixed = false,
  activeBar = false,
  negative = false,
}: BarChartProps) {
  const isVertical = layout === "vertical"
  const total = React.useMemo(
    () =>
      dataKeys.reduce(
        (acc, key) => {
          acc[key] = chartData.reduce((total, item) => total + item[key], 0)
          return acc
        },
        {} as { [key: string]: number }
      ),
    [chartData, dataKeys]
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {interactive && onActiveChange && (
          <div className="flex">
            {dataKeys.map((key) => (
              <button
                key={key}
                data-active={activeKey === key}
                className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                onClick={() => onActiveChange(key)}
              >
                <span className="text-muted-foreground text-xs">
                  {chartConfig[key]?.label}
                </span>
                <span className="text-lg leading-none font-bold sm:text-3xl">
                  {(total[key] ?? 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <RechartsBarChart
            accessibilityLayer
            data={chartData}
            layout={layout}
            margin={isVertical ? { right: 16 } : { top: 20 }}
          >
            <CartesianGrid vertical={!isVertical} horizontal={isVertical} />
            {isVertical ? (
              <YAxis
                dataKey={xAxisDataKey}
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(value) =>
                  chartConfig[value as keyof typeof chartConfig]?.label ||
                  (typeof value === "string" ? value.slice(0, 3) : value)
                }
              />
            ) : (
              <XAxis
                dataKey={xAxisDataKey}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) =>
                  chartConfig[value as keyof typeof chartConfig]?.label ||
                  (typeof value === "string" ? value.slice(0, 3) : value)
                }
              />
            )}
            {isVertical ? (
              <XAxis type="number" hide />
            ) : (
              <YAxis hide={!isVertical} />
            )}
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            {interactive
              ? dataKeys
                  .filter((key) => key === activeKey)
                  .map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={`var(--color-${key})`}
                      radius={radius}
                    />
                  ))
              : dataKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={mixed ? undefined : `var(--color-${key})`}
                    radius={radius}
                    activeIndex={activeBar ? index : undefined}
                    activeBar={
                      activeBar
                        ? ({ ...props }) => (
                            <Rectangle
                              {...props}
                              fillOpacity={0.8}
                              stroke={props.payload.fill}
                              strokeDasharray={4}
                              strokeDashoffset={4}
                            />
                          )
                        : undefined
                    }
                  >
                    {mixed &&
                      chartData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.fill} />
                      ))}
                    {negative &&
                      chartData.map((entry) => (
                        <Cell
                          key={entry[xAxisDataKey]}
                          fill={
                            entry[key] > 0 ? "var(--chart-1)" : "var(--chart-2)"
                          }
                        />
                      ))}
                    {showLabel && (
                      <LabelList
                        position={isVertical ? "right" : "top"}
                        offset={12}
                        className="fill-foreground"
                        fontSize={12}
                      />
                    )}
                  </Bar>
                ))}
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
      {/* Footer removed per UX guidance */}
    </Card>
  )
}
