"use client";

import { useEffect, useMemo, useState } from "react";

export const GOALIX_CHART_COLORS = [
  "#2d9ad5",
  "#7bea28",
  "#b6ff00",
  "#2ee8c9",
  "#071b2c",
  "#75d6e8",
  "#8ed36e",
  "#9fb2c5",
];

export function useGoalixChartTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const syncTheme = () => {
      const next = document.documentElement.dataset.goalixDashboardTheme;
      setTheme(next === "dark" ? "dark" : "light");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-goalix-dashboard-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return useMemo(
    () => ({
      defaultColor: GOALIX_CHART_COLORS[0],
      legend: theme === "dark" ? "#9fb2c5" : "#536358",
      axis: theme === "dark" ? "#9fb2c5" : "#64736a",
      grid: theme === "dark" ? "rgba(45,154,213,0.13)" : "rgba(15,34,25,0.08)",
      tooltipBackground: theme === "dark" ? "#071b2c" : "#ffffff",
      tooltipTitle: theme === "dark" ? "#edf7ff" : "#121a16",
      tooltipBody: theme === "dark" ? "#9fb2c5" : "#536358",
      tooltipBorder: theme === "dark" ? "rgba(45,154,213,0.22)" : "rgba(15,34,25,0.1)",
    }),
    [theme],
  );
}
