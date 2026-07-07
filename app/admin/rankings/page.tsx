"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Goal,
  Medal,
  Shield,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import {
  useGetAdminRankingSystemInputsQuery,
  useGetGroupsQuery,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import type { RankingSystemInput } from "@/lib/store/api/calendarApi";
import {
  buildMonthlyRankingHistory,
  buildMonthlyRankingRows,
  buildWeeklyRankingHistory,
  isActualCompletedRankingRow,
  latestCompletedRankingWeekKey,
  latestRankingMonthKey,
  numberValue,
  rankingDateKey,
  rankingMonthKey,
  rankingWeekLabel,
  rankingWeeksInMonthLabel,
  rankingMonthRange,
  rankingWeeklyScore,
  sortWeeklyRankingRows,
  type MonthlyRankingPeriod,
  type MonthlyRankingRow,
  type WeeklyRankingPeriod,
} from "@/lib/rankings/monthlyRanking";
import { formatDate, getInitials } from "@/lib/utils";

type RoleKey = Exclude<RankingSystemInput["role_family"], "unknown">;

const roleCards: Array<{
  role: RoleKey;
  title: string;
  description: string;
  icon: typeof Goal;
  className: string;
}> = [
  {
    role: "attack",
    title: "Best Attack",
    description: "Top attacking role score",
    icon: Goal,
    className: "border-rose-400/35 bg-rose-500/10 text-rose-100",
  },
  {
    role: "midfield",
    title: "Best Midfield",
    description: "Top midfield role score",
    icon: Medal,
    className: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
  },
  {
    role: "defense",
    title: "Best Defense",
    description: "Top defensive role score",
    icon: Shield,
    className: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
  },
  {
    role: "goalkeeper",
    title: "Best Goalkeeper",
    description: "Top goalkeeper score",
    icon: User,
    className: "border-amber-400/35 bg-amber-500/10 text-amber-100",
  },
];

const rankValue = (row: RankingSystemInput) =>
  row.final_api_response?.rank ?? row.rank;

const scoreText = (value: unknown) => {
  const numeric = numberValue(value);
  if (numeric === null) return "-";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

const monthlyRoleLeader = (rows: MonthlyRankingRow[], role: RoleKey) =>
  rows.find((row) => row.roleFamily === role);

const weeklyRoleLeader = (rows: RankingSystemInput[], role: RoleKey) =>
  rows.find((row) => row.role_family === role);

const rankingsCopy = {
  en: {
    roleCards: {
      attack: { title: "Best Attack", description: "Top attacking role score" },
      midfield: {
        title: "Best Midfield",
        description: "Top midfield role score",
      },
      defense: {
        title: "Best Defense",
        description: "Top defensive role score",
      },
      goalkeeper: {
        title: "Best Goalkeeper",
        description: "Top goalkeeper score",
      },
    },
    roleLabels: {
      attack: "Attack",
      midfield: "Midfield",
      defense: "Defense",
      goalkeeper: "Goalkeeper",
      unknown: "Unknown",
    } satisfies Record<RankingSystemInput["role_family"], string>,
    playerFallback: "Player",
    monthly: "monthly",
    weekly: "weekly",
    points: "pts",
    noPlayerData: "No player data yet.",
    latestWeeklyRun: "Latest weekly run",
    noWeeklyPlayer: "No weekly player yet.",
    noWeeklyPlayers: "No players in this weekly ranking.",
    noMonthlyPlayers: "No players in this monthly ranking.",
    to: "to",
    monthlyPlayersCount: "{count} monthly players",
    completedWeeksCount: "{count} completed weeks",
    fullMonthlyRanking: "Full Monthly Ranking",
    finalAverageFor: "Final average for {label}",
    playersCount: "{count} players",
    noCompletedWeeksInMonth: "No completed weekly runs in this month yet.",
    noCompletedWeeks: "No completed weeks",
    pageTitle: "Ranking Overview",
    pageDescription:
      "Completed weekly model runs and month-bounded ranking totals. Every month starts a fresh monthly ranking.",
    dashboard: "Dashboard",
    rankings: "Rankings",
    filterByGroup: "Filter by group",
    allGroups: "All Groups",
    refresh: "Refresh",
    loadError: "Could not load ranking output.",
    retry: "Retry",
    monthlyWindow: "Monthly Ranking Window",
    month: "Month",
    period: "Period",
    weeksCounted: "Weeks counted",
    monthlyOne: "Monthly #1",
    scoreAcrossWeeks: "{score} pts across {weeks}",
    noMonthlyRanking: "No monthly ranking yet.",
    latestWeeklyRunTitle: "Latest Weekly Run",
    noWeek: "No week",
    noWeeklyRows: "No weekly ranking rows yet.",
    monthlyLeaderboard: "Monthly Leaderboard",
    noMonthlyRows: "No monthly ranking rows yet.",
    detailedHistory: "Detailed Ranking History",
    detailedHistoryDescription:
      "Every month includes its full monthly leaderboard and the full player ranking for each completed week inside that month.",
    monthsCount: "{count} months",
    noDetailedHistory: "No detailed ranking history is available yet.",
    loadMoreHistory: "Load more ranking history ({shown}/{total})",
    cycleTitle: "How the cycle works",
    cycleDescription:
      "The weekly model ranks players from that week's training, match, attendance, and daily AI inputs. The monthly table averages only completed weekly scores inside the same calendar month. When a new month starts, the monthly table starts fresh and previous months remain saved as separate history.",
    weeklyPage: "Weekly page",
    monthlyPage: "Monthly page",
  },
  ar: {
    roleCards: {
      attack: { title: "أفضل هجوم", description: "أعلى نتيجة لدور هجومي" },
      midfield: {
        title: "أفضل وسط",
        description: "أعلى نتيجة لدور وسط الملعب",
      },
      defense: { title: "أفضل دفاع", description: "أعلى نتيجة لدور دفاعي" },
      goalkeeper: {
        title: "أفضل حارس",
        description: "أعلى نتيجة لحارس المرمى",
      },
    },
    roleLabels: {
      attack: "هجوم",
      midfield: "وسط",
      defense: "دفاع",
      goalkeeper: "حارس مرمى",
      unknown: "غير معروف",
    } satisfies Record<RankingSystemInput["role_family"], string>,
    playerFallback: "لاعب",
    monthly: "شهري",
    weekly: "أسبوعي",
    points: "نقطة",
    noPlayerData: "لا توجد بيانات لاعب حتى الآن.",
    latestWeeklyRun: "آخر تشغيل أسبوعي",
    noWeeklyPlayer: "لا يوجد لاعب أسبوعي حتى الآن.",
    noWeeklyPlayers: "لا يوجد لاعبون في هذا الترتيب الأسبوعي.",
    noMonthlyPlayers: "لا يوجد لاعبون في هذا الترتيب الشهري.",
    to: "إلى",
    monthlyPlayersCount: "{count} لاعبًا شهريًا",
    completedWeeksCount: "{count} أسابيع مكتملة",
    fullMonthlyRanking: "الترتيب الشهري الكامل",
    finalAverageFor: "المتوسط النهائي لـ {label}",
    playersCount: "{count} لاعب",
    noCompletedWeeksInMonth:
      "لا توجد تشغيلات أسبوعية مكتملة في هذا الشهر حتى الآن.",
    noCompletedWeeks: "لا توجد أسابيع مكتملة",
    pageTitle: "نظرة عامة على الترتيب",
    pageDescription:
      "تشغيلات النموذج الأسبوعية المكتملة وإجماليات الترتيب الشهرية. يبدأ كل شهر ترتيبًا شهريًا جديدًا.",
    dashboard: "لوحة التحكم",
    rankings: "الترتيبات",
    filterByGroup: "تصفية حسب المجموعة",
    allGroups: "كل المجموعات",
    refresh: "تحديث",
    loadError: "تعذر تحميل نتائج الترتيب.",
    retry: "إعادة المحاولة",
    monthlyWindow: "نافذة الترتيب الشهري",
    month: "الشهر",
    period: "الفترة",
    weeksCounted: "الأسابيع المحتسبة",
    monthlyOne: "الأول شهريًا",
    scoreAcrossWeeks: "{score} نقطة عبر {weeks}",
    noMonthlyRanking: "لا يوجد ترتيب شهري حتى الآن.",
    latestWeeklyRunTitle: "آخر تشغيل أسبوعي",
    noWeek: "لا يوجد أسبوع",
    noWeeklyRows: "لا توجد صفوف ترتيب أسبوعي حتى الآن.",
    monthlyLeaderboard: "لوحة الترتيب الشهرية",
    noMonthlyRows: "لا توجد صفوف ترتيب شهري حتى الآن.",
    detailedHistory: "تاريخ الترتيب المفصل",
    detailedHistoryDescription:
      "كل شهر يتضمن لوحة الترتيب الشهرية الكاملة وترتيب اللاعبين الكامل لكل أسبوع مكتمل داخل نفس الشهر.",
    monthsCount: "{count} شهر",
    noDetailedHistory: "لا يوجد تاريخ ترتيب مفصل حتى الآن.",
    loadMoreHistory: "تحميل المزيد من تاريخ الترتيب ({shown}/{total})",
    cycleTitle: "كيف تعمل الدورة",
    cycleDescription:
      "النموذج الأسبوعي يرتب اللاعبين من بيانات التدريب والمباراة والحضور ومدخلات الذكاء اليومية لذلك الأسبوع. الجدول الشهري يحسب متوسط النتائج الأسبوعية المكتملة داخل نفس الشهر فقط. عند بداية شهر جديد يبدأ الجدول الشهري من جديد وتبقى الشهور السابقة محفوظة كتاريخ منفصل.",
    weeklyPage: "صفحة الأسبوع",
    monthlyPage: "صفحة الشهر",
  },
} as const;

type RankingsCopy = (typeof rankingsCopy)[keyof typeof rankingsCopy];

const roleFamilyLabel = (
  role: RankingSystemInput["role_family"],
  t: RankingsCopy,
) => t.roleLabels[role];

function PlayerAvatar({ name }: { name: string }) {
  return (
    <Avatar className="h-10 w-10 border border-white/10">
      <AvatarFallback className="bg-primary/15 text-sm text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function MonthlyRoleCard({
  config,
  row,
  t,
}: {
  config: (typeof roleCards)[number];
  row?: MonthlyRankingRow;
  t: RankingsCopy;
}) {
  const Icon = config.icon;

  return (
    <Card className={`border ${config.className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold">
              {t.roleCards[config.role].title}
            </p>
            <p className="mt-1 text-xs text-current/75">
              {t.roleCards[config.role].description}
            </p>
          </div>
          <span className="rounded-md bg-black/15 p-2">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        {row ? (
          <div className="mt-4 flex items-center gap-3">
            <PlayerAvatar name={row.playerName} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{row.playerName}</p>
              <p className="text-xs text-current/75">
                #{row.rank} {t.monthly} - {scoreText(row.score)} {t.points} -{" "}
                {rankingWeeksInMonthLabel(row.weekStarts, row.month)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-current/20 p-3 text-sm text-current/75">
            {t.noPlayerData}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function WeeklyRoleCard({
  config,
  row,
  t,
}: {
  config: (typeof roleCards)[number];
  row?: RankingSystemInput;
  t: RankingsCopy;
}) {
  const Icon = config.icon;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {t.roleCards[config.role].title}
          </p>
          <p className="text-xs text-muted-foreground">{t.latestWeeklyRun}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      {row ? (
        <div className="mt-4 flex items-center gap-3">
          <PlayerAvatar name={row.player_name || t.playerFallback} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {row.player_name || t.playerFallback}
            </p>
            <p className="text-xs text-muted-foreground">
              #{rankValue(row)} {t.weekly} -{" "}
              {scoreText(rankingWeeklyScore(row))} {t.points}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t.noWeeklyPlayer}</p>
      )}
    </div>
  );
}

function WeeklyFullRankingList({
  rows,
  t,
}: {
  rows: RankingSystemInput[];
  t: RankingsCopy;
}) {
  return (
    <div className="max-h-[420px] overflow-y-auto pr-1">
      <div className="min-w-[560px] space-y-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[56px_1fr_96px_96px] items-center gap-3 rounded-md border border-border/25 bg-background/35 px-3 py-2 text-sm"
          >
            <span className="font-mono font-bold text-primary">
              #{rankValue(row)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {row.player_name || t.playerFallback}
              </p>
              <p className="text-xs text-muted-foreground">
                {[row.position, roleFamilyLabel(row.role_family, t)]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
            </div>
            <span className="text-right font-mono font-semibold">
              {scoreText(rankingWeeklyScore(row))}
            </span>
            <span className="text-right text-xs text-muted-foreground">
              {row.final_api_response?.trend ?? row.trend}
            </span>
          </div>
        ))}
      </div>
      {!rows.length && (
        <p className="rounded-md border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
          {t.noWeeklyPlayers}
        </p>
      )}
    </div>
  );
}

function MonthlyFullRankingList({
  rows,
  t,
}: {
  rows: MonthlyRankingRow[];
  t: RankingsCopy;
}) {
  return (
    <div className="max-h-[420px] overflow-y-auto pr-1">
      <div className="min-w-[620px] space-y-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[56px_1fr_96px_120px] items-center gap-3 rounded-md border border-border/25 bg-background/35 px-3 py-2 text-sm"
          >
            <span className="font-mono font-bold text-primary">
              #{row.rank}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.playerName}</p>
              <p className="text-xs text-muted-foreground">
                {[row.position, roleFamilyLabel(row.roleFamily, t)]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
            </div>
            <span className="text-right font-mono font-semibold">
              {scoreText(row.score)}
            </span>
            <span className="text-right text-xs text-muted-foreground">
              {rankingWeeksInMonthLabel(row.weekStarts, row.month)}
            </span>
          </div>
        ))}
      </div>
      {!rows.length && (
        <p className="rounded-md border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
          {t.noMonthlyPlayers}
        </p>
      )}
    </div>
  );
}

function MonthlyDetailedHistory({
  month,
  weeks,
  t,
}: {
  month: MonthlyRankingPeriod;
  weeks: WeeklyRankingPeriod[];
  t: RankingsCopy;
}) {
  return (
    <section className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-black">{month.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(month.start)} {t.to} {formatDate(month.end)} -{" "}
            {month.weeksLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {t.monthlyPlayersCount.replace(
              "{count}",
              String(month.rows.length),
            )}
          </Badge>
          <Badge variant="info">
            {t.completedWeeksCount.replace("{count}", String(weeks.length))}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <div className="rounded-lg border border-border/30 bg-muted/15 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{t.fullMonthlyRanking}</p>
              <p className="text-xs text-muted-foreground">
                {t.finalAverageFor.replace("{label}", month.label)}
              </p>
            </div>
            <Badge variant="success">
              {t.playersCount.replace("{count}", String(month.rows.length))}
            </Badge>
          </div>
          <MonthlyFullRankingList rows={month.rows} t={t} />
        </div>

        <div className="space-y-3">
          {weeks.map((week) => (
            <div
              key={week.key}
              className="rounded-lg border border-border/30 bg-muted/15 p-3"
            >
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{week.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(week.start)} {t.to} {formatDate(week.end)}
                  </p>
                </div>
                <Badge variant="outline">
                  {t.playersCount.replace("{count}", String(week.rows.length))}
                </Badge>
              </div>
              <WeeklyFullRankingList rows={week.rows} t={t} />
            </div>
          ))}
          {!weeks.length && (
            <p className="rounded-lg border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
              {t.noCompletedWeeksInMonth}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function AdminRankingsOverviewPage() {
  const language = useDashboardLanguage();
  const t = rankingsCopy[language];
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [rankingLimit, setRankingLimit] = useState(100);
  const queryArgs =
    selectedGroup !== "all"
      ? { groupId: selectedGroup, limit: rankingLimit }
      : { limit: rankingLimit };
  const { data, isLoading, isError, refetch } =
    useGetAdminRankingSystemInputsQuery(queryArgs);
  const { data: groups = [] } = useGetGroupsQuery({});

  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const completedRows = useMemo(
    () => rows.filter((row) => isActualCompletedRankingRow(row)),
    [rows],
  );
  const latestWeek = latestCompletedRankingWeekKey(rows);
  const weeklyRows = useMemo(
    () =>
      sortWeeklyRankingRows(
        completedRows.filter(
          (row) => rankingDateKey(row.week_start) === latestWeek,
        ),
      ),
    [completedRows, latestWeek],
  );
  const latestMonth = useMemo(() => latestRankingMonthKey(rows), [rows]);
  const monthRange = useMemo(
    () => rankingMonthRange(latestMonth),
    [latestMonth],
  );
  const monthlyRows = useMemo(
    () => buildMonthlyRankingRows(rows, latestMonth),
    [rows, latestMonth],
  );
  const monthlyWeekStarts = useMemo(
    () => [...new Set(monthlyRows.flatMap((row) => row.weekStarts))].sort(),
    [monthlyRows],
  );
  const monthlyWeeksLabel = monthlyWeekStarts.length
    ? rankingWeeksInMonthLabel(monthlyWeekStarts, latestMonth)
    : t.noCompletedWeeks;
  const monthlyTop = monthlyRows.slice(0, 10);
  const weeklyTop = weeklyRows.slice(0, 5);
  const weeklyHistory = useMemo(() => buildWeeklyRankingHistory(rows), [rows]);
  const monthlyHistory = useMemo(
    () => buildMonthlyRankingHistory(rows),
    [rows],
  );
  const detailedHistory = useMemo(
    () =>
      monthlyHistory.map((month) => ({
        month,
        weeks: weeklyHistory.filter(
          (week) => rankingMonthKey(week.key) === month.key,
        ),
      })),
    [monthlyHistory, weeklyHistory],
  );
  const pagination = data?.pagination;
  const hasMoreRankingRows =
    Boolean(pagination?.total) && rows.length < Number(pagination?.total ?? 0);
  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    setRankingLimit(100);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.rankings },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedGroup} onValueChange={handleGroupChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t.filterByGroup} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allGroups}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RefreshButton onRefresh={refetch} label={t.refresh} />
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-destructive">
            {t.loadError}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/50 bg-card lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {t.monthlyWindow}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.month}</p>
                  <p className="mt-2 text-2xl font-black">{monthRange.label}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.period}</p>
                  <p className="mt-2 font-semibold">
                    {monthRange.start
                      ? `${formatDate(monthRange.start)} ${t.to} ${formatDate(monthRange.end)}`
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.weeksCounted}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {monthlyWeeksLabel}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-yellow-300" />
                  {t.monthlyOne}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyRows[0] ? (
                  <div className="flex items-center gap-3">
                    <PlayerAvatar name={monthlyRows[0].playerName} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {monthlyRows[0].playerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.scoreAcrossWeeks
                          .replace("{score}", scoreText(monthlyRows[0].score))
                          .replace(
                            "{weeks}",
                            rankingWeeksInMonthLabel(
                              monthlyRows[0].weekStarts,
                              monthlyRows[0].month,
                            ),
                          )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.noMonthlyRanking}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roleCards.map((config) => (
              <MonthlyRoleCard
                key={config.role}
                config={config}
                row={monthlyRoleLeader(monthlyRows, config.role)}
                t={t}
              />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{t.latestWeeklyRunTitle}</span>
                  <Badge variant="info">
                    {latestWeek ? rankingWeekLabel(latestWeek) : t.noWeek}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleCards.map((config) => (
                    <WeeklyRoleCard
                      key={config.role}
                      config={config}
                      row={weeklyRoleLeader(weeklyRows, config.role)}
                      t={t}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {weeklyTop.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/15 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background font-mono font-bold">
                          #{rankValue(row)}
                        </span>
                        <PlayerAvatar
                          name={row.player_name || t.playerFallback}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {row.player_name || t.playerFallback}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[row.position, roleFamilyLabel(row.role_family, t)]
                              .filter(Boolean)
                              .join(" - ")}
                          </p>
                        </div>
                      </div>
                      <p className="font-mono text-lg font-bold text-primary">
                        {scoreText(rankingWeeklyScore(row))}
                      </p>
                    </div>
                  ))}
                  {!weeklyTop.length && (
                    <p className="rounded-lg border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
                      {t.noWeeklyRows}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{t.monthlyLeaderboard}</span>
                  <Badge variant="outline">
                    {t.playersCount.replace(
                      "{count}",
                      String(monthlyRows.length),
                    )}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {monthlyTop.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/15 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background font-mono font-bold">
                        #{row.rank}
                      </span>
                      <PlayerAvatar name={row.playerName} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.playerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            row.position,
                            roleFamilyLabel(row.roleFamily, t),
                            rankingWeeksInMonthLabel(row.weekStarts, row.month),
                          ]
                            .filter(Boolean)
                            .join(" - ")}
                        </p>
                      </div>
                    </div>
                    <p className="font-mono text-lg font-bold text-primary">
                      {scoreText(row.score)}
                    </p>
                  </div>
                ))}
                {!monthlyTop.length && (
                  <p className="rounded-lg border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
                    {t.noMonthlyRows}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black">{t.detailedHistory}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.detailedHistoryDescription}
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                {t.monthsCount.replace(
                  "{count}",
                  String(detailedHistory.length),
                )}
              </Badge>
            </div>

            {detailedHistory.map(({ month, weeks }) => (
              <MonthlyDetailedHistory
                key={month.key}
                month={month}
                weeks={weeks}
                t={t}
              />
            ))}

            {!detailedHistory.length && (
              <Card className="border-border/50 bg-card">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  {t.noDetailedHistory}
                </CardContent>
              </Card>
            )}

            {hasMoreRankingRows && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() =>
                    setRankingLimit((value) =>
                      Math.min(value + 100, pagination?.total ?? value + 100),
                    )
                  }
                  disabled={isLoading}
                >
                  {t.loadMoreHistory
                    .replace("{shown}", String(rows.length))
                    .replace("{total}", String(pagination?.total))}
                </Button>
              </div>
            )}
          </section>

          <Card className="border-border/50 bg-card">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{t.cycleTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.cycleDescription}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" asChild>
                  <Link href="/admin/rankings/weekly">{t.weeklyPage}</Link>
                </Button>
                <Button asChild>
                  <Link href="/admin/rankings/monthly">{t.monthlyPage}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
