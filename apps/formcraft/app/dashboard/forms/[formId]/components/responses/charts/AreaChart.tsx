"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@formlink/ui/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@formlink/ui/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formlink/ui/ui/select";
interface AreaChartProps {
  chartData: any[];
  chartConfig: ChartConfig;
  title: string;
  description: string;
  footerText?: string;
  dataKeys: string[];
  xAxisDataKey: string;
  type?: "natural" | "linear" | "step";
  stacked?: boolean;
  showGradient?: boolean;
  showAxes?: boolean;
  interactive?: boolean;
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
  stackOffset?: "expand";
  showLegend?: boolean;
}
/**
 * A versatile area chart component that wraps Recharts AreaChart.
 * It supports different variants like default, linear, step, stacked, and gradient.
 *
 * @param {AreaChartProps} props - The props for the component.
 * @param {any[]} props.chartData - The data to be displayed in the chart.
 * @param {ChartConfig} props.chartConfig - The configuration for the chart.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.description - The description of the chart.
 * @param {string} [props.footerText] - The text to be displayed in the footer.
 * @param {string[]} props.dataKeys - The keys from the data to be plotted.
 * @param {string} props.xAxisDataKey - The key from the data for the X-axis.
 * @param {'natural' | 'linear' | 'step'} [props.type='natural'] - The type of the area chart.
 * @param {boolean} [props.stacked=false] - Whether to stack the areas.
 * @param {boolean} [props.showGradient=false] - Whether to show a gradient fill.
 * @param {boolean} [props.showAxes=false] - Whether to show the Y-axis.
 *
 * @example
 * // Default Area Chart
 * <AreaChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Area Chart"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 * />
 *
 * @example
 * // Stacked Area Chart
 * <AreaChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Area Chart - Stacked"
 *   description="January - June 2024"
 *   dataKeys={["desktop", "mobile"]}
 *   xAxisDataKey="month"
 *   stacked={true}
 * />
 *
 * @example
 * // Gradient Area Chart
 * <AreaChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Area Chart - Gradient"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   xAxisDataKey="month"
 *   showGradient={true}
 * />
 */
export function AreaChartWrapper({
  chartData,
  chartConfig,
  title,
  description,
  footerText,
  dataKeys,
  xAxisDataKey,
  type = "natural",
  stacked = false,
  showGradient = false,
  showAxes = false,
  interactive = false,
  timeRange,
  onTimeRangeChange,
  stackOffset,
  showLegend = false,
}: AreaChartProps) {
  const latestDate = new Date(
    Math.max(...chartData.map((item) => new Date(item.date).getTime()))
  );
  const filteredData = interactive
    ? chartData.filter((item) => {
        const date = new Date(item.date);
        let daysToSubtract = 90;
        if (timeRange === "30d") {
          daysToSubtract = 30;
        } else if (timeRange === "7d") {
          daysToSubtract = 7;
        }
        const startDate = new Date(latestDate);
        startDate.setDate(startDate.getDate() - daysToSubtract);
        return date >= startDate;
      })
    : chartData;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {interactive && onTimeRangeChange && (
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger
              className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <RechartsAreaChart
            accessibilityLayer
            data={filteredData}
            margin={{
              left: showAxes ? -20 : 12,
              right: 12,
            }}
            stackOffset={stackOffset}
          >
            {showGradient && (
              <defs>
                {dataKeys.map((key) => (
                  <linearGradient
                    key={key}
                    id={`fill${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={`var(--color-${key})`}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={`var(--color-${key})`}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                ))}
              </defs>
            )}
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
            {showAxes && (
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickCount={3}
              />
            )}
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            {dataKeys.map((key) => (
              <Area
                key={key}
                dataKey={key}
                type={type}
                fill={
                  showGradient ? `url(#fill${key})` : `var(--color-${key})`
                }
                fillOpacity={showGradient ? 1 : 0.4}
                stroke={`var(--color-${key})`}
                stackId={stacked ? "a" : undefined}
              />
            ))}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
          </RechartsAreaChart>
        </ChartContainer>
      </CardContent>
      {footerText && (
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                {footerText} <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
