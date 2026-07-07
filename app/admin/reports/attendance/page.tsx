"use client";

import { useMemo, useState } from "react";
import { Clock3, Download, HeartPulse, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/components/charts/BarChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetBranchesQuery } from "@/lib/store/api/adminApi";
import { useGetReportsOverviewQuery } from "@/lib/store/api/dashboardApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const toDate = (date: Date) => date.toISOString().slice(0, 10);

const attendanceReportCopy = {
  en: {
    title: "Attendance Report",
    description: "Attendance status, weekly trend and group comparison.",
    refreshReport: "Refresh report",
    exportCsv: "Export CSV",
    branch: "Branch",
    allBranches: "All branches",
    from: "From",
    to: "To",
    loadError: "Could not load attendance data.",
    loading: "Loading attendance from the database...",
    status: "Status",
    count: "Count",
    present: "Present",
    late: "Late",
    absent: "Absent",
    excused: "Excused",
    injured: "Injured",
    group: "Group",
    players: "Players",
    trainings: "Trainings",
    attendanceRate: "Attendance Rate",
    records: (count: number) => `${count} records`,
    onTime: "On time",
    countedAsAttended: "Counted as attended",
    unexcusedAbsence: "Unexcused absence",
    approvedAbsence: "Approved absence",
    injuryUnavailable: "Unavailable due to injury",
    weeklyAttendanceRate: "Weekly Attendance Rate",
    attendancePercent: "Attendance %",
    noAttendancePeriod: "No attendance has been marked in this period yet.",
    statusDistribution: "Status Distribution",
    attendanceByGroup: "Attendance by Group",
    noGroups: "No active groups found for this branch.",
  },
  ar: {
    title: "تقرير الحضور",
    description: "حالات الحضور، الاتجاه الأسبوعي، ومقارنة المجموعات.",
    refreshReport: "تحديث التقرير",
    exportCsv: "تصدير CSV",
    branch: "الفرع",
    allBranches: "كل الفروع",
    from: "من",
    to: "إلى",
    loadError: "تعذر تحميل بيانات الحضور.",
    loading: "جاري تحميل الحضور من قاعدة البيانات...",
    status: "الحالة",
    count: "العدد",
    present: "حاضر",
    late: "متأخر",
    absent: "غائب",
    excused: "بعذر",
    injured: "مصاب",
    group: "المجموعة",
    players: "اللاعبون",
    trainings: "التدريبات",
    attendanceRate: "نسبة الحضور",
    records: (count: number) => `${count} سجلات`,
    onTime: "في الموعد",
    countedAsAttended: "يحسب ضمن الحضور",
    unexcusedAbsence: "غياب بدون عذر",
    approvedAbsence: "غياب معتمد",
    injuryUnavailable: "غير متاح بسبب الإصابة",
    weeklyAttendanceRate: "نسبة الحضور الأسبوعية",
    attendancePercent: "نسبة الحضور %",
    noAttendancePeriod: "لم يتم تسجيل حضور في هذه الفترة بعد.",
    statusDistribution: "توزيع الحالات",
    attendanceByGroup: "الحضور حسب المجموعة",
    noGroups: "لا توجد مجموعات نشطة لهذا الفرع.",
  },
} as const;

export default function AttendanceReportPage() {
  const language = useDashboardLanguage();
  const t = attendanceReportCopy[language];
  const today = useMemo(() => new Date(), []);
  const from = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 89);
    return date;
  }, [today]);
  const [branchId, setBranchId] = useState("all");
  const [dateFrom, setDateFrom] = useState(toDate(from));
  const [dateTo, setDateTo] = useState(toDate(today));
  const { data: branches = [] } = useGetBranchesQuery();
  const { data, isLoading, isFetching, isError, refetch } =
    useGetReportsOverviewQuery({
      branchId: branchId === "all" ? undefined : branchId,
      dateFrom,
      dateTo,
    }, {
      refetchOnMountOrArgChange: 30,
    });

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      [t.title],
      [t.from, dateFrom],
      [t.to, dateTo],
      [],
      [t.status, t.count],
      [t.present, data.attendance.present],
      [t.late, data.attendance.late],
      [t.absent, data.attendance.absent],
      [t.excused, data.attendance.excused],
      [t.injured, data.attendance.injured],
      [],
      [t.group, t.branch, t.players, t.trainings, t.attendanceRate],
      ...data.groups.map((group) => [
        group.name,
        group.branchName,
        group.players,
        group.sessions,
        `${group.attendanceRate}%`,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${dateFrom}-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex gap-2">
            <RefreshButton
              size="icon"
              onRefresh={refetch}
              isRefreshing={isFetching}
              title={t.refreshReport}
            />
            <Button onClick={exportCsv} disabled={!data}>
              <Download className="h-4 w-4" />
              {t.exportCsv}
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 border-y border-[#29435f]/80 py-4 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-400">{t.branch}</span>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="border-[#29435f] bg-[#07172a]">
              <SelectValue />
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
            max={toDate(today)}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 w-full rounded-lg border border-[#29435f] bg-[#07172a] px-3 text-sm text-white"
          />
        </label>
      </section>

      {isError && (
        <div className="border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {t.loadError}
        </div>
      )}

      {isLoading ? (
        <div className="grid min-h-72 place-items-center text-sm text-slate-400">
          {t.loading}
        </div>
      ) : data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              [UserCheck, t.attendanceRate, `${data.summary.attendanceRate}%`, t.records(data.attendance.total), "text-lime-300"],
              [UserCheck, t.present, data.attendance.present, t.onTime, "text-cyan-300"],
              [Clock3, t.late, data.attendance.late, t.countedAsAttended, "text-amber-300"],
              [UserX, t.absent, data.attendance.absent, t.unexcusedAbsence, "text-red-300"],
              [UserX, t.excused, data.attendance.excused, t.approvedAbsence, "text-violet-300"],
              [HeartPulse, t.injured, data.attendance.injured, t.injuryUnavailable, "text-rose-300"],
            ].map(([Icon, label, value, helper, tone]) => {
              const MetricIcon = Icon as typeof UserCheck;
              return (
                <Card key={String(label)} className="border-[#29435f] bg-[#07172a]/80">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-400">{String(label)}</p>
                        <p className={`mt-2 text-3xl font-bold ${String(tone)}`}>
                          {String(value)}
                        </p>
                      </div>
                      <MetricIcon className={`h-5 w-5 ${String(tone)}`} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{String(helper)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-[#29435f] bg-[#07172a]/80">
              <CardHeader>
                <CardTitle className="text-base text-white">{t.weeklyAttendanceRate}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.attendanceTrend.length ? (
                  <BarChart
                    labels={data.attendanceTrend.map((point) => point.label)}
                    datasets={[
                      {
                        label: t.attendancePercent,
                        data: data.attendanceTrend.map((point) => point.rate),
                        backgroundColor: "#b6ff00",
                      },
                    ]}
                    height={280}
                  />
                ) : (
                  <p className="py-28 text-center text-sm text-slate-400">
                    {t.noAttendancePeriod}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#29435f] bg-[#07172a]/80">
              <CardHeader>
                <CardTitle className="text-base text-white">{t.statusDistribution}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  [t.present, data.attendance.present, "bg-cyan-400"],
                  [t.late, data.attendance.late, "bg-amber-400"],
                  [t.absent, data.attendance.absent, "bg-red-400"],
                  [t.excused, data.attendance.excused, "bg-violet-400"],
                  [t.injured, data.attendance.injured, "bg-rose-400"],
                ].map(([label, count, color]) => {
                  const total = Math.max(data.attendance.total, 1);
                  const numericCount = Number(count);
                  return (
                    <div key={String(label)}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-semibold text-slate-300">{String(label)}</span>
                        <span className="text-white">
                          {numericCount} ({Math.round((numericCount / total) * 100)}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-white/10">
                        <div
                          className={`h-full ${String(color)}`}
                          style={{ width: `${(numericCount / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>

          <Card className="border-[#29435f] bg-[#07172a]/80">
            <CardHeader>
              <CardTitle className="text-base text-white">{t.attendanceByGroup}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-3">{t.group}</th>
                    <th className="pb-3">{t.branch}</th>
                    <th className="pb-3">{t.players}</th>
                    <th className="pb-3">{t.trainings}</th>
                    <th className="pb-3 text-right">{t.attendanceRate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.groups.map((group) => (
                    <tr key={group.id}>
                      <td className="py-3 font-semibold text-white">{group.name}</td>
                      <td className="py-3 text-slate-400">{group.branchName}</td>
                      <td className="py-3 text-slate-300">{group.players}</td>
                      <td className="py-3 text-slate-300">{group.sessions}</td>
                      <td className="py-3 text-right font-bold text-lime-300">
                        {group.attendanceRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.groups.length && (
                <p className="py-10 text-center text-sm text-slate-400">
                  {t.noGroups}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
