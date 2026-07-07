"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { cn } from "@/lib/utils";
import { GOALIX_CHART_COLORS, useGoalixChartTheme } from "./useGoalixChartTheme";

ChartJS.register(ArcElement, Tooltip, Legend);

interface DoughnutChartProps {
  labels: string[];
  data: number[];
  colors?: string[];
  className?: string;
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

const defaultColors = GOALIX_CHART_COLORS;

export function DoughnutChart({
  labels,
  data,
  colors = defaultColors,
  className,
  height = 300,
  centerLabel,
  centerValue,
}: DoughnutChartProps) {
  const chartTheme = useGoalixChartTheme();
  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, data.length).map((c) => `${c}cc`),
          hoverBackgroundColor: colors.slice(0, data.length),
          borderColor: "transparent",
          borderWidth: 0,
          spacing: 2,
        },
      ],
    }),
    [colors, data, labels]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: chartTheme.legend,
            font: { size: 12 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
          },
        },
        tooltip: {
          backgroundColor: chartTheme.tooltipBackground,
          titleColor: chartTheme.tooltipTitle,
          bodyColor: chartTheme.tooltipBody,
          borderColor: chartTheme.tooltipBorder,
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
        },
      },
    }),
    [chartTheme]
  );

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <Doughnut data={chartData} options={options} />
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {centerValue}
          </span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
