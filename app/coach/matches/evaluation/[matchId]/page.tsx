"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, Loader2, LockKeyhole, Save, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useGetCoachMatchQuery,
  useRequestMatchEvaluationEditMutation,
  useUpsertMatchStatsMutation,
} from "@/lib/store/api/calendarApi";
import type {
  MatchEvaluationCandidate,
  MatchPlayerStats,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type DashboardLanguage = "en" | "ar";

type RatingOption = {
  label: "Poor" | "Good" | "Very Good" | "Excellent";
  range: string;
  value: number;
  min: number;
  max: number;
};

type OptionField = {
  key: string;
  label: string;
  options: RatingOption[];
};

type EvaluationPlayer = MatchEvaluationCandidate & {
  effective_position?: string | null;
};

const rating10Options: RatingOption[] = [
  { label: "Poor", range: "0-3.9", value: 1.95, min: 0, max: 3.9 },
  { label: "Good", range: "4-6.4", value: 5.2, min: 4, max: 6.4 },
  { label: "Very Good", range: "6.5-8.4", value: 7.45, min: 6.5, max: 8.4 },
  { label: "Excellent", range: "8.5-10", value: 9.25, min: 8.5, max: 10 },
];

const percentageOptions: RatingOption[] = [
  { label: "Poor", range: "0-49", value: 24.5, min: 0, max: 49 },
  { label: "Good", range: "50-69", value: 59.5, min: 50, max: 69 },
  { label: "Very Good", range: "70-84", value: 77, min: 70, max: 84 },
  { label: "Excellent", range: "85-100", value: 92.5, min: 85, max: 100 },
];

const chanceOptions: RatingOption[] = [
  { label: "Poor", range: "0", value: 0, min: 0, max: 0 },
  { label: "Good", range: "1", value: 1, min: 1, max: 1 },
  { label: "Very Good", range: "2", value: 2, min: 2, max: 2 },
  { label: "Excellent", range: "3+", value: 4, min: 3, max: 100 },
];

const defensiveCountOptions: RatingOption[] = [
  { label: "Poor", range: "0-1", value: 1, min: 0, max: 1 },
  { label: "Good", range: "2-3", value: 3, min: 2, max: 3 },
  { label: "Very Good", range: "4-5", value: 5, min: 4, max: 5 },
  { label: "Excellent", range: "6+", value: 7, min: 6, max: 100 },
];

const duelsOptions: RatingOption[] = [
  { label: "Poor", range: "0-39", value: 25, min: 0, max: 39 },
  { label: "Good", range: "40-59", value: 50, min: 40, max: 59 },
  { label: "Very Good", range: "60-79", value: 70, min: 60, max: 79 },
  { label: "Excellent", range: "80-100", value: 90, min: 80, max: 100 },
];

const possessionLossOptions: RatingOption[] = [
  { label: "Poor", range: "11+", value: 12, min: 11, max: 100 },
  { label: "Good", range: "7-10", value: 8, min: 7, max: 10 },
  { label: "Very Good", range: "4-6", value: 5, min: 4, max: 6 },
  { label: "Excellent", range: "0-3", value: 2, min: 0, max: 3 },
];

const optionFields: OptionField[] = [
  { key: "passAccuracyPercentage", label: "Pass Accuracy %", options: percentageOptions },
  { key: "keyPasses", label: "Key Passes", options: chanceOptions },
  { key: "shotsOnTarget", label: "Shots on Target", options: chanceOptions },
  { key: "defensiveTackles", label: "Defensive Tackles", options: defensiveCountOptions },
  { key: "interceptions", label: "Interceptions", options: defensiveCountOptions },
  { key: "duelsWon", label: "Duels", options: duelsOptions },
  { key: "possessionLosses", label: "Possession Losses", options: possessionLossOptions },
  { key: "technicalRating", label: "Technical /10", options: rating10Options },
  { key: "tacticalRating", label: "Tactical /10", options: rating10Options },
  { key: "physicalRating", label: "Physical /10", options: rating10Options },
  { key: "fatigueRating", label: "Fatigue /10", options: rating10Options },
  { key: "mentalityRating", label: "Mentality /10", options: rating10Options },
  { key: "decisionMakingRating", label: "Decision Making /10", options: rating10Options },
  { key: "workRateRating", label: "Work Rate /10", options: rating10Options },
  { key: "positioningRating", label: "Positioning /10", options: rating10Options },
];

const goalkeeperOptionFields: OptionField[] = [
  { key: "saves", label: "Saves", options: defensiveCountOptions },
  { key: "passAccuracyPercentage", label: "Distribution Accuracy %", options: percentageOptions },
  { key: "keyPasses", label: "Fast Restarts", options: chanceOptions },
  { key: "defensiveTackles", label: "Crosses Claimed", options: defensiveCountOptions },
  { key: "interceptions", label: "Sweeper Actions", options: defensiveCountOptions },
  { key: "duelsWon", label: "1v1 / Aerial Duels", options: duelsOptions },
  { key: "possessionLosses", label: "Handling Errors", options: possessionLossOptions },
  { key: "technicalRating", label: "Shot Stopping /10", options: rating10Options },
  { key: "tacticalRating", label: "Positioning /10", options: rating10Options },
  { key: "physicalRating", label: "Diving & Agility /10", options: rating10Options },
  { key: "fatigueRating", label: "Fatigue /10", options: rating10Options },
  { key: "mentalityRating", label: "Concentration /10", options: rating10Options },
  { key: "decisionMakingRating", label: "Decision Making /10", options: rating10Options },
  { key: "workRateRating", label: "Communication / Command /10", options: rating10Options },
  { key: "positioningRating", label: "Set Position /10", options: rating10Options },
];

const textFields = [
  ["strengths", "Strengths"],
  ["weaknesses", "Weaknesses"],
  ["improvementPlan", "Improvement Plan"],
  ["coachNotes", "Coach Notes"],
] as const;

const evaluationCopy = {
  en: {
    title: "Match Evaluations",
    description: "Post-match player ratings and performance details.",
    breadcrumbs: {
      home: "Home",
      matches: "Matches",
      evaluation: "Evaluation",
    },
    loading: "Loading match...",
    saveError: "Could not save match evaluations.",
    publishError: "Could not publish match evaluations.",
    requestError: "Could not send evaluation edit request.",
    publishedNotice: "Match evaluations are published and visible to players.",
    draftNotice:
      "Match evaluations are saved as a draft. Publish when you want players to see them.",
    requestPendingNotice: "Edit request sent. Waiting for admin approval.",
    editWindowOpen: (value: string) => `Evaluations are open until ${value}.`,
    noAttendanceNotice:
      "No match attendance was saved, so the evaluation is showing the available match squad or target players.",
    finishMatchNotice: "Finish the match before saving final evaluations.",
    emptyPlayers:
      "No squad, target players, or attended players are available for this match evaluation.",
    overallScore: "Overall /10",
    selectRating: "Select rating",
    noPosition: "No position",
    minutes: "min",
    goals: "Goals",
    assists: "Assists",
    requestPending: "Request Pending",
    requestEditAccess: "Request Edit Access",
    save: "Save",
    publish: "Publish",
    ratingLabels: {
      Poor: "Poor",
      Good: "Good",
      "Very Good": "Very Good",
      Excellent: "Excellent",
    },
    matchStatus: {
      finished: "finished",
      completed: "completed",
      scheduled: "scheduled",
      cancelled: "cancelled",
      active: "active",
      live: "live",
    },
    evaluationStatus: {
      locked: "locked",
      reopened: "reopened",
      editable: "editable",
    },
    standardFields: {
      passAccuracyPercentage: "Pass Accuracy %",
      keyPasses: "Key Passes",
      shotsOnTarget: "Shots on Target",
      defensiveTackles: "Defensive Tackles",
      interceptions: "Interceptions",
      duelsWon: "Duels",
      possessionLosses: "Possession Losses",
      technicalRating: "Technical /10",
      tacticalRating: "Tactical /10",
      physicalRating: "Physical /10",
      fatigueRating: "Fatigue /10",
      mentalityRating: "Mentality /10",
      decisionMakingRating: "Decision Making /10",
      workRateRating: "Work Rate /10",
      positioningRating: "Positioning /10",
    },
    goalkeeperFields: {
      saves: "Saves",
      passAccuracyPercentage: "Distribution Accuracy %",
      keyPasses: "Fast Restarts",
      defensiveTackles: "Crosses Claimed",
      interceptions: "Sweeper Actions",
      duelsWon: "1v1 / Aerial Duels",
      possessionLosses: "Handling Errors",
      technicalRating: "Shot Stopping /10",
      tacticalRating: "Positioning /10",
      physicalRating: "Diving & Agility /10",
      fatigueRating: "Fatigue /10",
      mentalityRating: "Concentration /10",
      decisionMakingRating: "Decision Making /10",
      workRateRating: "Communication / Command /10",
      positioningRating: "Set Position /10",
    },
    textFields: {
      strengths: "Strengths",
      weaknesses: "Weaknesses",
      improvementPlan: "Improvement Plan",
      coachNotes: "Coach Notes",
    },
  },
  ar: {
    title: "تقييمات المباراة",
    description: "درجات اللاعبين وتفاصيل الأداء بعد المباراة.",
    breadcrumbs: {
      home: "الرئيسية",
      matches: "المباريات",
      evaluation: "التقييم",
    },
    loading: "جاري تحميل المباراة...",
    saveError: "تعذر حفظ تقييمات المباراة.",
    publishError: "تعذر نشر تقييمات المباراة.",
    requestError: "تعذر إرسال طلب فتح التعديل.",
    publishedNotice: "تم نشر تقييمات المباراة وهي ظاهرة للاعبين.",
    draftNotice: "تم حفظ تقييمات المباراة كمسودة. انشرها عندما تريد إظهارها للاعبين.",
    requestPendingNotice: "تم إرسال طلب التعديل. بانتظار موافقة الإدارة.",
    editWindowOpen: (value: string) => `التقييمات مفتوحة حتى ${value}.`,
    noAttendanceNotice:
      "لم يتم حفظ حضور المباراة، لذلك يعرض التقييم قائمة المباراة أو اللاعبين المستهدفين المتاحين.",
    finishMatchNotice: "أنهِ المباراة قبل حفظ التقييمات النهائية.",
    emptyPlayers:
      "لا يوجد لاعبو قائمة أو لاعبون مستهدفون أو حاضرون متاحون لهذا التقييم.",
    overallScore: "التقييم العام /10",
    selectRating: "اختر التقييم",
    noPosition: "بدون مركز",
    minutes: "دقيقة",
    goals: "أهداف",
    assists: "تمريرات حاسمة",
    requestPending: "الطلب قيد المراجعة",
    requestEditAccess: "طلب فتح التعديل",
    save: "حفظ",
    publish: "نشر",
    ratingLabels: {
      Poor: "ضعيف",
      Good: "جيد",
      "Very Good": "جيد جدًا",
      Excellent: "ممتاز",
    },
    matchStatus: {
      finished: "منتهية",
      completed: "مكتملة",
      scheduled: "مجدولة",
      cancelled: "ملغاة",
      active: "نشطة",
      live: "مباشرة",
    },
    evaluationStatus: {
      locked: "مقفلة",
      reopened: "مفتوحة مجددًا",
      editable: "قابلة للتعديل",
    },
    standardFields: {
      passAccuracyPercentage: "دقة التمرير %",
      keyPasses: "تمريرات مفتاحية",
      shotsOnTarget: "تسديدات على المرمى",
      defensiveTackles: "افتكاكات دفاعية",
      interceptions: "اعتراضات",
      duelsWon: "التحامات",
      possessionLosses: "فقدان الاستحواذ",
      technicalRating: "فني /10",
      tacticalRating: "تكتيكي /10",
      physicalRating: "بدني /10",
      fatigueRating: "الإجهاد /10",
      mentalityRating: "ذهني /10",
      decisionMakingRating: "اتخاذ القرار /10",
      workRateRating: "معدل العمل /10",
      positioningRating: "التمركز /10",
    },
    goalkeeperFields: {
      saves: "تصديات",
      passAccuracyPercentage: "دقة التوزيع %",
      keyPasses: "بدايات سريعة",
      defensiveTackles: "التعامل مع العرضيات",
      interceptions: "خروج كحارس حر",
      duelsWon: "التحامات فردية وهوائية",
      possessionLosses: "أخطاء الإمساك",
      technicalRating: "إيقاف التسديدات /10",
      tacticalRating: "التمركز /10",
      physicalRating: "المرونة والرشاقة /10",
      fatigueRating: "الإجهاد /10",
      mentalityRating: "التركيز /10",
      decisionMakingRating: "اتخاذ القرار /10",
      workRateRating: "التواصل والقيادة /10",
      positioningRating: "وضعية الاستعداد /10",
    },
    textFields: {
      strengths: "نقاط القوة",
      weaknesses: "نقاط الضعف",
      improvementPlan: "خطة التحسين",
      coachNotes: "ملاحظات المدرب",
    },
  },
} as const;

type EvaluationCopy = (typeof evaluationCopy)[DashboardLanguage];

const localizedRecordValue = (
  labels: Record<string, string>,
  value?: string | null,
) => labels[String(value ?? "").toLowerCase()] ?? String(value ?? "");

const optionDisplayLabel = (
  field: OptionField,
  copy: EvaluationCopy,
  isGoalkeeper: boolean,
) => {
  const labels = (isGoalkeeper
    ? copy.goalkeeperFields
    : copy.standardFields) as Record<string, string>;
  return labels[field.key] ?? field.label;
};

const camelToSnake = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toNumber = (value: string) =>
  value === "" || Number.isNaN(Number(value)) ? undefined : Number(value);

const clampRatingInput = (value: string) => {
  if (value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return String(Math.max(0, Math.min(10, numeric)));
};

const isGoalkeeperPosition = (position?: string | null) => {
  const normalized = String(position ?? "").trim().toLowerCase();
  return normalized === "gk" || normalized.includes("goalkeeper");
};

const rawStatValue = (
  stat: MatchPlayerStats | undefined,
  key: string,
  drafts: Record<string, string>,
) => {
  if (drafts[key] !== undefined) return drafts[key];
  const snake = camelToSnake(key);
  const value = (stat as unknown as Record<string, string | number | null>)?.[
    snake
  ];
  return value === null || value === undefined ? "" : String(value);
};

const optionValue = (value: string, field: OptionField) => {
  if (value === "") return "";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "";
  const exact = field.options.find((option) => option.value === numeric);
  if (exact) return String(exact.value);
  const ranged = field.options.find(
    (option) => numeric >= option.min && numeric <= option.max,
  );
  return ranged ? String(ranged.value) : "";
};

const optionStatValue = (
  stat: MatchPlayerStats | undefined,
  field: OptionField,
  drafts: Record<string, string>,
) => {
  if (drafts[field.key] !== undefined) return drafts[field.key];
  return optionValue(rawStatValue(stat, field.key, drafts), field);
};

export default function MatchEvaluationPage() {
  const language = useDashboardLanguage();
  const t = evaluationCopy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const { data: match, isLoading } = useGetCoachMatchQuery(matchId);
  const [saveStats, { isLoading: saving }] = useUpsertMatchStatsMutation();
  const [requestEdit, { isLoading: requestingEdit }] =
    useRequestMatchEvaluationEditMutation();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [pageError, setPageError] = useState("");
  const [lockedAfterSave, setLockedAfterSave] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const allOptionFields = useMemo(
    () =>
      [...optionFields, ...goalkeeperOptionFields].filter(
        (field, index, fields) =>
          fields.findIndex((candidate) => candidate.key === field.key) === index,
      ),
    [],
  );

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const statsByPlayer = useMemo(
    () => new Map((match?.stats ?? []).map((stat) => [stat.player_id, stat])),
    [match?.stats],
  );
  const evaluationPlayers = useMemo<EvaluationPlayer[]>(() => {
    const candidates: MatchEvaluationCandidate[] =
      match?.squad?.length
        ? match.squad
        : (match?.evaluation_candidates ?? []);
    const hasAttendanceRecords = Boolean(match?.attendance?.length);
    const attendance = new Map(
      (match?.attendance ?? []).map((record) => [record.player_id, record]),
    );

    const visibleCandidates = !hasAttendanceRecords
      ? candidates
      : candidates.filter((player) => {
          const status = attendance.get(player.player_id)?.status;
          const stats = statsByPlayer.get(player.player_id);
          return (
            ["present", "late"].includes(status ?? "") ||
            Number(stats?.minutes_played || 0) > 0
          );
        });

    if (!match?.squad?.length) return visibleCandidates;

    const squadByPlayer = new Map(
      match.squad.map((player) => [player.player_id, player]),
    );
    const activePositionByPlayer = new Map<string, string | null>();
    match.squad.forEach((player) => {
      activePositionByPlayer.set(
        player.player_id,
        player.squad_role === "starter" ? player.position ?? null : null,
      );
    });

    [...(match.substitutions ?? [])]
      .sort(
        (a, b) =>
          Number(a.minute || 0) - Number(b.minute || 0) ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .forEach((substitution) => {
        const outPlayer = squadByPlayer.get(substitution.out_player_id);
        const inheritedPosition =
          activePositionByPlayer.get(substitution.out_player_id) ??
          (outPlayer?.squad_role === "starter" ? outPlayer.position ?? null : null);
        activePositionByPlayer.delete(substitution.out_player_id);
        activePositionByPlayer.set(substitution.in_player_id, inheritedPosition);
      });

    return visibleCandidates.map((player) => {
      const squadPlayer = squadByPlayer.get(player.player_id);
      return {
        ...player,
        effective_position:
          activePositionByPlayer.get(player.player_id) ??
          (squadPlayer?.squad_role === "starter" ? squadPlayer.position ?? null : null),
      };
    });
  }, [match, statsByPlayer]);

  const matchFinished = Boolean(
    match &&
      (match.match_status === "finished" ||
        match.status === "completed" ||
        match.status === "finished"),
  );
  const editRequest = match?.evaluation_edit_request;
  const editWindowActive = Boolean(
    match?.evaluation_edit_unlocked_until &&
      (!nowMs ||
        new Date(match.evaluation_edit_unlocked_until).getTime() > nowMs),
  );
  const evaluationsLocked = Boolean(
    lockedAfterSave || (match?.evaluations_finalized_at && !editWindowActive),
  );

  const updateDraft = (playerId: string, key: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [key]: value },
    }));
    setSavedDraft(false);
  };

  const buildEvaluationRecords = () =>
    evaluationPlayers.map((player) => {
      const stat = statsByPlayer.get(player.player_id);
      const draft = drafts[player.player_id] ?? {};
      const isGoalkeeper = isGoalkeeperPosition(player.effective_position);
      const payloadOptionFields = isGoalkeeper
        ? allOptionFields
        : allOptionFields.filter((field) => field.key !== "saves");
      return {
        playerId: player.player_id,
        minutesPlayed: stat?.minutes_played ?? 0,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        tackles: stat?.tackles ?? 0,
        yellowCards: stat?.yellow_cards ?? 0,
        redCards: stat?.red_cards ?? 0,
        passesCompleted: stat?.passes_completed ?? 0,
        shotsTotal: stat?.shots_total ?? 0,
        duelsLost: stat?.duels_lost ?? 0,
        saves: isGoalkeeper ? (stat?.saves ?? 0) : 0,
        performanceRating: toNumber(
          clampRatingInput(rawStatValue(stat, "performanceRating", draft)),
        ),
        ...Object.fromEntries(
          payloadOptionFields.map((field) => [
            field.key,
            toNumber(optionStatValue(stat, field, draft)),
          ]),
        ),
        ...Object.fromEntries(
          textFields.map(([key]) => [
            key,
            draft[key] ?? rawStatValue(stat, key, draft),
          ]),
        ),
      };
    });

  const handleSaveDraft = async () => {
    if (!match || evaluationsLocked || !matchFinished) return;
    setPageError("");
    try {
      await saveStats({
        matchId,
        finalize: false,
        records: buildEvaluationRecords(),
      }).unwrap();
      setSavedDraft(true);
      setDrafts({});
    } catch {
      setPageError(t.saveError);
    }
  };

  const handlePublish = async () => {
    if (!match || evaluationsLocked || !matchFinished) return;
    setPageError("");
    try {
      await saveStats({
        matchId,
        finalize: true,
        records: buildEvaluationRecords(),
      }).unwrap();
      setLockedAfterSave(true);
      setSavedDraft(false);
      setDrafts({});
    } catch {
      setPageError(t.publishError);
    }
  };

  const handleRequestEdit = async () => {
    if (!match || requestingEdit) return;
    setPageError("");
    try {
      await requestEdit({ matchId }).unwrap();
    } catch {
      setPageError(t.requestError);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: "/coach/home" },
          { label: t.breadcrumbs.matches, href: "/coach/matches" },
          { label: t.breadcrumbs.evaluation },
        ]}
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </div>
      )}

      {match && (
        <>
          <Card className="border-border/50 bg-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {new Date(match.match_date).toLocaleDateString(locale, {
                    dateStyle: "medium",
                  })}
                </p>
                <h2 className="text-xl font-semibold">
                  GOALIX {match.our_score ?? 0} - {match.opponent_score ?? 0}{" "}
                  {match.opponent_name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={match.match_status === "finished" ? "success" : "warning"}
                >
                  {localizedRecordValue(t.matchStatus, match.match_status)}
                </Badge>
                <Badge
                  variant={
                    evaluationsLocked
                      ? "success"
                      : editWindowActive
                        ? "warning"
                        : "secondary"
                  }
                >
                  {evaluationsLocked
                    ? t.evaluationStatus.locked
                    : editWindowActive
                      ? t.evaluationStatus.reopened
                      : t.evaluationStatus.editable}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {pageError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {pageError}
            </p>
          )}

          {evaluationsLocked && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {t.publishedNotice}
            </div>
          )}

          {savedDraft && !evaluationsLocked && (
            <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
              <CheckCircle2 className="h-4 w-4" />
              {t.draftNotice}
            </div>
          )}

          {editRequest?.status === "pending" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <Clock className="h-4 w-4" />
              {t.requestPendingNotice}
            </div>
          )}

          {editWindowActive && match.evaluation_edit_unlocked_until && (
            <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
              <Clock className="h-4 w-4" />
              {t.editWindowOpen(
                new Date(match.evaluation_edit_unlocked_until).toLocaleString(
                  locale,
                ),
              )}
            </div>
          )}

          {matchFinished && !match.attendance?.length && evaluationPlayers.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {t.noAttendanceNotice}
            </div>
          )}

          {!matchFinished && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <LockKeyhole className="h-4 w-4" />
              {t.finishMatchNotice}
            </div>
          )}

          <div className="space-y-4">
            {evaluationPlayers.map((player) => {
              const stat = statsByPlayer.get(player.player_id);
              const draft = drafts[player.player_id] ?? {};
              const isGoalkeeper = isGoalkeeperPosition(player.effective_position);
              const playerPosition = player.effective_position ?? t.noPosition;
              const activeOptionFields = isGoalkeeper
                ? goalkeeperOptionFields
                : optionFields;

              return (
                <Card
                  key={player.player_id}
                  className="border-border/50 bg-card"
                >
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                      <span className="flex flex-wrap items-center gap-2">
                        {player.player_name}
                        <Badge variant="outline">{playerPosition}</Badge>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {stat?.minutes_played ?? 0} {t.minutes}
                        </Badge>
                        <Badge variant="secondary">
                          {t.goals} {stat?.goals ?? 0} | {t.assists}{" "}
                          {stat?.assists ?? 0}
                        </Badge>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                      <div className="space-y-1">
                        <Label>{t.overallScore}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          disabled={evaluationsLocked}
                          value={rawStatValue(stat, "performanceRating", draft)}
                          onChange={(event) =>
                            updateDraft(
                              player.player_id,
                              "performanceRating",
                              clampRatingInput(event.target.value),
                            )
                          }
                        />
                      </div>
                      {activeOptionFields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label>
                            {optionDisplayLabel(field, t, isGoalkeeper)}
                          </Label>
                          <Select
                            disabled={evaluationsLocked}
                            value={optionStatValue(stat, field, draft)}
                            onValueChange={(value) =>
                              updateDraft(player.player_id, field.key, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t.selectRating} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((option) => (
                                <SelectItem
                                  key={`${field.key}-${option.label}`}
                                  value={String(option.value)}
                                >
                                  {t.ratingLabels[option.label]} ({option.range})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {textFields.map(([key]) => (
                        <div key={key} className="space-y-1">
                          <Label>{t.textFields[key]}</Label>
                          <Textarea
                            disabled={evaluationsLocked}
                            value={rawStatValue(stat, key, draft)}
                            onChange={(event) =>
                              updateDraft(
                                player.player_id,
                                key,
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!evaluationPlayers.length && (
            <Card className="border-border/50 bg-card">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t.emptyPlayers}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            {evaluationsLocked ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={
                  requestingEdit ||
                  editRequest?.status === "pending" ||
                  !match.evaluations_finalized_at
                }
                onClick={handleRequestEdit}
              >
                {requestingEdit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editRequest?.status === "pending" ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {editRequest?.status === "pending"
                  ? t.requestPending
                  : t.requestEditAccess}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={saving || !evaluationPlayers.length || !matchFinished}
                  onClick={handleSaveDraft}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t.save}
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={saving || !evaluationPlayers.length || !matchFinished}
                  onClick={handlePublish}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t.publish}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
