"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@formlink/ui"
import type { PolarAngleAxisProps } from "recharts"
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart as RechartsRadarChart,
} from "recharts"

interface RadarChartProps {
  chartData: any[]
  chartConfig: ChartConfig
  title: string
  description: string
  footerText?: string
  dataKeys: string[]
  polarAngleKey: string
  showDots?: boolean
  linesOnly?: boolean
  showLegend?: boolean
  gridType?: "polygon" | "circle"
  customTick?: PolarAngleAxisProps["tick"]
  radialLines?: boolean
  polarRadius?: number[]
  strokeWidth?: number
  gridFill?: boolean
  noGrid?: boolean
}
/**
 * A versatile radar chart component that wraps Recharts RadarChart.
 * It supports different variants like default, with dots, lines only, multiple data, and with legend.
 *
 * @param {RadarChartProps} props - The props for the component.
 * @param {any[]} props.chartData - The data to be displayed in the chart.
 * @param {ChartConfig} props.chartConfig - The configuration for the chart.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.description - The description of the chart.
 * @param {string} [props.footerText] - The text to be displayed in the footer.
 * @param {string[]} props.dataKeys - The keys from the data to be plotted.
 * @param {string} props.polarAngleKey - The key from the data for the polar angle axis.
 * @param {boolean} [props.showDots=false] - Whether to show dots on the radar.
 * @param {boolean} [props.linesOnly=false] - Whether to show only the lines.
 * @param {boolean} [props.showLegend=false] - Whether to show a legend.
 * @param {'polygon' | 'circle'} [props.gridType='polygon'] - The type of the grid.
 *
 * @example
 * // Default Radar Chart
 * <RadarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Radar Chart"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   polarAngleKey="month"
 * />
 *
 * @example
 * // Radar Chart with Dots
 * <RadarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Radar Chart - Dots"
 *   description="January - June 2024"
 *   dataKeys={["desktop"]}
 *   polarAngleKey="month"
 *   showDots={true}
 * />
 *
 * @example
 * // Radar Chart with Lines Only
 * <RadarChartWrapper
 *   chartData={data}
 *   chartConfig={config}
 *   title="Radar Chart - Lines Only"
 *   description="January - June 2024"
 *   dataKeys={["desktop", "mobile"]}
 *   polarAngleKey="month"
 *   linesOnly={true}
 * />
 */
export function RadarChartWrapper({
  chartData,
  chartConfig,
  title,
  description,
  dataKeys,
  polarAngleKey,
  showDots = false,
  linesOnly = false,
  showLegend = false,
  gridType = "polygon",
  customTick,
  radialLines = true,
  polarRadius,
  strokeWidth,
  gridFill = false,
  noGrid = false,
}: RadarChartProps) {
  return (
    <Card>
      <CardHeader className="items-center pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RechartsRadarChart data={chartData}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey={polarAngleKey} tick={customTick} />
            {!noGrid && (
              <PolarGrid
                gridType={gridType}
                radialLines={radialLines}
                polarRadius={polarRadius}
                strokeWidth={strokeWidth}
                className={gridFill ? "fill-primary opacity-20" : ""}
              />
            )}
            {dataKeys.map((key) => (
              <Radar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                fillOpacity={linesOnly ? 0 : 0.6}
                stroke={linesOnly ? `var(--color-${key})` : undefined}
                strokeWidth={linesOnly ? 2 : undefined}
                dot={showDots}
              />
            ))}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
          </RechartsRadarChart>
        </ChartContainer>
      </CardContent>
      {/* Footer removed per UX guidance */}
    </Card>
  )
}
