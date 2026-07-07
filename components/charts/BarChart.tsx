"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { cn } from "@/lib/utils";
import { useGoalixChartTheme } from "./useGoalixChartTheme";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BarChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
    backgroundColor?: string | string[];
  }[];
  className?: string;
  height?: number;
  horizontal?: boolean;
}

export function BarChart({
  labels,
  datasets,
  className,
  height = 300,
  horizontal = false,
}: BarChartProps) {
  const chartTheme = useGoalixChartTheme();
  const data = useMemo(
    () => ({
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor:
          ds.backgroundColor || `${ds.color || chartTheme.defaultColor}cc`,
        hoverBackgroundColor: ds.color || chartTheme.defaultColor,
        borderRadius: 6,
        borderSkipped: false as const,
        barThickness: 24,
      })),
    }),
    [chartTheme.defaultColor, datasets, labels]
  );

  const options = useMemo(
    () => ({
      indexAxis: horizontal ? ("y" as const) : ("x" as const),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "top" as const,
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
      scales: {
        x: {
          grid: { color: chartTheme.grid, drawBorder: false },
          ticks: { color: chartTheme.axis, font: { size: 11 } },
        },
        y: {
          grid: { color: chartTheme.grid, drawBorder: false },
          ticks: { color: chartTheme.axis, font: { size: 11 } },
        },
      },
    }),
    [chartTheme, datasets.length, horizontal]
  );

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}
