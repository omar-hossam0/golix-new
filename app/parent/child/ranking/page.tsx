"use client";

import { BarChart3, BrainCircuit, Loader2, Medal, Star, TrendingUp, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParentChildTabs } from "@/components/parent/ParentChildTabs";
import { ParentDataError } from "@/components/parent/ParentDataError";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import {
  useGetParentDashboardQuery,
  useGetParentRankingSystemInputsQuery,
} from "@/lib/store/api/calendarApi";
import type { PlayerEvaluationRecord, RankingSystemInput } from "@/lib/store/api/calendarApi";
import {
  buildMonthlyRankingHistory,
  buildMonthlyRankingRows,
  buildWeeklyRankingHistory,
  isActualCompletedRankingRow,
  latestCompletedRankingWeekKey,
  latestRankingMonthKey,
  rankingDateKey,
  rankingWeekLabel,
  rankingWeeksInMonthLabel,
} from "@/lib/rankings/monthlyRanking";
import { formatDate } from "@/lib/utils";

const copy = {
  en: {
    title: "Ranking & Evaluations",
    description: (name?: string | null) =>
      name ? `${name}'s ranking and coach evaluations.` : "Ranking and evaluations for your linked player.",
    home: "Home",
    child: "Child",
    rank: "Rank",
    ranking: "Ranking",
    evaluations: "Evaluations",
    selectChild: "Select a child",
    noChild: "No linked child found for this parent account.",
    noProgressAccess: "Progress access is not enabled for this child.",
    noProgressAccessBody: "The coach or academy admin controls whether ranking and evaluation data is visible to parents.",
    loading: "Loading ranking and evaluations...",
    loadError: "Ranking and evaluations could not be loaded",
    loadErrorBody: "Check your connection, then try loading this page again.",
    retry: "Try again",
    totalScore: "Total score",
    period: "Period",
    trend: "Trend",
    aiScore: "AI score",
    coachEval: "Coach evaluation",
    attendance: "Attendance",
    discipline: "Discipline",
    matchScore: "Match score",
    latestEvaluation: "Latest evaluation",
    overall: "Overall",
    technical: "Technical",
    tactical: "Tactical",
    physical: "Physical",
    mental: "Mental",
    noRanking: "No ranking has been published for this player yet.",
    noEvaluations: "No visible evaluations yet.",
    noNotes: "No notes yet.",
    training: "Training",
    rankingHistory: "Ranking History",
    rankingHistoryDescription: "Previous weekly and monthly ranks for the selected player.",
    weekly: "Weekly",
    monthly: "Monthly",
    noWeeklyHistory: "No weekly ranking history yet.",
    noMonthlyHistory: "No monthly ranking history yet.",
  },
  ar: {
    title: "الترتيب والتقييمات",
    description: (name?: string | null) =>
      name ? `ترتيب وتقييمات ${name}.` : "ترتيب وتقييمات اللاعب المرتبط بحسابك.",
    home: "الرئيسية",
    child: "اللاعب",
    rank: "المركز",
    ranking: "الترتيب",
    evaluations: "التقييمات",
    selectChild: "اختر اللاعب",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    noProgressAccess: "صلاحية عرض التقدم غير مفعلة لهذا اللاعب.",
    noProgressAccessBody: "المدرب أو إدارة الأكاديمية هم من يحددون ظهور الترتيب والتقييمات لولي الأمر.",
    loading: "جاري تحميل الترتيب والتقييمات...",
    loadError: "تعذر تحميل الترتيب والتقييمات",
    loadErrorBody: "تحقق من الاتصال ثم حاول تحميل الصفحة مرة أخرى.",
    retry: "إعادة المحاولة",
    totalScore: "إجمالي النقاط",
    period: "الفترة",
    trend: "الاتجاه",
    aiScore: "تقييم الذكاء",
    coachEval: "تقييم المدرب",
    attendance: "الحضور",
    discipline: "الالتزام",
    matchScore: "تقييم المباراة",
    latestEvaluation: "آخر تقييم",
    overall: "العام",
    technical: "فني",
    tactical: "تكتيكي",
    physical: "بدني",
    mental: "ذهني",
    noRanking: "لم يتم نشر ترتيب لهذا اللاعب بعد.",
    noEvaluations: "لا توجد تقييمات ظاهرة حتى الآن.",
    noNotes: "لا توجد ملاحظات بعد.",
    training: "تدريب",
    rankingHistory: "سجل الترتيب",
    rankingHistoryDescription: "الترتيب الأسبوعي والشهري السابق للاعب المختار.",
    weekly: "أسبوعي",
    monthly: "شهري",
    noWeeklyHistory: "لا يوجد سجل ترتيب أسبوعي حتى الآن.",
    noMonthlyHistory: "لا يوجد سجل ترتيب شهري حتى الآن.",
  },
} as const;

type Language = keyof typeof copy;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreText(value: unknown, fallback = "-") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : fallback;
}

const rankingScore = (row: RankingSystemInput) =>
  row.final_api_response?.weekly_score ?? row.weekly_score;

const rankingRank = (row: RankingSystemInput) =>
  row.final_api_response?.rank ?? row.rank;

function EvaluationCard({
  evaluation,
  language,
}: {
  evaluation: PlayerEvaluationRecord;
  language: Language;
}) {
  const t = copy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const metrics = [
    [t.overall, evaluation.overall_rating],
    [t.technical, evaluation.technical_rating],
    [t.tactical, evaluation.tactical_rating],
    [t.physical, evaluation.physical_rating],
    [t.mental, evaluation.mentality_rating],
  ];

  return (
    <Card className="border-border/40 bg-card">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              {evaluation.event_type || t.training}
            </p>
            <h3 className="mt-1 font-semibold">{evaluation.title || t.training}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(evaluation.start_datetime || new Date().toISOString(), locale)}
            </p>
          </div>
          <Badge variant="success">{scoreText(evaluation.overall_rating)}</Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-md border border-border/30 bg-muted/20 p-2 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold">{scoreText(value)}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {evaluation.coach_notes || evaluation.improvement_plan || t.noNotes}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ParentChildRankingPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const {
    children,
    selectedChildId: childId,
    setSelectedChildId: setChildId,
    isLoading: childrenLoading,
    isError: childrenError,
    refetch: refetchChildren,
  } = useParentSelectedChild();
  const child = children.find((item) => item.id === childId);
  const canViewProgress = child?.can_view_progress !== false;
  const {
    data,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useGetParentDashboardQuery(
    childId ? { childId } : undefined,
    { skip: !childId || !canViewProgress },
  );
  const rankingSystemQuery = useGetParentRankingSystemInputsQuery(
    childId ? { childId, limit: 100 } : undefined,
    { skip: !childId || !canViewProgress },
  );

  const rankingRows = rankingSystemQuery.data?.data ?? [];
  const completedRankingRows = rankingRows.filter((row) =>
    isActualCompletedRankingRow(row),
  );
  const latestWeek = latestCompletedRankingWeekKey(rankingRows);
  const modelRanking = completedRankingRows.find(
    (row) =>
      row.player_id === childId &&
      rankingDateKey(row.week_start) === latestWeek,
  );
  const latestMonth = latestRankingMonthKey(rankingRows);
  const monthlyRanking = buildMonthlyRankingRows(rankingRows, latestMonth).find(
    (row) => row.playerId === childId,
  );
  const weeklyHistory = buildWeeklyRankingHistory(rankingRows)
    .map((period) => ({
      ...period,
      row: period.rows.find((row) => row.player_id === childId),
    }))
    .filter((period) => period.row);
  const monthlyHistory = buildMonthlyRankingHistory(rankingRows)
    .map((period) => ({
      ...period,
      row: period.rows.find((row) => row.playerId === childId),
    }))
    .filter((period) => period.row);
  const ranking = monthlyRanking
    ? {
        rank: monthlyRanking.rank,
        total_score: monthlyRanking.score,
        period: rankingWeeksInMonthLabel(monthlyRanking.weekStarts, monthlyRanking.month),
        trend: monthlyRanking.latestRow?.final_api_response?.trend ?? monthlyRanking.latestRow?.trend,
        calculated_at: monthlyRanking.latestRow?.week_end || monthlyRanking.latestRow?.week_start,
        breakdown: {
          coach_eval_score: monthlyRanking.breakdown.coachScore,
          attendance_score: monthlyRanking.breakdown.attendanceScore,
          discipline_score: monthlyRanking.score,
          match_score: monthlyRanking.breakdown.matchScore,
          ai_score: monthlyRanking.breakdown.weeklyAiScore,
        },
      }
    : modelRanking
    ? {
        rank: rankingRank(modelRanking),
        total_score: rankingScore(modelRanking),
        period: rankingWeekLabel(latestWeek),
        trend: modelRanking.final_api_response?.trend ?? modelRanking.trend,
        calculated_at: modelRanking.week_end || modelRanking.week_start,
        breakdown: {
          coach_eval_score: modelRanking.coach_score,
          attendance_score: modelRanking.attendance_score,
          discipline_score: modelRanking.weekly_score,
          match_score: modelRanking.match_score,
          ai_score: modelRanking.weekly_ai_score,
        },
      }
    : data?.aiInsights?.ranking ?? null;
  const evaluations = [...(data?.evaluations?.data ?? [])].sort((a, b) =>
    String(b.start_datetime || "").localeCompare(String(a.start_datetime || "")),
  );
  const latestEvaluation = evaluations[0];
  const breakdown = ranking?.breakdown;
  const loading = childrenLoading || dashboardLoading || rankingSystemQuery.isLoading;
  const isError = childrenError || (canViewProgress && dashboardError);

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description(child?.full_name)}
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.child },
          { label: t.ranking },
        ]}
      />

      <ParentChildTabs
        items={children}
        selectedChildId={childId}
        onSelect={setChildId}
        ariaLabel={t.selectChild}
      />

      {isError ? (
        <ParentDataError
          title={t.loadError}
          description={t.loadErrorBody}
          retryLabel={t.retry}
          onRetry={() => {
            refetchChildren();
            if (childId && canViewProgress) refetchDashboard();
          }}
        />
      ) : !childId && !childrenLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noChild}
          </CardContent>
        </Card>
      ) : !canViewProgress ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Trophy className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-black text-foreground">{t.noProgressAccess}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-muted-foreground">
              {t.noProgressAccessBody}
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Medal className="h-4 w-4 text-primary" />
                  {t.ranking}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ranking ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-border/30 bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">{t.rank}</p>
                        <p className="mt-2 text-4xl font-black text-primary">
                          {ranking.rank ? `#${ranking.rank}` : "-"}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/30 bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">{t.totalScore}</p>
                        <p className="mt-2 text-4xl font-black">
                          {scoreText(ranking.total_score)}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/30 bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">{t.trend}</p>
                        <p className="mt-2 text-2xl font-black capitalize">
                          {ranking.trend || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/30 bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{t.period}</p>
                          <p className="mt-1 font-semibold">{ranking.period || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.latestEvaluation}</p>
                          <p className="mt-1 font-semibold">
                            {formatDate(ranking.calculated_at || new Date().toISOString(), locale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground">
                    {t.noRanking}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {t.totalScore}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  [t.coachEval, breakdown?.coach_eval_score, Star],
                  [t.attendance, breakdown?.attendance_score, TrendingUp],
                  [t.discipline, breakdown?.discipline_score, Medal],
                  [t.matchScore, breakdown?.match_score, Trophy],
                  [t.aiScore, breakdown?.ai_score, BrainCircuit],
                ].map(([label, value, Icon]) => {
                  const numeric = Math.max(0, Math.min(100, numberValue(value)));
                  const IconComponent = Icon as typeof Star;
                  return (
                    <div key={String(label)} className="rounded-md border border-border/30 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <IconComponent className="h-4 w-4 text-primary" />
                          {String(label)}
                        </span>
                        <span className="text-sm font-bold">{scoreText(value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${numeric}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.rankingHistory}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t.rankingHistoryDescription}
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  {t.weekly}
                </p>
                {weeklyHistory.slice(0, 8).map((period) => {
                  const row = period.row;
                  if (!row) return null;
                  return (
                    <div key={period.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/20 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{period.label}</p>
                        <p className="text-xs text-muted-foreground">{period.rangeLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-primary">
                          #{rankingRank(row)}
                        </p>
                        <p className="text-xs text-muted-foreground">{scoreText(rankingScore(row))} pts</p>
                      </div>
                    </div>
                  );
                })}
                {!weeklyHistory.length && (
                  <div className="rounded-lg border border-dashed border-border/40 p-5 text-center text-sm text-muted-foreground">
                    {t.noWeeklyHistory}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  {t.monthly}
                </p>
                {monthlyHistory.slice(0, 8).map((period) => {
                  const row = period.row;
                  if (!row) return null;
                  return (
                    <div key={period.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/20 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{period.label}</p>
                        <p className="text-xs text-muted-foreground">{period.weeksLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-primary">
                          #{row.rank}
                        </p>
                        <p className="text-xs text-muted-foreground">{scoreText(row.score)} pts</p>
                      </div>
                    </div>
                  );
                })}
                {!monthlyHistory.length && (
                  <div className="rounded-lg border border-dashed border-border/40 p-5 text-center text-sm text-muted-foreground">
                    {t.noMonthlyHistory}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {latestEvaluation && (
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.latestEvaluation}</CardTitle>
              </CardHeader>
              <CardContent>
                <EvaluationCard evaluation={latestEvaluation} language={language} />
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.evaluations}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {evaluations.length ? (
                evaluations.map((evaluation) => (
                  <EvaluationCard key={evaluation.id} evaluation={evaluation} language={language} />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground">
                  {t.noEvaluations}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
