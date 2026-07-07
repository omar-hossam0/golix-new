"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { cn } from "@/lib/utils";
import { useGoalixChartTheme } from "./useGoalixChartTheme";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LineChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: Array<number | null>;
    color?: string;
    fill?: boolean;
    borderColor?: string;
    backgroundColor?: string;
  }[];
  className?: string;
  height?: number;
}

export function LineChart({
  labels,
  datasets,
  className,
  height = 300,
}: LineChartProps) {
  const chartTheme = useGoalixChartTheme();
  const data = useMemo(
    () => ({
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.borderColor || ds.color || chartTheme.defaultColor,
        backgroundColor:
          ds.backgroundColor ||
          (ds.fill ? `${ds.color || chartTheme.defaultColor}20` : "transparent"),
        fill: ds.fill || false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: ds.color || chartTheme.defaultColor,
        pointBorderColor: "transparent",
        borderWidth: 2,
      })),
    }),
    [chartTheme.defaultColor, datasets, labels]
  );

  const options = useMemo(
    () => ({
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
    [chartTheme, datasets.length]
  );

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
