"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@formlink/ui/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@formlink/ui/ui/chart"
import { TrendingUp } from "lucide-react"
import React from "react"
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
} from "recharts"
import type { LineProps } from "recharts"

interface LineChartProps {
  chartData: any[]
  chartConfig: ChartConfig
  title: string
  description: string
  footerText?: string
  dataKeys: string[]
  xAxisDataKey: string
  type?: "natural" | "linear" | "step"
  showDots?: boolean
  interactive?: boolean
  activeKey?: string
  onActiveChange?: (key: string) => void
  customDot?: LineProps["dot"]
}
/**
 * A versatile line chart component that wraps Recharts LineChart.
 * It supports different variants like default, linear, step, multiple lines, and dots.
 *
 * @param {LineChartProps} props - The props for the component.
 * @param {any[]} props.chartData - The data to be displayed in the chart.
 * @param {ChartConfig} props.chartConfig - The configuration for the chart.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.description - The description of the chart.
 * @param {string} [props.footerText] - The text to be displayed in the footer.
 * @param {string[]} props.dataKeys - The keys from the data to be plotted.
 * @param {string} props.xAxisDataKey - The key from the data for the X-axis.
 * @param {'natural' | 'linear' | 'step'} [props.type='natural'] - The type of the line chart.
 * @param {boolean} [props.showDots=false] - Whether to show dots on the lines.
 *
 * @example
 * // Default Line Chart
 * <LineChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Line Chart"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 * />
 *
 * @example
 * // Multiple Line Chart
 * <LineChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Line Chart - Multiple"
 *   description="January - June 2024"
 *   dataKeys={["desktop", "mobile"]}
 *   xAxisDataKey="month"
 * />
 *
 * @example
 * // Line Chart with Dots
 * <LineChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Line Chart - Dots"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 *   showDots={true}
 * />
 */
export function LineChartWrapper({
  chartData,
  chartConfig,
  title,
  description,
  footerText,
  dataKeys,
  xAxisDataKey,
  type = "natural",
  showDots = false,
  interactive = false,
  activeKey,
  onActiveChange,
  customDot,
}: LineChartProps) {
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
                className="data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
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
          <RechartsLineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xAxisDataKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                typeof value === "string" ? value.slice(0, 3) : value
              }
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            {interactive
              ? dataKeys
                  .filter((key) => key === activeKey)
                  .map((key) => (
                    <Line
                      key={key}
                      dataKey={key}
                      type={type}
                      stroke={`var(--color-${key})`}
                      strokeWidth={2}
                      dot={customDot ?? (showDots ? true : false)}
                    />
                  ))
              : dataKeys.map((key) => (
                  <Line
                    key={key}
                    dataKey={key}
                    type={type}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    dot={customDot ?? (showDots ? true : false)}
                  />
                ))}
          </RechartsLineChart>
        </ChartContainer>
      </CardContent>
      {/* Footer removed per UX guidance */}
    </Card>
  )
}
