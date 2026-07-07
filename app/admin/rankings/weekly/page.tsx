"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, getInitials } from "@/lib/utils";
import { Medal, RefreshCw, Trophy } from "lucide-react";
import {
  useGetAdminRankingSystemInputsQuery,
  useGetGroupsQuery,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import type { RankingSystemInput } from "@/lib/store/api/calendarApi";
import {
  isActualCompletedRankingRow,
  latestCompletedRankingWeekKey,
  rankingDateKey,
  rankingWeekLabel,
} from "@/lib/rankings/monthlyRanking";

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const scoreValue = (row: RankingSystemInput) =>
  numberValue(row.final_api_response?.weekly_score ?? row.weekly_score);

const rankValue = (row: RankingSystemInput) =>
  row.final_api_response?.rank ?? row.rank;

const sortByModelRank = (rows: RankingSystemInput[]) =>
  [...rows].sort((a, b) => {
    const rankDiff = rankValue(a) - rankValue(b);
    if (rankDiff) return rankDiff;
    const scoreDiff = (scoreValue(b) ?? -1) - (scoreValue(a) ?? -1);
    if (scoreDiff) return scoreDiff;
    return String(a.player_name || "").localeCompare(String(b.player_name || ""));
  });

const formatScore = (value: unknown) => {
  const numeric = numberValue(value);
  if (numeric === null) return "-";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

const weeklyCopy = {
  en: {
    failedLoad: "Failed to load rankings.",
    retry: "Retry",
    title: "Weekly Rankings",
    description: "Latest weekly Ranking System output, using the same model order shown to coaches.",
    dashboard: "Dashboard",
    rankings: "Rankings",
    weekly: "Weekly",
    filterByGroup: "Filter by group",
    allGroups: "All Groups",
    empty: "No rankings available yet.",
    week: "Week",
    period: "Period",
    to: "to",
    playersRanked: "Players ranked",
    playerFallback: "Player",
    points: "points",
    roleLabels: {
      attack: "Attack",
      midfield: "Midfield",
      defense: "Defense",
      goalkeeper: "Goalkeeper",
    },
  },
  ar: {
    failedLoad: "فشل تحميل الترتيب.",
    retry: "إعادة المحاولة",
    title: "الترتيب الأسبوعي",
    description: "آخر مخرجات نظام الترتيب الأسبوعي بنفس ترتيب النموذج الظاهر للمدربين.",
    dashboard: "لوحة التحكم",
    rankings: "الترتيبات",
    weekly: "أسبوعي",
    filterByGroup: "تصفية حسب المجموعة",
    allGroups: "كل المجموعات",
    empty: "لا يوجد ترتيب متاح بعد.",
    week: "الأسبوع",
    period: "الفترة",
    to: "إلى",
    playersRanked: "اللاعبون المرتبون",
    playerFallback: "لاعب",
    points: "نقطة",
    roleLabels: {
      attack: "هجوم",
      midfield: "وسط",
      defense: "دفاع",
      goalkeeper: "حارس مرمى",
    },
  },
} as const;

const formatRole = (
  value: string | null | undefined,
  labels: Record<keyof typeof weeklyCopy.en.roleLabels, string>,
) => {
  if (!value) return null;
  const key = value.toLowerCase() as keyof typeof labels;
  return labels[key] ?? value.replace(/_/g, " ");
};

export default function WeeklyRankingsPage() {
  const language = useDashboardLanguage();
  const t = weeklyCopy[language];
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState("all");

  const { data, isLoading, isError, refetch } = useGetAdminRankingSystemInputsQuery(
    selectedGroup !== "all" ? { groupId: selectedGroup, limit: 100 } : { limit: 100 }
  );
  const { data: groups } = useGetGroupsQuery({});

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{t.failedLoad}</p>
        <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </Button>
      </div>
    );
  }

  const rows = data?.data ?? [];
  const completedRows = rows.filter((row) => isActualCompletedRankingRow(row));
  const latestWeek = latestCompletedRankingWeekKey(rows);
  const rankings = sortByModelRank(
    completedRows.filter((row) => rankingDateKey(row.week_start) === latestWeek),
  );
  const latestWeekEnd = rankings[0]?.week_end;
  const medalColor = (rank: number) =>
    rank === 1 ? "text-amber-400" : rank === 2 ? "text-gray-300" : rank === 3 ? "text-amber-600" : "";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.rankings },
          { label: t.weekly },
        ]}
        actions={
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t.filterByGroup} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allGroups}</SelectItem>
              {(groups ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {rankings.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>{t.empty}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Card className="border-border/50 bg-card">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t.week}</p>
                <p className="mt-1 font-semibold">{rankingWeekLabel(latestWeek)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.period}</p>
                <p className="mt-1 font-semibold">
                  {latestWeek ? `${formatDate(latestWeek)} ${t.to} ${formatDate(latestWeekEnd)}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.playersRanked}</p>
                <p className="mt-1 font-semibold">{rankings.length}</p>
              </div>
            </CardContent>
          </Card>
          {rankings.map((ranking) => (
            <Card
              key={ranking.id}
              className="cursor-pointer border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg"
              onClick={() => router.push(`/admin/players/${ranking.player_id}`)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center">
                  {rankValue(ranking) <= 3 ? (
                    <Medal className={`h-6 w-6 ${medalColor(rankValue(ranking))}`} />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">#{rankValue(ranking)}</span>
                  )}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-sm text-primary">
                    {getInitials(ranking.player_name || t.playerFallback)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{ranking.player_name || t.playerFallback}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      ranking.position,
                      formatRole(ranking.role_family, t.roleLabels),
                      rankingWeekLabel(latestWeek),
                    ].filter(Boolean).join(" - ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{formatScore(scoreValue(ranking))}</p>
                  <p className="text-[10px] text-muted-foreground">{t.points}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
