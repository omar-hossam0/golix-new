"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, Download, Users, Waypoints } from "lucide-react";
import { useRouter } from "next/navigation";
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

type DashboardLanguage = "en" | "ar";

const coachReportCopy = {
  en: {
    title: "Coach Report",
    description: "Coach workload, groups, players and attendance performance.",
    refreshReport: "Refresh report",
    exportCsv: "Export CSV",
    branch: "Branch",
    allBranches: "All branches",
    from: "From",
    to: "To",
    loadError: "Could not load coach performance.",
    loading: "Loading coach report from the database...",
    coach: "Coach",
    role: "Role",
    groups: "Groups",
    players: "Players",
    sessions: "Sessions",
    attendance: "Attendance",
    coaches: "Coaches",
    coachesHelper: "In selected branch",
    assignedGroups: "Assigned Groups",
    assignedGroupsHelper: "Current group assignments",
    managedPlayers: "Managed Players",
    managedPlayersHelper: "Unique active assignments",
    completed: "completed",
    coachWorkload: "Coach Workload",
    managedPlayersDataset: "Managed players",
    noCoachesBranch: "No coaches found for this branch.",
    noPrimaryBranch: "No primary branch",
    playerAttendance: "player attendance",
    coachFallback: "coach",
  },
  ar: {
    title: "تقرير المدربين",
    description: "عبء عمل المدربين، المجموعات، اللاعبين، وأداء الحضور.",
    refreshReport: "تحديث التقرير",
    exportCsv: "تصدير CSV",
    branch: "الفرع",
    allBranches: "كل الفروع",
    from: "من",
    to: "إلى",
    loadError: "تعذر تحميل أداء المدربين.",
    loading: "جاري تحميل تقرير المدربين من قاعدة البيانات...",
    coach: "المدرب",
    role: "الدور",
    groups: "المجموعات",
    players: "اللاعبون",
    sessions: "الحصص",
    attendance: "الحضور",
    coaches: "المدربون",
    coachesHelper: "في الفرع المحدد",
    assignedGroups: "المجموعات المعينة",
    assignedGroupsHelper: "تعيينات المجموعات الحالية",
    managedPlayers: "اللاعبون المدارون",
    managedPlayersHelper: "تعيينات نشطة فريدة",
    completed: "مكتملة",
    coachWorkload: "عبء عمل المدرب",
    managedPlayersDataset: "اللاعبون المدارون",
    noCoachesBranch: "لا يوجد مدربون لهذا الفرع.",
    noPrimaryBranch: "لا يوجد فرع أساسي",
    playerAttendance: "حضور اللاعبين",
    coachFallback: "مدرب",
  },
} as const;

const roleLabel = (value: string | null, language: DashboardLanguage, fallback: string) => {
  if (language === "ar") {
    const roles: Record<string, string> = {
      coach: "مدرب",
      head_coach: "مدرب رئيسي",
      assistant_coach: "مدرب مساعد",
      fitness_coach: "مدرب لياقة",
      goalkeeper_coach: "مدرب حراس",
    };
    const key = String(value || fallback).toLowerCase();
    return roles[key] ?? String(value || fallback).replaceAll("_", " ");
  }
  return (value || fallback)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function CoachReportPage() {
  const language = useDashboardLanguage();
  const t = coachReportCopy[language];
  const router = useRouter();
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
    });
  const coaches = data?.coaches ?? [];
  const totalGroups = coaches.reduce((sum, coach) => sum + coach.groupCount, 0);
  const totalPlayers = coaches.reduce((sum, coach) => sum + coach.playerCount, 0);

  const exportCsv = () => {
    const rows = [
      [t.coach, t.role, t.branch, t.groups, t.players, t.sessions, t.attendance],
      ...coaches.map((coach) => [
        coach.name,
        roleLabel(coach.role || coach.specialization, language, t.coachFallback),
        coach.branchName ?? "",
        coach.groupCount,
        coach.playerCount,
        coach.sessions,
        `${coach.attendanceRate}%`,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `coach-report-${dateFrom}-${dateTo}.csv`;
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
            <Button onClick={exportCsv} disabled={!coaches.length}>
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [Users, t.coaches, coaches.length, t.coachesHelper],
              [Waypoints, t.assignedGroups, totalGroups, t.assignedGroupsHelper],
              [Users, t.managedPlayers, totalPlayers, t.managedPlayersHelper],
              [CalendarCheck2, t.sessions, data.summary.totalSessions, `${data.summary.completedSessions} ${t.completed}`],
            ].map(([Icon, label, value, helper]) => {
              const MetricIcon = Icon as typeof Users;
              return (
                <Card key={String(label)} className="border-[#29435f] bg-[#07172a]/80">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-400">{String(label)}</p>
                        <p className="mt-2 text-3xl font-bold text-white">{String(value)}</p>
                      </div>
                      <MetricIcon className="h-6 w-6 text-cyan-300" />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{String(helper)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <Card className="border-[#29435f] bg-[#07172a]/80">
            <CardHeader>
              <CardTitle className="text-base text-white">{t.coachWorkload}</CardTitle>
            </CardHeader>
            <CardContent>
              {coaches.length ? (
                <BarChart
                  labels={coaches.map((coach) => coach.name)}
                  datasets={[
                    {
                      label: t.sessions,
                      data: coaches.map((coach) => coach.sessions),
                      backgroundColor: "#22d3ee",
                    },
                    {
                      label: t.managedPlayersDataset,
                      data: coaches.map((coach) => coach.playerCount),
                      backgroundColor: "#b6ff00",
                    },
                  ]}
                  height={280}
                />
              ) : (
                <p className="py-12 text-center text-sm text-slate-400">
                  {t.noCoachesBranch}
                </p>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            {coaches.map((coach) => (
              <Card
                key={coach.id}
                className="cursor-pointer border-[#29435f] bg-[#07172a]/80 transition hover:border-lime-300/50"
                onClick={() => router.push(`/admin/coaches/${coach.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-white">{coach.name}</h2>
                      <p className="mt-1 text-sm text-cyan-300">
                        {roleLabel(coach.role || coach.specialization, language, t.coachFallback)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {coach.branchName || t.noPrimaryBranch}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-lime-300">
                        {coach.attendanceRate}%
                      </p>
                      <p className="text-xs text-slate-500">{t.playerAttendance}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-white">{coach.groupCount}</p>
                      <p className="text-xs text-slate-500">{t.groups}</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{coach.playerCount}</p>
                      <p className="text-xs text-slate-500">{t.players}</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{coach.sessions}</p>
                      <p className="text-xs text-slate-500">{t.sessions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
