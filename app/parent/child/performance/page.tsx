"use client";

import { useMemo } from "react";
import { Loader2, Star, Target, Trophy, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { ParentChildTabs } from "@/components/parent/ParentChildTabs";
import { ParentDataError } from "@/components/parent/ParentDataError";
import {
  useGetParentChildEvaluationsQuery,
  useGetParentChildProgressQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { formatDate } from "@/lib/utils";

function score(value: unknown) {
  return Number(value || 0);
}

const copy = {
  en: {
    title: "Child Performance",
    description: (name?: string | null) =>
      name ? `${name}'s live performance overview` : "Performance overview for your linked player.",
    home: "Home",
    child: "Child",
    performance: "Performance",
    noChild: "No linked child found for this parent account.",
    selectChild: "Select a child",
    noProgressAccess: "Progress access is not enabled for this child.",
    noProgressAccessBody: "The coach or academy admin controls whether performance data is visible to parents.",
    loading: "Loading performance...",
    loadError: "Performance could not be loaded",
    loadErrorBody: "Check your connection, then try loading performance again.",
    retry: "Try again",
    attendance: "Attendance",
    trainingRating: "Training Rating",
    matchRating: "Match Rating",
    goalContributions: "Goal Contributions",
    scoreTrend: "Score Trend",
    overallScore: "Overall Score",
    skillBreakdown: "Skill Breakdown",
    score: "Score",
    technical: "Technical",
    tactical: "Tactical",
    physical: "Physical",
    mental: "Mental",
    coachEvaluations: "Coach Evaluations",
    training: "Training",
    noNotes: "No notes yet.",
    noEvaluations: "No visible evaluations yet.",
  },
  ar: {
    title: "أداء اللاعب",
    description: (name?: string | null) =>
      name ? `نظرة مباشرة على أداء ${name}` : "نظرة على أداء اللاعب المرتبط بحسابك.",
    home: "الرئيسية",
    child: "اللاعب",
    performance: "الأداء",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    selectChild: "اختر اللاعب",
    noProgressAccess: "صلاحية عرض التقدم غير مفعلة لهذا اللاعب.",
    noProgressAccessBody: "المدرب أو إدارة الأكاديمية هم من يحددون ظهور بيانات الأداء لولي الأمر.",
    loading: "جاري تحميل الأداء...",
    loadError: "تعذر تحميل الأداء",
    loadErrorBody: "تحقق من الاتصال ثم حاول تحميل بيانات الأداء مرة أخرى.",
    retry: "إعادة المحاولة",
    attendance: "الحضور",
    trainingRating: "تقييم التدريب",
    matchRating: "تقييم المباراة",
    goalContributions: "الأهداف / التمريرات",
    scoreTrend: "اتجاه التقييم",
    overallScore: "التقييم العام",
    skillBreakdown: "تفصيل المهارات",
    score: "التقييم",
    technical: "فني",
    tactical: "تكتيكي",
    physical: "بدني",
    mental: "ذهني",
    coachEvaluations: "تقييمات المدرب",
    training: "تدريب",
    noNotes: "لا توجد ملاحظات بعد.",
    noEvaluations: "لا توجد تقييمات ظاهرة حتى الآن.",
  },
} as const;

export default function ParentChildPerformancePage() {
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
    data: progress,
    isLoading: progressLoading,
    isError: progressError,
    refetch: refetchProgress,
  } =
    useGetParentChildProgressQuery(childId, { skip: !childId || !canViewProgress });
  const {
    data: evaluationsData,
    isLoading: evaluationsLoading,
    isError: evaluationsError,
    refetch: refetchEvaluations,
  } =
    useGetParentChildEvaluationsQuery(
      { childId, limit: 100 },
      { skip: !childId || !canViewProgress },
    );
  const evaluations = useMemo(
    () =>
      [...(evaluationsData?.data ?? [])].sort((a, b) =>
        String(a.start_datetime || "").localeCompare(String(b.start_datetime || "")),
      ),
    [evaluationsData?.data],
  );
  const latestEval = evaluations[evaluations.length - 1];

  const scoreData = evaluations.map((evaluation) => ({
    label: formatDate(evaluation.start_datetime || new Date().toISOString(), locale).split(",")[0],
    value: score(evaluation.overall_rating) * 10,
  }));

  const skillData = latestEval
    ? [
        { label: t.technical, value: score(latestEval.technical_rating) * 10 },
        { label: t.tactical, value: score(latestEval.tactical_rating) * 10 },
        { label: t.physical, value: score(latestEval.physical_rating) * 10 },
        { label: t.mental, value: score(latestEval.mentality_rating) * 10 },
      ]
    : [];

  const loading = childrenLoading || progressLoading || evaluationsLoading;
  const isError =
    childrenError || (canViewProgress && (progressError || evaluationsError));

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description(child?.full_name)}
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.child },
          { label: t.performance },
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
            if (childId && canViewProgress) {
              refetchProgress();
              refetchEvaluations();
            }
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
            <ShieldLockIcon />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: t.attendance,
                value: `${progress?.attendancePercentage ?? 0}%`,
                Icon: TrendingUp,
                color: "text-primary",
              },
              {
                label: t.trainingRating,
                value: score(progress?.averageTrainingRating).toFixed(1),
                Icon: Star,
                color: "text-accent",
              },
              {
                label: t.matchRating,
                value: score(progress?.averageMatchRating).toFixed(1),
                Icon: Trophy,
                color: "text-yellow-400",
              },
              {
                label: t.goalContributions,
                value: `${progress?.goals ?? 0}/${progress?.assists ?? 0}`,
                Icon: Target,
                color: "text-emerald-400",
              },
            ].map(({ label, value, Icon, color }) => (
              <Card key={label} className="border-border/50 bg-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${color}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{t.scoreTrend}</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart
                  labels={scoreData.map((d) => d.label)}
                  datasets={[
                    {
                      label: t.overallScore,
                      data: scoreData.map((d) => d.value),
                      color: "#2d9ad5",
                    },
                  ]}
                  height={280}
                />
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{t.skillBreakdown}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  labels={skillData.map((d) => d.label)}
                  datasets={[
                    {
                      label: t.score,
                      data: skillData.map((d) => d.value),
                      color: "#51b848",
                    },
                  ]}
                  height={280}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t.coachEvaluations}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {evaluations
                .slice()
                .reverse()
                .map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="rounded-lg border border-border/30 bg-muted/20 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{evaluation.title || t.training}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(evaluation.start_datetime || new Date().toISOString(), locale)}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        {score(evaluation.overall_rating).toFixed(1)}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      {evaluation.coach_notes || evaluation.improvement_plan || t.noNotes}
                    </p>
                  </div>
                ))}
              {!evaluations.length && (
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

function ShieldLockIcon() {
  return (
    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
      <Target className="h-7 w-7" />
    </span>
  );
}
