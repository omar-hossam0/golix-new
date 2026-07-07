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

interface AreaChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
    borderColor?: string;
    backgroundColor?: string;
  }[];
  className?: string;
  height?: number;
}

export function AreaChart({
  labels,
  datasets,
  className,
  height = 300,
}: AreaChartProps) {
  const chartTheme = useGoalixChartTheme();
  const data = useMemo(
    () => ({
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.borderColor || ds.color || chartTheme.defaultColor,
        backgroundColor:
          ds.backgroundColor || `${ds.color || chartTheme.defaultColor}15`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
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
          mode: "index" as const,
          intersect: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: chartTheme.axis, font: { size: 11 } },
        },
        y: {
          grid: { color: chartTheme.grid, drawBorder: false },
          ticks: { color: chartTheme.axis, font: { size: 11 } },
        },
      },
      interaction: {
        mode: "nearest" as const,
        axis: "x" as const,
        intersect: false,
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
