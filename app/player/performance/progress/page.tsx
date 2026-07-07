"use client";

import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import {
  useGetPlayerMatchesQuery,
  useGetPlayerProgressQuery,
} from "@/lib/store/api/calendarApi";
import type { Match, MatchPlayerStats } from "@/lib/store/api/calendarApi";
import { formatDate, localDateTimeTimestamp } from "@/lib/utils";

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const ratingPercent = (value: unknown) => {
  const rating = numberValue(value);
  return rating === null ? 0 : Math.max(0, Math.min(100, rating * 10));
};

const chartItem = (label: string, value: unknown) => {
  const numeric = numberValue(value);
  return numeric === null ? null : { label, value: ratingPercent(numeric) };
};

const formatRating = (value: unknown, fallback = "N/A") => {
  const rating = numberValue(value);
  if (rating === null) return fallback;
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
};

const matchTimestamp = (match: Match) => {
  const timestamp = localDateTimeTimestamp(match.match_date, match.match_time);
  if (timestamp) return timestamp;
  return Date.parse(`${match.match_date}T00:00:00`) || 0;
};

const formatMonth = (value: string, locale?: string, fallback = "Unknown month") => {
  const key = value.slice(0, 7);
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return value || fallback;
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
  });
};

const addMonthlyRating = (
  byMonth: Map<string, { total: number; count: number }>,
  dateValue: string | null | undefined,
  ratingValue: unknown,
) => {
  const rating = numberValue(ratingValue);
  if (rating === null) return byMonth;
  const month = (dateValue ?? "").slice(0, 7);
  if (!month) return byMonth;
  const current = byMonth.get(month) ?? { total: 0, count: 0 };
  byMonth.set(month, {
    total: current.total + rating,
    count: current.count + 1,
  });
  return byMonth;
};

const mapToPoints = (
  byMonth: Map<string, { total: number; count: number }>,
  locale?: string,
  fallback?: string,
) =>
  Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, point]) => ({
      label: formatMonth(month, locale, fallback),
      value: ratingPercent(point.total / point.count),
    }));

const monthlyMatchRatingMap = (
  matches: Array<{ match: Match; stats: MatchPlayerStats }>,
  valueGetter: (stats: MatchPlayerStats) => unknown,
) =>
  matches.reduce(
    (byMonth, item) =>
      addMonthlyRating(byMonth, item.match.match_date, valueGetter(item.stats)),
    new Map<string, { total: number; count: number }>(),
  );

const progressCopy = {
  en: {
    title: "Progress Chart",
    description: "Track your published match evaluations by month.",
    home: "Home",
    performance: "Performance",
    loading: "Loading progress...",
    loadError: "Could not load progress data. Please refresh after the backend is restarted.",
    latestOverall: "Latest Match Overall",
    monthlyAttendance: "Monthly Match Attendance",
    monthlyAverage: "Monthly Avg Match",
    goalsAssists: "Monthly Goals / Assists",
    overallTrend: "Monthly Overall Score Trend",
    matchOverall: "Match Overall",
    latestBreakdown: "Latest Match Skill Breakdown",
    score: "Score",
    noBreakdown: "This published evaluation has an overall score, but no skill breakdown fields yet.",
    technical: "Technical",
    tactical: "Tactical",
    physical: "Physical",
    mentality: "Mentality",
    decision: "Decision",
    workRate: "Work Rate",
    positioning: "Positioning",
    coachFeedback: "Coach Feedback",
    match: "Match",
    versus: "vs",
    matchEvaluation: "Match evaluation",
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    improvementPlan: "Improvement Plan",
    coachNotes: "Coach Notes",
    noEvaluations: "No published match evaluations are available yet.",
    noValue: "N/A",
    unknownMonth: "Unknown month",
  },
  ar: {
    title: "مخطط التقدم",
    description: "تابع تقييمات المباريات المنشورة شهريًا.",
    home: "الرئيسية",
    performance: "الأداء",
    loading: "جاري تحميل التقدم...",
    loadError: "تعذر تحميل بيانات التقدم. حدّث الصفحة بعد إعادة تشغيل الخادم.",
    latestOverall: "آخر تقييم عام للمباراة",
    monthlyAttendance: "حضور المباريات شهريًا",
    monthlyAverage: "متوسط تقييم المباريات شهريًا",
    goalsAssists: "الأهداف / التمريرات الحاسمة شهريًا",
    overallTrend: "اتجاه التقييم العام الشهري",
    matchOverall: "التقييم العام للمباراة",
    latestBreakdown: "تفصيل مهارات آخر مباراة",
    score: "النقاط",
    noBreakdown: "هذا التقييم المنشور يحتوي على تقييم عام فقط ولا يحتوي على تفاصيل المهارات بعد.",
    technical: "فني",
    tactical: "تكتيكي",
    physical: "بدني",
    mentality: "ذهني",
    decision: "اتخاذ القرار",
    workRate: "معدل الجهد",
    positioning: "التمركز",
    coachFeedback: "ملاحظات المدرب",
    match: "مباراة",
    versus: "ضد",
    matchEvaluation: "تقييم المباراة",
    strengths: "نقاط القوة",
    weaknesses: "نقاط التحسين",
    improvementPlan: "خطة التطوير",
    coachNotes: "ملاحظات المدرب",
    noEvaluations: "لا توجد تقييمات مباريات منشورة حتى الآن.",
    noValue: "غير متاح",
    unknownMonth: "شهر غير معروف",
  },
} as const;

type ProgressCopy = (typeof progressCopy)[keyof typeof progressCopy];

const matchNotes = (stats: MatchPlayerStats, t: ProgressCopy) => {
  const items: Array<{ label: string; value: string | null | undefined }> = [
    { label: t.strengths, value: stats.strengths },
    { label: t.weaknesses, value: stats.weaknesses },
    { label: t.improvementPlan, value: stats.improvement_plan },
    { label: t.coachNotes, value: stats.coach_notes },
  ];

  return items.filter(
    (item): item is { label: string; value: string } =>
      typeof item.value === "string" && item.value.trim().length > 0,
  );
};

const matchBreakdown = (stats: MatchPlayerStats, t: ProgressCopy) =>
  [
    chartItem(t.technical, stats.technical_rating),
    chartItem(t.tactical, stats.tactical_rating),
    chartItem(t.physical, stats.physical_rating),
    chartItem(t.mentality, stats.mentality_rating),
    chartItem(t.decision, stats.decision_making_rating),
    chartItem(t.workRate, stats.work_rate_rating),
    chartItem(t.positioning, stats.positioning_rating),
  ].filter((item): item is { label: string; value: number } => item !== null);

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

export default function PlayerProgressPage() {
  const language = useDashboardLanguage();
  const t = progressCopy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const progressQuery = useGetPlayerProgressQuery();
  const matchesQuery = useGetPlayerMatchesQuery();
  const matchEvaluations = (matchesQuery.data?.data ?? [])
    .flatMap((match) =>
      (match.stats ?? []).map((stats) => ({
        match,
        stats,
      })),
    )
    .filter((item) => numberValue(item.stats.performance_rating) !== null)
    .sort((a, b) => matchTimestamp(a.match) - matchTimestamp(b.match));
  const latestMatchEval = matchEvaluations[matchEvaluations.length - 1];
  const isLoading = progressQuery.isLoading || matchesQuery.isLoading;

  const matchOverallMap = monthlyMatchRatingMap(
    matchEvaluations,
    (stats) => stats.performance_rating,
  );
  const overallMonths = Array.from(matchOverallMap.keys()).sort();
  const overallData = mapToPoints(matchOverallMap, locale, t.unknownMonth);
  const technicalData = mapToPoints(
    monthlyMatchRatingMap(matchEvaluations, (stats) => stats.technical_rating),
    locale,
    t.unknownMonth,
  );
  const tacticalData = mapToPoints(
    monthlyMatchRatingMap(matchEvaluations, (stats) => stats.tactical_rating),
    locale,
    t.unknownMonth,
  );
  const physicalData = mapToPoints(
    monthlyMatchRatingMap(matchEvaluations, (stats) => stats.physical_rating),
    locale,
    t.unknownMonth,
  );
  const mentalData = mapToPoints(
    monthlyMatchRatingMap(matchEvaluations, (stats) => stats.mentality_rating),
    locale,
    t.unknownMonth,
  );
  const breakdownData = latestMatchEval ? matchBreakdown(latestMatchEval.stats, t) : [];
  const hasPublishedEvaluations = matchEvaluations.length > 0;
  const feedbackItems = [
    ...matchEvaluations.map((item) => ({
      id: `match-${item.stats.id}`,
      type: t.match,
      title: item.match.opponent_name
        ? `${t.versus} ${item.match.opponent_name}`
        : t.matchEvaluation,
      date: item.match.match_date,
      timestamp: matchTimestamp(item.match),
      overall: item.stats.performance_rating,
      notes: matchNotes(item.stats, t),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.performance },
          { label: t.title },
        ]}
      />

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : progressQuery.isError || matchesQuery.isError ? (
        <Card className="border-red-400/30 bg-red-500/10 shadow-none">
          <CardContent className="p-5 text-sm text-red-100">
            {t.loadError}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {t.latestOverall}
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatRating(latestMatchEval?.stats.performance_rating, t.noValue)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {t.monthlyAttendance}
                </p>
                <p className="mt-2 text-3xl font-semibold text-lime-100">
                  {Math.round(progressQuery.data?.matchAttendancePercentage ?? 0)}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {t.monthlyAverage}
                </p>
                <p className="mt-2 text-3xl font-semibold text-amber-100">
                  {formatRating(progressQuery.data?.averageMatchRating, t.noValue)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {t.goalsAssists}
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {progressQuery.data?.goals ?? 0}/{progressQuery.data?.assists ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {hasPublishedEvaluations ? (
            <>
              <Card className="border-white/10 bg-white/[0.045] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {t.overallTrend}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LineChart
                    labels={overallMonths.map((month) => formatMonth(month, locale, t.unknownMonth))}
                    datasets={[
                      {
                        label: t.matchOverall,
                        data: overallData.map((item) => item.value),
                        color: "#f59e0b",
                      },
                    ]}
                    height={300}
                  />
                </CardContent>
              </Card>

              {latestMatchEval && (
                <Card className="border-white/10 bg-white/[0.045] shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">
                      {t.latestBreakdown}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {breakdownData.length ? (
                      <BarChart
                        labels={breakdownData.map((item) => item.label)}
                        datasets={[
                          {
                            label: t.score,
                            data: breakdownData.map((item) => item.value),
                            color: "#7bea28",
                          },
                        ]}
                        height={250}
                      />
                    ) : (
                      <EmptyState text={t.noBreakdown} />
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {[
                  [t.technical, technicalData, "#2d9ad5"],
                  [t.tactical, tacticalData, "#7bea28"],
                  [t.physical, physicalData, "#b6ff00"],
                  [t.mentality, mentalData, "#2ee8c9"],
                ].map(([label, data, color]) => {
                  const points = data as typeof technicalData;
                  return (
                    <Card
                      key={label as string}
                      className="border-white/10 bg-white/[0.045] shadow-none"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">
                          {label as string}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <LineChart
                          labels={points.map((item) => item.label)}
                          datasets={[
                            {
                              label: label as string,
                              data: points.map((item) => item.value),
                              color: color as string,
                            },
                          ]}
                          height={200}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="border-white/10 bg-white/[0.045] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {t.coachFeedback}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {feedbackItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.type} - {formatDate(item.date)}
                          </p>
                        </div>
                        <p className="text-xl font-bold text-cyan-200">
                            {formatRating(item.overall, t.noValue)}
                        </p>
                      </div>
                      {item.notes.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {item.notes.map((note) => (
                            <div
                              key={note.label}
                              className="rounded-md bg-[#06111f]/70 p-3"
                            >
                              <p className="text-[10px] font-semibold uppercase text-slate-500">
                                {note.label}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-300">
                                {note.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState text={t.noEvaluations} />
          )}
        </>
      )}
    </div>
  );
}
