"use client";

import { Loader2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { useGetPlayerProfileQuery } from "@/lib/store/api/calendarApi";
import {
  useGetPlayerMeasurementsQuery,
  type PlayerMeasurement,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type MeasurementWithExtras = PlayerMeasurement &
  Record<string, string | number | null | undefined>;

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const measuredAt = (measurement: MeasurementWithExtras) =>
  measurement.measured_at ??
  (measurement.measuredAt as string | undefined) ??
  (measurement.date as string | undefined) ??
  "";

const monthKey = (value: string) => value.slice(0, 7);

const formatMonth = (value: string) => {
  const key = monthKey(value);
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return value || "Unknown month";
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
};

const metricValue = (
  measurement: MeasurementWithExtras | null | undefined,
  keys: string[],
) => {
  if (!measurement) return null;
  for (const key of keys) {
    const numeric = numberValue(measurement[key]);
    if (numeric !== null) return numeric;
  }
  return null;
};

const getDiff = (curr: number | null, prev: number | null) => {
  if (curr === null || prev === null) return null;
  const diff = curr - prev;
  return {
    value: Math.abs(diff).toFixed(1),
    positive: diff >= 0,
    icon: diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus,
  };
};

const measurementsCopy = {
  en: {
    title: "My Measurements",
    description: "Track your physical development from backend coach measurements.",
    home: "Home",
    profile: "Profile",
    measurements: "Measurements",
    loading: "Loading measurements...",
    progress: "Progress",
    noData: "No coach measurements have been recorded yet.",
    history: "Measurement History",
    month: "Month",
    notes: "Notes",
    metrics: {
      height: "Height",
      weight: "Weight",
      sprintSpeed: "Sprint Speed",
      endurance: "Endurance",
      flexibility: "Flexibility",
    },
  },
  ar: {
    title: "قياساتي",
    description: "تابع تطورك البدني من قياسات المدرب المسجلة في الباك إند.",
    home: "الرئيسية",
    profile: "الملف الشخصي",
    measurements: "القياسات",
    loading: "جاري تحميل القياسات...",
    progress: "التقدم",
    noData: "لم يتم تسجيل قياسات من المدرب حتى الآن.",
    history: "سجل القياسات",
    month: "الشهر",
    notes: "ملاحظات",
    metrics: {
      height: "الطول",
      weight: "الوزن",
      sprintSpeed: "سرعة الجري",
      endurance: "التحمل",
      flexibility: "المرونة",
    },
  },
} as const;

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

export default function PlayerMeasurementsPage() {
  const language = useDashboardLanguage();
  const t = measurementsCopy[language];
  const profileQuery = useGetPlayerProfileQuery();
  const playerId = profileQuery.data?.id;
  const measurementsQuery = useGetPlayerMeasurementsQuery(
    { playerId: playerId ?? "", limit: 100 },
    { skip: !playerId },
  );
  const measurementRows = ((measurementsQuery.data?.data ?? []) as MeasurementWithExtras[])
    .slice()
    .sort((a, b) => measuredAt(a).localeCompare(measuredAt(b)));
  const measurements = Array.from(
    measurementRows
      .reduce((byMonth, measurement) => {
        byMonth.set(monthKey(measuredAt(measurement)), measurement);
        return byMonth;
      }, new Map<string, MeasurementWithExtras>())
      .values(),
  );
  const latest = measurements[measurements.length - 1] ?? null;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;
  const isLoading = profileQuery.isLoading || measurementsQuery.isLoading;

  const chartData = (
    label: string,
    keys: string[],
    color: string,
    unit: string,
  ) => ({
    label,
    unit,
    color,
    points: measurements
      .map((measurement) => ({
        label: formatMonth(measuredAt(measurement)),
        value: metricValue(measurement, keys),
      }))
      .filter((point): point is { label: string; value: number } => point.value !== null),
  });

  const metrics = [
    {
      label: t.metrics.height,
      keys: ["height_cm", "heightCm", "height"],
      unit: "cm",
      color: "text-cyan-200",
      chartColor: "#2d9ad5",
    },
    {
      label: t.metrics.weight,
      keys: ["weight_kg", "weightKg", "weight"],
      unit: "kg",
      color: "text-lime-200",
      chartColor: "#7bea28",
    },
    {
      label: t.metrics.sprintSpeed,
      keys: ["sprint_speed", "sprintSpeed"],
      unit: "s",
      color: "text-amber-200",
      chartColor: "#b6ff00",
      inverseBetter: true,
    },
    {
      label: t.metrics.endurance,
      keys: ["endurance", "stamina"],
      unit: "/10",
      color: "text-violet-200",
      chartColor: "#2ee8c9",
    },
    {
      label: t.metrics.flexibility,
      keys: ["flexibility"],
      unit: "/10",
      color: "text-emerald-200",
      chartColor: "#2ee8c9",
    },
  ];

  const statCards = metrics.map((metric) => {
    const value = metricValue(latest, metric.keys);
    const diff = getDiff(value, metricValue(previous, metric.keys));
    return { ...metric, value, diff };
  });
  const charts = metrics
    .map((metric) =>
      chartData(metric.label, metric.keys, metric.chartColor, metric.unit),
    )
    .filter((chart) => chart.points.length);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.profile, href: "/player/profile" },
          { label: t.measurements },
        ]}
      />

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : measurements.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((stat) => (
              <Card
                key={stat.label}
                className="border-white/10 bg-white/[0.045] shadow-none"
              >
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value === null ? "N/A" : `${stat.value}${stat.unit}`}
                  </p>
                  <p className="mb-1 text-xs text-slate-400">{stat.label}</p>
                  {stat.diff && (
                    <div
                      className={`flex items-center justify-center gap-1 text-xs ${
                        stat.inverseBetter
                          ? stat.diff.positive
                            ? "text-red-400"
                            : "text-emerald-400"
                          : stat.diff.positive
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      <stat.diff.icon className="h-3 w-3" />
                      <span>{stat.diff.value}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {charts.map((chart) => (
              <Card
                key={chart.label}
                className="border-white/10 bg-white/[0.045] shadow-none"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {chart.label} {t.progress}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LineChart
                    labels={chart.points.map((point) => point.label)}
                    datasets={[
                      {
                        label: `${chart.label} (${chart.unit})`,
                        data: chart.points.map((point) => point.value),
                        color: chart.color,
                      },
                    ]}
                    height={250}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-white/10 bg-white/[0.045] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {t.history}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-slate-400">
                      <th className="pb-3 pr-4">{t.month}</th>
                      {metrics.map((metric) => (
                        <th key={metric.label} className="pb-3 pr-4">
                          {metric.label}
                        </th>
                      ))}
                      <th className="pb-3">{t.notes}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements
                      .slice()
                      .reverse()
                      .map((measurement) => (
                        <tr
                          key={measurement.id}
                          className="border-b border-white/10 last:border-0"
                        >
                          <td className="py-3 pr-4">
                            {formatMonth(measuredAt(measurement))}
                          </td>
                          {metrics.map((metric) => {
                            const value = metricValue(measurement, metric.keys);
                            return (
                              <td key={metric.label} className="py-3 pr-4 font-medium">
                                {value === null ? "N/A" : `${value}${metric.unit}`}
                              </td>
                            );
                          })}
                          <td className="py-3 text-slate-400">
                            {measurement.notes || ""}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState text={t.noData} />
      )}
    </div>
  );
}
