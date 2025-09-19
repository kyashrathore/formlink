"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { Label, LabelList, Pie, PieChart as RechartsPieChart, Sector } from "recharts";
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
interface PieChartProps {
  chartData: any[];
  chartConfig: ChartConfig;
  title: string;
  description: string;
  footerText?: string;
  dataKey: string;
  nameKey: string;
  showLabel?: boolean;
  showLegend?: boolean;
  variant?: "pie" | "donut";
  customLabel?: (props: any) => React.ReactNode;
  showLabelList?: boolean;
  donutText?: string;
  stackedData?: any[];
  interactive?: boolean;
  activeKey?: string;
  onActiveChange?: (key: string) => void;
}
/**
 * A versatile pie chart component that wraps Recharts PieChart.
 * It supports different variants like simple pie, with labels, with legend, and donut.
 *
 * @param {PieChartProps} props - The props for the component.
 * @param {any[]} props.chartData - The data to be displayed in the chart.
 * @param {ChartConfig} props.chartConfig - The configuration for the chart.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.description - The description of the chart.
 * @param {string} [props.footerText] - The text to be displayed in the footer.
 * @param {string} props.dataKey - The key from the data for the values.
 * @param {string} props.nameKey - The key from the data for the names.
 * @param {boolean} [props.showLabel=false] - Whether to show labels on the pie slices.
 * @param {boolean} [props.showLegend=false] - Whether to show a legend.
 * @param {'pie' | 'donut'} [props.variant='pie'] - The variant of the chart.
 *
 * @example
 * // Simple Pie Chart
 * <PieChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Pie Chart"
 *   description="January - June 2024"
 *   dataKey="visitors"
 *   nameKey="browser"
 * />
 *
 * @example
 * // Donut Chart
 * <PieChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Pie Chart - Donut"
 *   description="January - June 2024"
 *   dataKey="visitors"
 *   nameKey="browser"
 *   variant="donut"
 * />
 *
 * @example
 * // Pie Chart with Legend
 * <PieChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Pie Chart - Legend"
 *   description="January - June 2024"
 *   dataKey="visitors"
 *   nameKey="browser"
 *   showLegend={true}
 * />
 */
export function PieChartWrapper({
  chartData,
  chartConfig,
  title,
  description,
  footerText,
  dataKey,
  nameKey,
  showLabel = false,
  showLegend = false,
  variant = "pie",
  customLabel,
  showLabelList = false,
  donutText,
  stackedData,
  interactive = false,
  activeKey,
  onActiveChange,
}: PieChartProps) {
  const innerRadius = variant === "donut" ? 60 : 0;
  const activeIndex = React.useMemo(
    () => chartData.findIndex((item) => item[nameKey] === activeKey),
    [chartData, nameKey, activeKey]
  );
  const total = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr[dataKey], 0),
    [chartData, dataKey]
  );
  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {interactive && onActiveChange && (
          <Select value={activeKey} onValueChange={onActiveChange}>
            <SelectTrigger
              className="ml-auto h-7 w-[130px] rounded-lg pl-2.5"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent align="end" className="rounded-xl">
              {chartData.map((item) => (
                <SelectItem
                  key={item[nameKey]}
                  value={item[nameKey]}
                  className="rounded-lg [&_span]:flex"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-xs"
                      style={{
                        backgroundColor: `var(--color-${item[nameKey]})`,
                      }}
                    />
                    {chartConfig[item[nameKey]]?.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <RechartsPieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey={dataKey}
              nameKey={nameKey}
              innerRadius={innerRadius}
              label={showLabel ? customLabel || true : false}
              activeIndex={interactive ? activeIndex : undefined}
              activeShape={
                interactive
                  ? ({ outerRadius = 0, ...props }) => (
                      <g>
                        <Sector {...props} outerRadius={outerRadius + 10} />
                        <Sector
                          {...props}
                          outerRadius={outerRadius + 25}
                          innerRadius={outerRadius + 12}
                        />
                      </g>
                    )
                  : undefined
              }
            >
              {showLabelList && (
                <LabelList
                  dataKey={nameKey}
                  className="fill-background"
                  stroke="none"
                  fontSize={12}
                  formatter={(value: keyof typeof chartConfig) =>
                    chartConfig[value]?.label
                  }
                />
              )}
              {donutText && (
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            {donutText}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              )}
            </Pie>
            {stackedData && (
              <Pie
                data={stackedData}
                dataKey={dataKey}
                nameKey={nameKey}
                innerRadius={70}
                outerRadius={90}
              />
            )}
            {showLegend && (
              <ChartLegend
                content={<ChartLegendContent nameKey={nameKey} />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            )}
          </RechartsPieChart>
        </ChartContainer>
      </CardContent>
      {/* Footer removed per UX guidance */}
    </Card>
  );
}
