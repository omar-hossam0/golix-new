"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Download,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetBranchesQuery } from "@/lib/store/api/adminApi";
import {
  type ReportsOverview,
  useGetReportsOverviewQuery,
} from "@/lib/store/api/dashboardApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const formatNumber = (value: number, locale = "en-US") =>
  new Intl.NumberFormat(locale).format(value);

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

function Metric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="border-[#29435f] bg-[#07172a]/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-lime-300/10 text-lime-300">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function AttendanceTrend({
  points,
  emptyText,
}: {
  points: ReportsOverview["attendanceTrend"];
  emptyText: string;
}) {
  const chartPoints = points.map((point, index) => ({
    ...point,
    x: points.length <= 1 ? 260 : 48 + (index * 424) / (points.length - 1),
    y: 190 - (Math.max(0, Math.min(100, point.rate)) / 100) * 145,
  }));

  return (
    <div className="h-[270px]">
      <svg viewBox="0 0 520 235" className="h-full w-full">
        {[0, 25, 50, 75, 100].map((value) => {
          const y = 190 - (value / 100) * 145;
          return (
            <g key={value}>
              <line
                x1="44"
                x2="492"
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.14)"
              />
              <text x="8" y={y + 4} fill="#718096" fontSize="11">
                {value}%
              </text>
            </g>
          );
        })}
        {chartPoints.length > 0 ? (
          <>
            <polyline
              points={chartPoints.map(({ x, y }) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="#b6ff00"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chartPoints.map((point) => (
              <g key={`${point.label}-${point.x}`}>
                <circle cx={point.x} cy={point.y} r="5" fill="#22d3ee" />
                <text
                  x={point.x}
                  y="218"
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </>
        ) : (
          <text x="270" y="122" fill="#94a3b8" fontSize="14" textAnchor="middle">
            {emptyText}
          </text>
        )}
      </svg>
    </div>
  );
}

const reportsCopy = {
  en: {
    overviewTitle: "Goalix reports overview",
    from: "From",
    to: "To",
    metric: "Metric",
    value: "Value",
    totalPlayers: "Total players",
    activePlayers: "Active players",
    newPlayers: "New players",
    coaches: "Coaches",
    sessions: "Sessions",
    attendanceRate: "Attendance rate",
    group: "Group",
    branch: "Branch",
    players: "Players",
    coach: "Coach",
    specialization: "Specialization",
    pageTitle: "Academy Reports",
    pageDescription: "Operational performance from live academy data.",
    refreshReports: "Refresh reports",
    exportCsv: "Export CSV",
    allBranches: "All branches",
    reportsLoadError: "Reports could not be loaded. Check the selected dates and try again.",
    loadingReports: "Loading reports from the database...",
    joinedInPeriod: "{count} joined in selected period",
    activeCoachProfiles: "Active academy coach profiles",
    completed: "{count} completed",
    attendanceMarks: "{count} attendance marks",
    attendanceTrend: "Attendance Trend",
    noAttendanceRecords: "No attendance records in this period",
    playerLevels: "Player Levels",
    level: "Level {level}",
    noActivePlayers: "No active players in this branch.",
    groupPerformance: "Group Performance",
    coachActivity: "Coach Activity",
    playerAttendance: "Player attendance",
    coachFallback: "Coach",
    noCoaches: "No coaches found for this branch.",
  },
  ar: {
    overviewTitle: "نظرة عامة على تقارير Goalix",
    from: "من",
    to: "إلى",
    metric: "المؤشر",
    value: "القيمة",
    totalPlayers: "إجمالي اللاعبين",
    activePlayers: "اللاعبون النشطون",
    newPlayers: "لاعبون جدد",
    coaches: "المدربون",
    sessions: "الحصص",
    attendanceRate: "معدل الحضور",
    group: "المجموعة",
    branch: "الفرع",
    players: "اللاعبون",
    coach: "المدرب",
    specialization: "التخصص",
    pageTitle: "تقارير الأكاديمية",
    pageDescription: "الأداء التشغيلي من بيانات الأكاديمية المباشرة.",
    refreshReports: "تحديث التقارير",
    exportCsv: "تصدير CSV",
    allBranches: "كل الفروع",
    reportsLoadError: "تعذر تحميل التقارير. راجع التواريخ المحددة وحاول مرة أخرى.",
    loadingReports: "جاري تحميل التقارير من قاعدة البيانات...",
    joinedInPeriod: "{count} انضموا في الفترة المحددة",
    activeCoachProfiles: "ملفات مدربين نشطة في الأكاديمية",
    completed: "{count} مكتملة",
    attendanceMarks: "{count} علامة حضور",
    attendanceTrend: "اتجاه الحضور",
    noAttendanceRecords: "لا توجد سجلات حضور في هذه الفترة",
    playerLevels: "مستويات اللاعبين",
    level: "المستوى {level}",
    noActivePlayers: "لا يوجد لاعبون نشطون في هذا الفرع.",
    groupPerformance: "أداء المجموعات",
    coachActivity: "نشاط المدربين",
    playerAttendance: "حضور اللاعبين",
    coachFallback: "مدرب",
    noCoaches: "لا يوجد مدربون لهذا الفرع.",
  },
} as const;

export default function ReportsOverviewPage() {
  const language = useDashboardLanguage();
  const t = reportsCopy[language];
  const numberLocale = language === "ar" ? "ar-EG" : "en-US";
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 89);
    return date;
  }, [today]);
  const [branchId, setBranchId] = useState("all");
  const [dateFrom, setDateFrom] = useState(toDateInput(defaultFrom));
  const [dateTo, setDateTo] = useState(toDateInput(today));
  const { data: branches = [] } = useGetBranchesQuery();
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetReportsOverviewQuery({
    branchId: branchId === "all" ? undefined : branchId,
    dateFrom,
    dateTo,
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      [t.overviewTitle],
      [t.from, data.filters.dateFrom],
      [t.to, data.filters.dateTo],
      [],
      [t.metric, t.value],
      [t.totalPlayers, data.summary.totalPlayers],
      [t.activePlayers, data.summary.activePlayers],
      [t.newPlayers, data.summary.newPlayers],
      [t.coaches, data.summary.totalCoaches],
      [t.sessions, data.summary.totalSessions],
      [t.attendanceRate, `${data.summary.attendanceRate}%`],
      [],
      [t.group, t.branch, t.players, t.sessions, t.attendanceRate],
      ...data.groups.map((group) => [
        group.name,
        group.branchName,
        group.players,
        group.sessions,
        `${group.attendanceRate}%`,
      ]),
      [],
      [t.coach, t.specialization, t.sessions, t.attendanceRate],
      ...data.coaches.map((coach) => [
        coach.name,
        coach.specialization || t.coachFallback,
        coach.sessions,
        `${coach.attendanceRate}%`,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `goalix-reports-${dateFrom}-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        actions={
          <div className="flex gap-2">
            <RefreshButton
              size="icon"
              onRefresh={refetch}
              isRefreshing={isFetching}
              title={t.refreshReports}
            />
            <Button onClick={exportCsv} disabled={!data}>
              <Download className="h-4 w-4" />
              {t.exportCsv}
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 border-y border-[#29435f]/80 py-4 md:grid-cols-[1fr_180px_180px]">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-400">{t.branch}</span>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="border-[#29435f] bg-[#07172a]">
              <SelectValue placeholder={t.allBranches} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allBranches}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-400">{t.from}</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-10 w-full rounded-lg border border-[#29435f] bg-[#07172a] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-400">{t.to}</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={toDateInput(today)}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 w-full rounded-lg border border-[#29435f] bg-[#07172a] px-3 text-sm text-white"
          />
        </label>
      </section>

      {isError && (
        <div className="border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {t.reportsLoadError}
        </div>
      )}

      {isLoading || !data ? (
        <div className="grid min-h-[320px] place-items-center text-sm text-slate-400">
          {t.loadingReports}
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={Users}
              label={t.activePlayers}
              value={formatNumber(data.summary.activePlayers, numberLocale)}
              helper={t.joinedInPeriod.replace("{count}", formatNumber(data.summary.newPlayers, numberLocale))}
            />
            <Metric
              icon={UserCheck}
              label={t.coaches}
              value={formatNumber(data.summary.totalCoaches, numberLocale)}
              helper={t.activeCoachProfiles}
            />
            <Metric
              icon={CalendarDays}
              label={t.sessions}
              value={formatNumber(data.summary.totalSessions, numberLocale)}
              helper={t.completed.replace("{count}", formatNumber(data.summary.completedSessions, numberLocale))}
            />
            <Metric
              icon={Activity}
              label={t.attendanceRate}
              value={`${data.summary.attendanceRate}%`}
              helper={t.attendanceMarks.replace("{count}", formatNumber(data.attendance.total, numberLocale))}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="border-[#29435f] bg-[#07172a]/80">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base text-white">{t.attendanceTrend}</CardTitle>
                <TrendingUp className="h-5 w-5 text-lime-300" />
              </CardHeader>
              <CardContent>
                <AttendanceTrend points={data.attendanceTrend} emptyText={t.noAttendanceRecords} />
              </CardContent>
            </Card>

            <Card className="border-[#29435f] bg-[#07172a]/80">
              <CardHeader>
                <CardTitle className="text-base text-white">{t.playerLevels}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.levelDistribution.map((item) => {
                  const max = Math.max(
                    ...data.levelDistribution.map((entry) => entry.count),
                    1,
                  );
                  return (
                    <div key={item.level}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="font-semibold text-slate-300">
                          {t.level.replace("{level}", item.level)}
                        </span>
                        <span className="text-white">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-lime-300 to-cyan-400"
                          style={{ width: `${(item.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data.levelDistribution.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-400">
                    {t.noActivePlayers}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-[#29435f] bg-[#07172a]/80">
              <CardHeader>
                <CardTitle className="text-base text-white">{t.groupPerformance}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="pb-3">{t.group}</th>
                      <th className="pb-3">{t.players}</th>
                      <th className="pb-3">{t.sessions}</th>
                      <th className="pb-3 text-right">{t.attendanceRate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.groups.map((group) => (
                      <tr key={group.id}>
                        <td className="py-3">
                          <p className="font-semibold text-white">{group.name}</p>
                          <p className="text-xs text-slate-500">{group.branchName}</p>
                        </td>
                        <td className="py-3 text-slate-300">{group.players}</td>
                        <td className="py-3 text-slate-300">{group.sessions}</td>
                        <td className="py-3 text-right font-bold text-lime-300">
                          {group.attendanceRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-[#29435f] bg-[#07172a]/80">
              <CardHeader>
                <CardTitle className="text-base text-white">{t.coachActivity}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="pb-3">{t.coach}</th>
                      <th className="pb-3">{t.sessions}</th>
                      <th className="pb-3 text-right">{t.playerAttendance}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.coaches.map((coach) => (
                      <tr key={coach.id}>
                        <td className="py-3">
                          <p className="font-semibold text-white">{coach.name}</p>
                          <p className="text-xs text-slate-500">
                            {coach.specialization || t.coachFallback}
                          </p>
                        </td>
                        <td className="py-3 text-slate-300">{coach.sessions}</td>
                        <td className="py-3 text-right font-bold text-cyan-300">
                          {coach.attendanceRate}%
                        </td>
                      </tr>
                    ))}
                    {data.coaches.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-10 text-center text-slate-400">
                          {t.noCoaches}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
