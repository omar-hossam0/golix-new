"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Download,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const levelVariant = (level: string | null) => {
  if (level === "A") return "success" as const;
  if (level === "B" || level === "C") return "warning" as const;
  return "destructive" as const;
};

const playerProgressCopy = {
  en: {
    pageTitle: "Player Progress Report",
    pageDescription: "Player profiles, main positions, measurements and attendance.",
    refreshReport: "Refresh report",
    exportCsv: "Export CSV",
    search: "Search",
    searchPlaceholder: "Player, code, position or group",
    branch: "Branch",
    allBranches: "All branches",
    level: "Level",
    allLevels: "All levels",
    levelItem: "Level {level}",
    from: "From",
    to: "To",
    loadError: "Could not load player progress. Refresh the report and try again.",
    loading: "Loading player progress from the database...",
    metrics: {
      activePlayers: "Active Players",
      shown: "{count} shown",
      mainPositions: "Main Positions",
      distinctPositions: "Distinct assigned positions",
      completeProfiles: "Complete Profiles",
      incomplete: "{count} incomplete",
      measuredPlayers: "Measured Players",
      physicalMeasurements: "Players with physical measurements",
    },
    playersTitle: "Players ({count})",
    mainPositionSource: "Main Position comes from the completed custom profile",
    table: {
      player: "Player",
      mainPosition: "Main Position",
      level: "Level",
      branchGroup: "Branch / Group",
      latestMeasurement: "Latest Measurement",
      attendance: "Attendance",
      profile: "Profile",
    },
    csv: {
      player: "Player",
      code: "Code",
      mainPosition: "Main Position",
      level: "Level",
      branch: "Branch",
      group: "Group",
      profile: "Profile",
      attendance: "Attendance",
      height: "Height cm",
      weight: "Weight kg",
      measuredAt: "Measured at",
    },
    noPlayerCode: "No player code",
    notCompleted: "Not completed",
    feet: {
      right: "right foot",
      left: "left foot",
      both: "both feet",
    },
    noBranch: "No branch",
    noActiveGroup: "No active group",
    noMeasurements: "No measurements",
    attended: "{attended}/{total} attended",
    statuses: {
      complete: "complete",
      incomplete: "incomplete",
    },
    noPlayers: "No players match the selected filters.",
  },
  ar: {
    pageTitle: "تقرير تقدم اللاعبين",
    pageDescription: "ملفات اللاعبين والمراكز الرئيسية والقياسات والحضور.",
    refreshReport: "تحديث التقرير",
    exportCsv: "تصدير CSV",
    search: "بحث",
    searchPlaceholder: "لاعب أو كود أو مركز أو مجموعة",
    branch: "الفرع",
    allBranches: "كل الفروع",
    level: "المستوى",
    allLevels: "كل المستويات",
    levelItem: "المستوى {level}",
    from: "من",
    to: "إلى",
    loadError: "تعذر تحميل تقدم اللاعبين. حدّث التقرير وحاول مرة أخرى.",
    loading: "جاري تحميل تقدم اللاعبين من قاعدة البيانات...",
    metrics: {
      activePlayers: "لاعبون نشطون",
      shown: "{count} ظاهر",
      mainPositions: "المراكز الرئيسية",
      distinctPositions: "مراكز معينة مختلفة",
      completeProfiles: "ملفات مكتملة",
      incomplete: "{count} غير مكتمل",
      measuredPlayers: "لاعبون مقاسون",
      physicalMeasurements: "لاعبون لديهم قياسات بدنية",
    },
    playersTitle: "اللاعبون ({count})",
    mainPositionSource: "المركز الرئيسي يأتي من الملف المخصص المكتمل",
    table: {
      player: "اللاعب",
      mainPosition: "المركز الرئيسي",
      level: "المستوى",
      branchGroup: "الفرع / المجموعة",
      latestMeasurement: "آخر قياس",
      attendance: "الحضور",
      profile: "الملف",
    },
    csv: {
      player: "اللاعب",
      code: "الكود",
      mainPosition: "المركز الرئيسي",
      level: "المستوى",
      branch: "الفرع",
      group: "المجموعة",
      profile: "الملف",
      attendance: "الحضور",
      height: "الطول سم",
      weight: "الوزن كجم",
      measuredAt: "وقت القياس",
    },
    noPlayerCode: "لا يوجد كود لاعب",
    notCompleted: "غير مكتمل",
    feet: {
      right: "القدم اليمنى",
      left: "القدم اليسرى",
      both: "كلتا القدمين",
    },
    noBranch: "لا يوجد فرع",
    noActiveGroup: "لا توجد مجموعة نشطة",
    noMeasurements: "لا توجد قياسات",
    attended: "{attended}/{total} حضور",
    statuses: {
      complete: "مكتمل",
      incomplete: "غير مكتمل",
    },
    noPlayers: "لا يوجد لاعبون مطابقون للفلاتر المحددة.",
  },
} as const;

export default function PlayerProgressReportPage() {
  const language = useDashboardLanguage();
  const t = playerProgressCopy[language];
  const today = useMemo(() => new Date(), []);
  const from = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 89);
    return date;
  }, [today]);
  const [branchId, setBranchId] = useState("all");
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(toDate(from));
  const [dateTo, setDateTo] = useState(toDate(today));
  const { data: branches = [] } = useGetBranchesQuery();
  const { data, isLoading, isFetching, isError, refetch } =
    useGetReportsOverviewQuery({
      branchId: branchId === "all" ? undefined : branchId,
      dateFrom,
      dateTo,
    });

  const players = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.players ?? []).filter((player) => {
      const matchesLevel = level === "all" || player.level === level;
      const matchesSearch =
        !query ||
        [
          player.fullName,
          player.playerCode,
          player.position,
          player.groupName,
          player.branchName,
        ].some((value) => value?.toLowerCase().includes(query));
      return matchesLevel && matchesSearch;
    });
  }, [data?.players, level, search]);

  const positionCount = new Set(
    (data?.players ?? []).map((player) => player.position).filter(Boolean),
  ).size;
  const completeProfiles = (data?.players ?? []).filter(
    (player) => player.profileStatus === "complete",
  ).length;
  const measuredPlayers = (data?.players ?? []).filter(
    (player) => player.measuredAt,
  ).length;

  const exportCsv = () => {
    const rows = [
      [
        t.csv.player,
        t.csv.code,
        t.csv.mainPosition,
        t.csv.level,
        t.csv.branch,
        t.csv.group,
        t.csv.profile,
        t.csv.attendance,
        t.csv.height,
        t.csv.weight,
        t.csv.measuredAt,
      ],
      ...players.map((player) => [
        player.fullName,
        player.playerCode ?? "",
        player.position ?? "",
        player.level ?? "",
        player.branchName ?? "",
        player.groupName ?? "",
        player.profileStatus ?? "",
        `${player.attendanceRate}%`,
        player.heightCm ?? "",
        player.weightKg ?? "",
        player.measuredAt ?? "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `player-progress-${dateFrom}-${dateTo}.csv`;
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
              title={t.refreshReport}
            />
            <Button onClick={exportCsv} disabled={!players.length}>
              <Download className="h-4 w-4" />
              {t.exportCsv}
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 border-y border-[#29435f]/80 py-4 md:grid-cols-2 xl:grid-cols-[1.2fr_180px_180px_180px]">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-400">{t.search}</span>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-10 w-full rounded-lg border border-[#29435f] bg-[#07172a] pl-9 pr-3 text-sm text-white outline-none focus:border-lime-300/70"
            />
          </div>
        </label>
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
          <span className="text-xs font-bold uppercase text-slate-400">{t.level}</span>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="border-[#29435f] bg-[#07172a]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allLevels}</SelectItem>
              {["A", "B", "C", "D", "F"].map((item) => (
                <SelectItem key={item} value={item}>
                  {t.levelItem.replace("{level}", item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-400">{t.from}</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#29435f] bg-[#07172a] px-2 text-xs text-white"
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
              className="h-10 w-full rounded-lg border border-[#29435f] bg-[#07172a] px-2 text-xs text-white"
            />
          </label>
        </div>
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
              [Users, t.metrics.activePlayers, data.summary.activePlayers, t.metrics.shown.replace("{count}", String(players.length))],
              [ShieldCheck, t.metrics.mainPositions, positionCount, t.metrics.distinctPositions],
              [UserCheck, t.metrics.completeProfiles, completeProfiles, t.metrics.incomplete.replace("{count}", String(data.players.length - completeProfiles))],
              [Activity, t.metrics.measuredPlayers, measuredPlayers, t.metrics.physicalMeasurements],
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
                      <MetricIcon className="h-6 w-6 text-lime-300" />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{String(helper)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <Card className="border-[#29435f] bg-[#07172a]/80">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base text-white">
                {t.playersTitle.replace("{count}", String(players.length))}
              </CardTitle>
              <span className="text-xs text-slate-500">
                {t.mainPositionSource}
              </span>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-3">{t.table.player}</th>
                    <th className="pb-3">{t.table.mainPosition}</th>
                    <th className="pb-3">{t.table.level}</th>
                    <th className="pb-3">{t.table.branchGroup}</th>
                    <th className="pb-3">{t.table.latestMeasurement}</th>
                    <th className="pb-3">{t.table.attendance}</th>
                    <th className="pb-3 text-right">{t.table.profile}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {players.map((player) => (
                    <tr key={player.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-white">{player.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {player.playerCode || t.noPlayerCode}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 font-bold text-cyan-200">
                          {player.position || t.notCompleted}
                        </span>
                        {player.preferredFoot && (
                          <p className="mt-1 text-xs capitalize text-slate-500">
                            {player.preferredFoot in t.feet
                              ? t.feet[player.preferredFoot as keyof typeof t.feet]
                              : player.preferredFoot}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={levelVariant(player.level)}>
                          {player.level || "-"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-slate-300">{player.branchName || t.noBranch}</p>
                        <p className="text-xs text-slate-500">
                          {player.groupName || t.noActiveGroup}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        {player.measuredAt ? (
                          <>
                            <p className="text-slate-300">
                              {player.heightCm ?? "-"} cm / {player.weightKg ?? "-"} kg
                            </p>
                            <p className="text-xs text-slate-500">{player.measuredAt}</p>
                          </>
                        ) : (
                          <span className="text-slate-500">{t.noMeasurements}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-bold text-lime-300">
                          {player.attendanceRate}%
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.attended
                            .replace("{attended}", String(player.attendanceAttended))
                            .replace("{total}", String(player.attendanceTotal))}
                        </p>
                      </td>
                      <td className="py-3 text-right">
                        <Badge
                          variant={
                            player.profileStatus === "complete" ? "success" : "outline"
                          }
                        >
                          {player.profileStatus === "complete"
                            ? t.statuses.complete
                            : t.statuses.incomplete}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!players.length && (
                <p className="py-12 text-center text-sm text-slate-400">
                  {t.noPlayers}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
