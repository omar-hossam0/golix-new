"use client";

import { useMemo, useState, type ComponentType } from "react";
import { Activity, BrainCircuit, Database, Loader2, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type RankingSystemInput,
  useGetCoachRankingSystemInputsQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { cn, formatDate } from "@/lib/utils";

const baseFields: Array<{
  key: keyof Pick<
    RankingSystemInput,
    | "technical_rating"
    | "tactical_rating"
    | "physical_rating"
    | "mentality_rating"
    | "decision_making_rating"
    | "work_rate_rating"
    | "positioning_rating"
  >;
  label: string;
}> = [
  { key: "technical_rating", label: "Tech" },
  { key: "tactical_rating", label: "Tact" },
  { key: "physical_rating", label: "Phys" },
  { key: "mentality_rating", label: "Mental" },
  { key: "decision_making_rating", label: "Decision" },
  { key: "work_rate_rating", label: "Work" },
  { key: "positioning_rating", label: "Position" },
];

const roleProfiles = {
  attack: {
    title: "Attack Position",
    inputs: ["shots_on_target", "key_passes", "goals", "assists"],
    modifiers: ["Goal Bonus +5", "Assist Bonus +4"],
    output: "match_score",
  },
  midfield: {
    title: "Midfield Position",
    inputs: ["pass_accuracy", "key_passes", "duels", "goals", "assists"],
    modifiers: ["Goal Bonus +6", "Assist Bonus +5"],
    output: "match_score",
  },
  defense: {
    title: "Defense Position",
    inputs: ["defensive_tackles", "interceptions", "duels", "positioning"],
    modifiers: ["Goal Bonus +8", "Clean Sheet Bonus +6"],
    output: "match_score",
  },
  goalkeeper: {
    title: "Goalkeeper Position",
    inputs: ["saves", "shot_stopping", "distribution_accuracy"],
    modifiers: ["Clean Sheet Bonus +8", "Handling Error Penalty -5"],
    output: "match_score",
  },
} as const;

const dailyAiProfile = {
  title: "Daily AI Score Module",
  inputs: ["sleep_hours", "trained_today", "meals_count"],
  modifiers: [
    "Sleep >= 8h +40",
    "Sleep >= 7h +30",
    "Otherwise +20",
    "Trained 1 +40",
    "Trained 0 +0",
    "4+ meals +20",
    "3 meals +15",
    "<3 meals +10",
  ],
  output: "daily_ai_score",
};

const weeklyScoreProfile = {
  title: "Weekly Score Formula",
  inputs: ["match_score", "coach_score", "attendance_score", "weekly_ai_score"],
  modifiers: ["50% Match", "25% Coach", "15% Attendance", "10% Weekly AI"],
  output: "weekly_score",
};

const predictionProfile = {
  title: "Prediction Module",
  inputs: [
    "match_score",
    "coach_score",
    "attendance_score",
    "weekly_ai_score",
    "position",
  ],
  modifiers: ["Model Random Forest Regressor"],
  output: "predicted_next_score",
};

const roleLabels: Record<RankingSystemInput["role_family"], string> = {
  attack: "Attack",
  midfield: "Midfield",
  defense: "Defense",
  goalkeeper: "Goalkeeper",
  unknown: "Unknown",
};

const PAGE_SIZE_OPTIONS = [15, 25, 50] as const;

const gradeClassName: Record<RankingSystemInput["grade"], string> = {
  A: "border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.18)]",
  B: "border-cyan-400/40 bg-cyan-500/20 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.16)]",
  C: "border-amber-400/45 bg-amber-500/20 text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.14)]",
  D: "border-orange-400/45 bg-orange-500/20 text-orange-100 shadow-[0_0_18px_rgba(249,115,22,0.14)]",
  F: "border-red-400/45 bg-red-500/20 text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.14)]",
};

const gradeLegend = [
  ["A", "Best"],
  ["B", "Strong"],
  ["C", "Average"],
  ["D", "Low"],
  ["F", "Critical"],
] as const;

const compactMetricLabels: Record<string, string> = {
  shots_on_target: "Shots",
  key_passes: "Key",
  goals: "Goals",
  assists: "Assists",
  pass_accuracy: "Pass %",
  duels: "Duels",
  defensive_tackles: "Tackles",
  interceptions: "Interceptions",
  positioning: "Position",
  clean_sheets: "Clean",
  saves: "Saves",
  shot_stopping: "Stops",
  distribution_accuracy: "Dist %",
  handling_errors: "Errors",
};

const rankingCopy = {
  en: {
    title: "Ranking System",
    description:
      "Weekly model inputs, calculated scores, and Ranking Model API response.",
    home: "Home",
    refresh: "Refresh",
    loadError: "Could not load weekly ranking inputs.",
    retry: "Retry",
    loading: "Loading weekly ranking inputs...",
    weeklyPackages: "Weekly Packages",
    weeklyPackagesDetail: "One package per player per week",
    baseInputsReady: "Base Inputs Ready",
    baseInputsDetail:
      "Technical, tactical, physical, mentality, decision, work rate, positioning",
    roleInputsReady: "Role Inputs Ready",
    roleInputsDetail: "Position-specific match inputs available",
    dailyAiReady: "Daily AI Ready",
    dailyAiDetail: "Weekly daily_ai_score packages from player daily fields",
    finalScores: "Final Scores",
    finalScoresDetail: "weekly_score, grade, trend, rank",
    mlPredictions: "ML Predictions",
    mlPredictionsDetail: "predicted_next_score from Ranking Model",
    playersWeeks: "Players / Weeks",
    playersWeeksDetail: "Players and weeks represented",
    weeklyModelInputs: "Weekly Model Inputs",
    showing: (start: number, end: number, total: number) =>
      `Showing ${start}-${end} of ${total}`,
    grades: "Grades",
    prev: "Prev",
    next: "Next",
    inputs: "Inputs",
    modelRule: "Model Rule",
    output: "Output",
    profileTitles: {
      "Attack Position": "Attack Position",
      "Midfield Position": "Midfield Position",
      "Defense Position": "Defense Position",
      "Goalkeeper Position": "Goalkeeper Position",
      "Daily AI Score Module": "Daily AI Score Module",
      "Weekly Score Formula": "Weekly Score Formula",
      "Prediction Module": "Prediction Module",
    },
  },
  ar: {
    title: "نظام الترتيب",
    description:
      "مدخلات النموذج الأسبوعية، الدرجات المحسوبة، واستجابة Ranking Model API.",
    home: "الرئيسية",
    refresh: "تحديث",
    loadError: "تعذر تحميل مدخلات الترتيب الأسبوعية.",
    retry: "إعادة المحاولة",
    loading: "جاري تحميل مدخلات الترتيب الأسبوعية...",
    weeklyPackages: "حزم الأسبوع",
    weeklyPackagesDetail: "حزمة واحدة لكل لاعب في كل أسبوع",
    baseInputsReady: "المدخلات الأساسية جاهزة",
    baseInputsDetail: "فني، تكتيكي، بدني، ذهني، قرار، معدل عمل، تمركز",
    roleInputsReady: "مدخلات الدور جاهزة",
    roleInputsDetail: "مدخلات مباراة حسب مركز اللاعب متاحة",
    dailyAiReady: "الذكاء اليومي جاهز",
    dailyAiDetail: "حزم weekly daily_ai_score من حقول اللاعب اليومية",
    finalScores: "الدرجات النهائية",
    finalScoresDetail: "weekly_score، الدرجة، الاتجاه، الترتيب",
    mlPredictions: "توقعات النموذج",
    mlPredictionsDetail: "predicted_next_score من نموذج الترتيب",
    playersWeeks: "اللاعبون / الأسابيع",
    playersWeeksDetail: "اللاعبون والأسابيع الممثلة",
    weeklyModelInputs: "مدخلات النموذج الأسبوعية",
    showing: (start: number, end: number, total: number) =>
      `عرض ${start}-${end} من ${total}`,
    grades: "الدرجات",
    prev: "السابق",
    next: "التالي",
    inputs: "المدخلات",
    modelRule: "قاعدة النموذج",
    output: "المخرج",
    profileTitles: {
      "Attack Position": "مركز الهجوم",
      "Midfield Position": "مركز الوسط",
      "Defense Position": "مركز الدفاع",
      "Goalkeeper Position": "مركز حارس المرمى",
      "Daily AI Score Module": "وحدة درجة الذكاء اليومية",
      "Weekly Score Formula": "معادلة الدرجة الأسبوعية",
      "Prediction Module": "وحدة التوقع",
    },
  },
} as const;

type RankingCopy = (typeof rankingCopy)[keyof typeof rankingCopy];

type ModelProfile = {
  title: string;
  inputs: readonly string[];
  modifiers: readonly string[];
  output: string;
};

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const metricText = (value: unknown, emptyText = "-") => {
  const numeric = numberValue(value);
  if (numeric === null) return emptyText;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};

const metricTone = (value: unknown, mode: "score" | "count" = "score") => {
  const numeric = numberValue(value);
  if (numeric === null) return "text-muted-foreground";
  if (mode === "count") {
    if (numeric > 0) return "text-primary";
    return "text-muted-foreground";
  }
  if (numeric >= 85) return "text-emerald-400";
  if (numeric >= 70) return "text-cyan-300";
  if (numeric >= 55) return "text-amber-300";
  return "text-destructive";
};

const hasBaseInputs = (row: RankingSystemInput) =>
  baseFields.every((field) => numberValue(row[field.key]) !== null);

const hasAnyBaseInput = (row: RankingSystemInput) =>
  baseFields.some((field) => numberValue(row[field.key]) !== null);

const roleValues = (row: RankingSystemInput): Array<[string, unknown]> => {
  switch (row.role_family) {
    case "attack":
      return [
        ["shots_on_target", row.shots_on_target],
        ["key_passes", row.key_passes],
        ["goals", row.goals],
        ["assists", row.assists],
      ];
    case "midfield":
      return [
        ["pass_accuracy", row.pass_accuracy],
        ["key_passes", row.key_passes],
        ["duels", row.duels],
        ["goals", row.goals],
        ["assists", row.assists],
      ];
    case "defense":
      return [
        ["defensive_tackles", row.defensive_tackles],
        ["interceptions", row.interceptions],
        ["duels", row.duels],
        ["positioning", row.positioning_rating],
        ["clean_sheets", row.clean_sheets],
      ];
    case "goalkeeper":
      return [
        ["saves", row.saves],
        ["shot_stopping", row.shot_stopping],
        ["distribution_accuracy", row.distribution_accuracy],
        ["clean_sheets", row.clean_sheets],
        ["handling_errors", row.handling_errors],
      ];
    default:
      return [];
  }
};

const displayInputValues = (items: Array<[string, unknown]>) =>
  items.map(([label, value]) => [
    compactMetricLabels[String(label)] ?? String(label),
    value,
  ]) as Array<[string, unknown]>;

const hasRoleInputs = (row: RankingSystemInput) => {
  if (row.role_family === "unknown" || row.match_evaluation_count === 0) {
    return false;
  }
  return roleValues(row)
    .filter(([key]) => key !== "clean_sheets" && key !== "handling_errors")
    .every(([, value]) => numberValue(value) !== null);
};

const hasDailyInputs = (row: RankingSystemInput) =>
  row.daily_ai_input_count > 0 && numberValue(row.daily_ai_score) !== null;

const hasWeeklyScore = (row: RankingSystemInput) =>
  numberValue(row.weekly_score) !== null;

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
          <span className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function RoleProfileCard({
  profile,
  copy,
}: {
  profile: ModelProfile;
  copy: RankingCopy;
}) {
  const profileTitles = copy.profileTitles as Record<string, string>;

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {profileTitles[profile.title] ?? profile.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div>
          <p className="mb-1 text-muted-foreground">{copy.inputs}</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.inputs.map((input) => (
              <Badge key={input} variant="secondary">
                {input}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground">{copy.modelRule}</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.modifiers.map((modifier) => (
              <Badge key={modifier} variant="outline">
                {modifier}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground">
          {copy.output}{" "}
          <span className="font-medium text-foreground">{profile.output}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function MetricStack({
  items,
  columns = 1,
  emptyText = "-",
  toneMode = "score",
}: {
  items: Array<[string, unknown]>;
  columns?: 1 | 2;
  emptyText?: string;
  toneMode?: "score" | "count";
}) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-1.5 text-xs",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid min-h-6 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2"
        >
          <span className="whitespace-nowrap text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "shrink-0 text-right font-mono text-sm font-semibold tabular-nums",
              numberValue(value) === null && emptyText !== "-"
                ? "font-sans text-[11px] font-medium"
                : "",
              metricTone(value, toneMode),
            )}
          >
            {metricText(value, emptyText)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScoreValue({ value }: { value: unknown }) {
  return (
    <span
      className={cn(
        "block min-w-16 text-right font-mono text-sm font-semibold tabular-nums",
        metricTone(value),
      )}
    >
      {metricText(value)}
    </span>
  );
}

function GradeBadge({ grade }: { grade: RankingSystemInput["grade"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "min-w-9 justify-center rounded-md px-2.5 py-1 font-mono text-xs font-bold",
        gradeClassName[grade],
      )}
    >
      {grade}
    </Badge>
  );
}

export default function CoachRankingSystemPage() {
  const language = useDashboardLanguage();
  const t = rankingCopy[language];
  const { data, isLoading, isError, refetch } =
    useGetCoachRankingSystemInputsQuery({ limit: 100 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);
  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const baseReadyRows = rows.filter(hasBaseInputs);
  const roleReadyRows = rows.filter(hasRoleInputs);
  const dailyReadyRows = rows.filter(hasDailyInputs);
  const weeklyScoreRows = rows.filter(hasWeeklyScore);
  const predictionReadyRows = rows.filter(
    (row) => row.prediction_status === "ready",
  );
  const playerCount = new Set(rows.map((row) => row.player_id)).size;
  const weekCount = new Set(rows.map((row) => row.week_start)).size;
  const totalRows = data?.pagination.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const effectivePage = Math.min(page, totalPages - 1);
  const startIndex = effectivePage * pageSize;
  const visibleRows = useMemo(
    () => rows.slice(startIndex, startIndex + pageSize),
    [pageSize, rows, startIndex],
  );
  const visibleStart = rows.length ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + visibleRows.length, rows.length);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.title },
        ]}
        actions={
          <RefreshButton onRefresh={refetch} label={t.refresh} />
        }
      />

      {isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-destructive">
            <span>{t.loadError}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label={t.weeklyPackages}
              value={String(totalRows)}
              detail={t.weeklyPackagesDetail}
              icon={Database}
            />
            <MetricCard
              label={t.baseInputsReady}
              value={String(baseReadyRows.length)}
              detail={t.baseInputsDetail}
              icon={Activity}
            />
            <MetricCard
              label={t.roleInputsReady}
              value={String(roleReadyRows.length)}
              detail={t.roleInputsDetail}
              icon={Trophy}
            />
            <MetricCard
              label={t.dailyAiReady}
              value={String(dailyReadyRows.length)}
              detail={t.dailyAiDetail}
              icon={BrainCircuit}
            />
            <MetricCard
              label={t.finalScores}
              value={String(weeklyScoreRows.length)}
              detail={t.finalScoresDetail}
              icon={Trophy}
            />
            <MetricCard
              label={t.mlPredictions}
              value={String(predictionReadyRows.length)}
              detail={t.mlPredictionsDetail}
              icon={BrainCircuit}
            />
            <MetricCard
              label={t.playersWeeks}
              value={`${playerCount} / ${weekCount}`}
              detail={t.playersWeeksDetail}
              icon={Users}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-4">
            {Object.values(roleProfiles).map((profile) => (
              <RoleProfileCard key={profile.title} profile={profile} copy={t} />
            ))}
          </section>
          <section>
            <RoleProfileCard profile={dailyAiProfile} copy={t} />
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <RoleProfileCard profile={weeklyScoreProfile} copy={t} />
            <RoleProfileCard profile={predictionProfile} copy={t} />
          </section>

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {t.weeklyModelInputs}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.showing(visibleStart, visibleEnd, totalRows)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 px-2 py-1">
                    <span className="mr-1 text-xs text-muted-foreground">
                      {t.grades}
                    </span>
                    {gradeLegend.map(([grade, label]) => (
                      <Badge
                        key={grade}
                        variant="outline"
                        title={label}
                        className={cn(
                          "h-6 min-w-7 justify-center rounded-md px-1.5 font-mono text-[11px] font-bold",
                          gradeClassName[grade],
                        )}
                      >
                        {grade}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border/40 p-1">
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={pageSize === option ? "secondary" : "ghost"}
                        className="h-7 px-2"
                        onClick={() => {
                          setPageSize(option);
                          setPage(0);
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={effectivePage === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    {t.prev}
                  </Button>
                  <span className="min-w-20 text-center text-xs text-muted-foreground">
                    {effectivePage + 1} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={effectivePage >= totalPages - 1}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages - 1, value + 1))
                    }
                  >
                    {t.next}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto overscroll-x-contain rounded-md border border-border/40">
                <table className="w-full min-w-[2640px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[220px]" />
                    <col className="w-[150px]" />
                    <col className="w-[190px]" />
                    <col className="w-[340px]" />
                    <col className="w-[300px]" />
                    <col className="w-[240px]" />
                    <col className="w-[125px]" />
                    <col className="w-[125px]" />
                    <col className="w-[145px]" />
                    <col className="w-[135px]" />
                    <col className="w-[125px]" />
                    <col className="w-[105px]" />
                    <col className="w-[115px]" />
                    <col className="w-[135px]" />
                    <col className="w-[190px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th
                        rowSpan={2}
                        className="border-b border-r border-border/40 px-3 py-3 text-left font-medium"
                      >
                        Player
                      </th>
                      <th
                        rowSpan={2}
                        className="border-b border-border/40 px-3 py-3 text-left font-medium"
                      >
                        Week
                      </th>
                      <th
                        rowSpan={2}
                        className="border-b border-border/40 px-3 py-3 text-left font-medium"
                      >
                        Sources
                      </th>
                      <th
                        rowSpan={2}
                        className="border-b border-border/40 px-3 py-3 text-left font-medium"
                      >
                        Base Inputs
                      </th>
                      <th
                        rowSpan={2}
                        className="border-b border-border/40 px-3 py-3 text-left font-medium"
                      >
                        Role Inputs
                      </th>
                      <th
                        rowSpan={2}
                        className="border-b border-border/40 px-3 py-3 text-left font-medium"
                      >
                        Daily AI
                      </th>
                      <th
                        colSpan={4}
                        className="border-b border-l border-border/40 px-3 py-2 text-center font-medium"
                      >
                        Model Scores
                      </th>
                      <th
                        colSpan={4}
                        className="border-b border-l border-border/40 px-3 py-2 text-center font-medium"
                      >
                        Final Response
                      </th>
                      <th
                        rowSpan={2}
                        className="border-b border-l border-border/40 px-3 py-3 text-left font-medium"
                      >
                        State
                      </th>
                    </tr>
                    <tr className="bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="border-b border-l border-border/40 px-3 py-2 text-right font-medium leading-tight">
                        Match
                      </th>
                      <th className="border-b border-border/40 px-3 py-2 text-right font-medium leading-tight">
                        Coach
                      </th>
                      <th className="border-b border-border/40 px-3 py-2 text-right font-medium leading-tight">
                        Attendance
                      </th>
                      <th className="border-b border-border/40 px-3 py-2 text-right font-medium leading-tight">
                        Weekly AI
                      </th>
                      <th className="border-b border-l border-border/40 px-3 py-2 text-right font-medium leading-tight">
                        Weekly
                      </th>
                      <th className="border-b border-border/40 px-3 py-2 text-center font-medium leading-tight">
                        Grade
                      </th>
                      <th className="border-b border-border/40 px-3 py-2 text-center font-medium leading-tight">
                        Rank
                      </th>
                      <th className="border-b border-border/40 px-3 py-2 text-right font-medium leading-tight">
                        Predicted
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => {
                      const baseItems = baseFields.map((field) => [
                        field.label,
                        row[field.key],
                      ]) as Array<[string, unknown]>;
                      const sourceItems: Array<[string, unknown]> = [
                        ["Match", row.match_evaluation_count],
                        ["Training", row.training_evaluation_count],
                        ["Daily AI", row.daily_ai_input_count],
                      ];
                      const dailyItems: Array<[string, unknown]> = [
                        ["Sleep", row.sleep_hours],
                        ["Trained", row.trained_today],
                        ["Meals", row.meals_count],
                        ["AI Score", row.daily_ai_score],
                      ];
                      const stateBadges = [
                        {
                          label: hasBaseInputs(row)
                            ? "base ready"
                            : "base partial",
                          ready: hasBaseInputs(row),
                        },
                        {
                          label: hasRoleInputs(row)
                            ? "role ready"
                            : "role partial",
                          ready: hasRoleInputs(row),
                        },
                        {
                          label: hasDailyInputs(row)
                            ? "daily ready"
                            : "daily missing",
                          ready: hasDailyInputs(row),
                        },
                        {
                          label:
                            row.prediction_status === "ready"
                              ? "model ready"
                              : "model unavailable",
                          ready: row.prediction_status === "ready",
                        },
                      ];

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "align-top",
                            rowIndex % 2 === 1 && "bg-muted/[0.035]",
                          )}
                        >
                          <td className="border-b border-r border-border/30 px-3 py-3">
                            <div className="truncate font-medium">
                              {row.player_name || "Player"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {row.position && (
                                <Badge variant="secondary">
                                  {row.position}
                                </Badge>
                              )}
                              <Badge variant="outline">
                                {roleLabels[row.role_family]}
                              </Badge>
                            </div>
                          </td>
                          <td className="border-b border-border/30 px-3 py-3 text-muted-foreground">
                            <div className="font-medium text-foreground">
                              {formatDate(row.week_start)}
                            </div>
                            <div className="mt-1 text-xs">
                              to {formatDate(row.week_end)}
                            </div>
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            <MetricStack items={sourceItems} toneMode="count" />
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            {hasAnyBaseInput(row) ? (
                              <MetricStack
                                items={baseItems}
                                columns={2}
                                emptyText="No input"
                              />
                            ) : (
                              <span className="block text-xs text-muted-foreground">
                                No base input yet
                              </span>
                            )}
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            {row.match_evaluation_count > 0 &&
                            roleValues(row).length ? (
                              <MetricStack
                                items={displayInputValues(roleValues(row))}
                                columns={2}
                                emptyText="No input"
                              />
                            ) : (
                              <span className="block text-xs text-muted-foreground">
                                No match input yet
                              </span>
                            )}
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            {hasDailyInputs(row) ? (
                              <MetricStack items={dailyItems} columns={2} />
                            ) : (
                              <span className="block text-xs text-muted-foreground">
                                No daily input yet
                              </span>
                            )}
                          </td>
                          <td className="border-b border-l border-border/30 px-3 py-3">
                            <ScoreValue value={row.match_score} />
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            <ScoreValue value={row.coach_score} />
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            <ScoreValue value={row.attendance_score} />
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            <ScoreValue value={row.weekly_ai_score} />
                          </td>
                          <td className="border-b border-l border-border/30 px-3 py-3">
                            <ScoreValue value={row.weekly_score} />
                          </td>
                          <td className="border-b border-border/30 px-3 py-3 text-center">
                            <GradeBadge grade={row.grade} />
                          </td>
                          <td className="border-b border-border/30 px-3 py-3 text-center">
                            <div className="font-mono text-sm font-semibold tabular-nums">
                              #{row.rank}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {row.trend}
                            </div>
                          </td>
                          <td className="border-b border-border/30 px-3 py-3">
                            <ScoreValue value={row.predicted_next_score} />
                            {row.model_error && (
                              <p className="mt-1 text-xs text-destructive">
                                {row.model_error}
                              </p>
                            )}
                          </td>
                          <td className="border-b border-l border-border/30 px-3 py-3">
                            <div className="flex flex-col items-start gap-1.5">
                              {stateBadges.map((state) => (
                                <Badge
                                  key={state.label}
                                  variant={state.ready ? "success" : "warning"}
                                >
                                  {state.label}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length && (
                      <tr>
                        <td
                          colSpan={15}
                          className="px-3 py-10 text-center text-muted-foreground"
                        >
                          No weekly ranking inputs are available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
