"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Loader2,
  Save,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  injuryRiskPositionGroups,
  type InjuryRiskPositionGroup,
} from "@/lib/football/injury-risk-position-groups";
import {
  type InjuryRiskPrediction,
  type InjuryRiskPainDiscomfortRecord,
  useGetInjuryRiskPredictionsQuery,
  useGetInjuryRiskPainDiscomfortQuery,
  useRunInjuryRiskPredictionsMutation,
  useUpsertInjuryRiskPainDiscomfortMutation,
} from "@/lib/store/api/calendarApi";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { cn } from "@/lib/utils";

type DashboardLanguage = "en" | "ar";
type LocalizedString = Record<DashboardLanguage, string>;

const localized = (value: LocalizedString, language: DashboardLanguage) =>
  value[language] ?? value.en;

const modelInputs = [
  {
    label: { en: "Age", ar: "العمر" },
    detail: { en: "Player age in years.", ar: "عمر اللاعب بالسنوات." },
  },
  {
    label: { en: "Position", ar: "المركز" },
    detail: {
      en: "Derived from Football information / Main Position.",
      ar: "مشتق من معلومات كرة القدم أو المركز الأساسي.",
    },
  },
  {
    label: { en: "Attendance Rate", ar: "معدل الحضور" },
    detail: {
      en: "Monthly attendance percentage from training sessions and matches.",
      ar: "نسبة الحضور الشهرية من التدريبات والمباريات.",
    },
  },
  {
    label: { en: "Training Sessions / Week", ar: "حصص التدريب هذا الأسبوع" },
    detail: {
      en: "Attended training sessions in the current week.",
      ar: "عدد حصص التدريب التي حضرها اللاعب خلال الأسبوع الحالي.",
    },
  },
  {
    label: { en: "Match Minutes Last Week", ar: "دقائق آخر أسبوع" },
    detail: {
      en: "Total played match minutes from the last 7 days.",
      ar: "إجمالي دقائق اللعب خلال آخر 7 أيام.",
    },
  },
  {
    label: { en: "Fatigue Rating", ar: "تقييم الإجهاد" },
    detail: {
      en: "Fatigue from the latest played match or attended training.",
      ar: "تقييم الإجهاد من آخر مباراة لعبها أو آخر تدريب حضره.",
    },
  },
  {
    label: { en: "Previous Injury", ar: "إصابة سابقة" },
    detail: {
      en: "Match injuries plus training injury marks from the last three months.",
      ar: "إصابات المباريات والتدريبات خلال آخر ثلاثة أشهر.",
    },
  },
  {
    label: { en: "Pain or Discomfort", ar: "ألم أو عدم راحة" },
    detail: {
      en: "Weekly coach-entered binary flag (0 or 1).",
      ar: "قيمة أسبوعية يدخلها المدرب بنظام 0 أو 1.",
    },
  },
];

const positionGroupLabels: Record<InjuryRiskPositionGroup, LocalizedString> = {
  Defender: { en: "Defender", ar: "مدافعون" },
  Midfielder: { en: "Midfielder", ar: "لاعبو الوسط" },
  Forward: { en: "Forward", ar: "مهاجمون" },
};

const positionDescriptions: Record<InjuryRiskPositionGroup, LocalizedString> = {
  Defender: {
    en: "Defensive line and goalkeeper positions.",
    ar: "مراكز خط الدفاع وحارس المرمى.",
  },
  Midfielder: {
    en: "Central, defensive, and wide midfield roles.",
    ar: "أدوار الوسط المركزي والدفاعي والطرفي.",
  },
  Forward: {
    en: "Striker, center forward, and winger roles.",
    ar: "أدوار المهاجم الصريح ورأس الحربة والأجنحة.",
  },
};

const sourceRules = [
  {
    input: { en: "Attendance Rate", ar: "معدل الحضور" },
    source: {
      en: "Use injury_risk_monthly_attendance for the current month. It combines attended training sessions and matches divided by total targeted training sessions and squad/attendance matches.",
      ar: "يستخدم جدول الحضور الشهري للشهر الحالي، ويجمع حضور التدريبات والمباريات مقسوما على إجمالي الحصص والمباريات المستهدفة.",
    },
  },
  {
    input: { en: "Training Sessions / Week", ar: "حصص التدريب هذا الأسبوع" },
    source: {
      en: "Count current-week event_attendance rows marked present or late for training events.",
      ar: "يحسب سجلات حضور الأسبوع الحالي التي حالتها حاضر أو متأخر داخل أحداث التدريب.",
    },
  },
  {
    input: { en: "Match Minutes Last Week", ar: "دقائق آخر أسبوع" },
    source: {
      en: "Sum match_player_stats.minutes_played from finished matches in the rolling last 7 days.",
      ar: "يجمع دقائق اللعب من المباريات المكتملة خلال آخر 7 أيام.",
    },
  },
  {
    input: { en: "Fatigue Rating", ar: "تقييم الإجهاد" },
    source: {
      en: "Use the fatigue rating from the latest activity the player actually did: a played match with minutes above 0 or an attended training session.",
      ar: "يستخدم تقييم الإجهاد من آخر نشاط فعلي للاعب: مباراة شارك فيها بدقائق أكبر من صفر أو تدريب حضره.",
    },
  },
  {
    input: { en: "Previous Injury", ar: "إصابة سابقة" },
    source: {
      en: "Count match_player_incidents where incident_type is injury plus event_attendance rows marked injured, only inside the last three months.",
      ar: "يحسب إصابات المباريات وسجلات حضور التدريب المسجلة كإصابة خلال آخر ثلاثة أشهر فقط.",
    },
  },
  {
    input: { en: "Pain or Discomfort", ar: "ألم أو عدم راحة" },
    source: {
      en: "Use the current-week coach submission from injury_risk_weekly_pain_discomfort. Missing values are treated as 0 in the model input view.",
      ar: "يستخدم إدخال المدرب للأسبوع الحالي من جدول الألم أو عدم الراحة. القيم غير الموجودة تعامل كصفر في عرض مدخلات النموذج.",
    },
  },
];

const pageCopy = {
  en: {
    title: "Injury Risk AI",
    description: "Model input readiness for player injury risk classification.",
    home: "Home",
    modelInputs: "Model Inputs",
    modelInputsDescription: "These are the fields the future model will classify from.",
    currentScope: "Current Scope",
    currentScopeDescription: "Local model is connected.",
    savedPerPlayer: "Predictions are saved per player ID.",
    normalizedPosition: "Position is normalized into three model categories.",
    weeklyPain: "Weekly Pain or Discomfort",
    currentWeek: "Current week",
    saved: "Saved",
    refresh: "Refresh",
    saveAndRun: "Save and run model",
    runModel: "Run model",
    player: "Player",
    position: "Position",
    painOrDiscomfort: "Pain or Discomfort",
    currentValue: "Current Value",
    updated: "Updated",
    notSubmitted: "Not submitted",
    pending: "Pending",
    noPlayers: "No players available.",
    selected: "selected",
    modelOutput: "Model Output",
    refreshingResults: "Refreshing results",
    latestPredictions: "Latest saved predictions",
    predicted: "predicted",
    input: "Input",
    risk: "Risk",
    recommendation: "Recommendation",
    run: "Run",
    error: "Error",
    noOutput: "No model output yet.",
    positionMapping: "Position Mapping",
    positionMappingDescription: "Football information / Main Position is grouped into these buckets for this model input only.",
    modelCategory: "Model Category",
    matchConfigPositions: "Match Configuration Positions",
    notes: "Notes",
    inputSourceRules: "Input Source Rules",
    inputSourceRulesDescription: "These rules prepare the database inputs before any model is connected.",
    preparedSource: "Prepared Source",
    inputAge: "Age",
    inputPosition: "Position",
    inputAttendance: "Attendance",
    inputSessions: "Sessions",
    inputMinutes: "Minutes",
    inputFatigue: "Fatigue",
    inputInjury: "Injury",
    inputPain: "Pain",
  },
  ar: {
    title: "ذكاء مخاطر الإصابة",
    description: "جاهزية مدخلات نموذج اللاعب لتصنيف مخاطر الإصابة.",
    home: "الرئيسية",
    modelInputs: "مدخلات النموذج",
    modelInputsDescription: "هذه هي الحقول التي سيستخدمها النموذج القادم في التصنيف.",
    currentScope: "نطاق النموذج الحالي",
    currentScopeDescription: "النموذج المحلي متصل.",
    savedPerPlayer: "يتم حفظ التوقعات لكل لاعب حسب رقم اللاعب.",
    normalizedPosition: "يتم تبسيط المركز إلى ثلاث فئات يستخدمها النموذج.",
    weeklyPain: "الألم أو عدم الراحة الأسبوعية",
    currentWeek: "الأسبوع الحالي",
    saved: "تم الحفظ",
    refresh: "تحديث",
    saveAndRun: "حفظ وتشغيل النموذج",
    runModel: "تشغيل النموذج",
    player: "اللاعب",
    position: "المركز",
    painOrDiscomfort: "ألم أو عدم راحة",
    currentValue: "القيمة الحالية",
    updated: "تم التحديث",
    notSubmitted: "لم يتم الإرسال",
    pending: "قيد الانتظار",
    noPlayers: "لا يوجد لاعبون متاحون.",
    selected: "محدد",
    modelOutput: "مخرجات النموذج",
    refreshingResults: "جاري تحديث النتائج",
    latestPredictions: "آخر التوقعات المحفوظة",
    predicted: "تم توقعهم",
    input: "المدخلات",
    risk: "المخاطر",
    recommendation: "التوصية",
    run: "التشغيل",
    error: "خطأ",
    noOutput: "لا توجد مخرجات للنموذج حتى الآن.",
    positionMapping: "خريطة المراكز",
    positionMappingDescription: "يتم تجميع المركز الأساسي من معلومات كرة القدم داخل هذه الفئات لهذا النموذج فقط.",
    modelCategory: "فئة النموذج",
    matchConfigPositions: "مراكز إعداد المباراة",
    notes: "ملاحظات",
    inputSourceRules: "قواعد مصادر المدخلات",
    inputSourceRulesDescription: "هذه القواعد تجهز مدخلات قاعدة البيانات قبل ربط أي نموذج.",
    preparedSource: "المصدر المجهز",
    inputAge: "العمر",
    inputPosition: "المركز",
    inputAttendance: "الحضور",
    inputSessions: "الحصص",
    inputMinutes: "الدقائق",
    inputFatigue: "الإجهاد",
    inputInjury: "الإصابة",
    inputPain: "الألم",
  },
} satisfies Record<DashboardLanguage, Record<string, string>>;

const riskLevelLabels: Record<string, LocalizedString> = {
  High: { en: "High", ar: "مرتفع" },
  Medium: { en: "Medium", ar: "متوسط" },
  Low: { en: "Low", ar: "منخفض" },
};

const recommendationLabels: Record<string, LocalizedString> = {
  "Continue normal training": {
    en: "Continue normal training",
    ar: "استمر في التدريب الطبيعي",
  },
  "Monitor player and reduce training load slightly": {
    en: "Monitor player and reduce training load slightly",
    ar: "راقب اللاعب وقلل الحمل التدريبي قليلا",
  },
  "Reduce training load and alert medical staff": {
    en: "Reduce training load and alert medical staff",
    ar: "قلل الحمل التدريبي ونبه الفريق الطبي",
  },
};

const footballPositionLabels: Record<string, LocalizedString> = {
  Defender: { en: "Defender", ar: "مدافع" },
  Midfielder: { en: "Midfielder", ar: "لاعب وسط" },
  Forward: { en: "Forward", ar: "مهاجم" },
  GK: { en: "GK", ar: "حارس" },
  LB: { en: "LB", ar: "ظهير أيسر" },
  CB: { en: "CB", ar: "قلب دفاع" },
  RB: { en: "RB", ar: "ظهير أيمن" },
  CDM: { en: "CDM", ar: "وسط دفاعي" },
  LM: { en: "LM", ar: "وسط أيسر" },
  CM: { en: "CM", ar: "وسط" },
  RM: { en: "RM", ar: "وسط أيمن" },
  LW: { en: "LW", ar: "جناح أيسر" },
  ST: { en: "ST", ar: "مهاجم صريح" },
  RW: { en: "RW", ar: "جناح أيمن" },
  CF: { en: "CF", ar: "رأس حربة" },
};

function useDashboardLanguage(): DashboardLanguage {
  const [language, setLanguage] = useState<DashboardLanguage>("en");

  useEffect(() => {
    const syncLanguage = () => {
      setLanguage(
        document.documentElement.dataset.goalixDashboardLanguage === "ar"
          ? "ar"
          : "en",
      );
    };

    syncLanguage();
    const observer = new MutationObserver(syncLanguage);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-goalix-dashboard-language"],
    });
    return () => observer.disconnect();
  }, []);

  return language;
}

type PainValue = 0 | 1;

const emptyPainRows: InjuryRiskPainDiscomfortRecord[] = [];

const isPainValue = (value: unknown): value is PainValue =>
  value === 0 || value === 1;

const formatDateOnly = (
  value: string | null | undefined,
  language: DashboardLanguage = "en",
) => {
  if (!value) return "--";
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(
      new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const riskLevelLabel = (value: string | undefined, language: DashboardLanguage) =>
  value ? localized(riskLevelLabels[value] ?? { en: value, ar: value }, language) : "--";

const recommendationLabel = (
  value: string | undefined | null,
  language: DashboardLanguage,
) => {
  if (!value) return "--";
  return localized(recommendationLabels[value] ?? { en: value, ar: value }, language);
};

const positionLabel = (
  value: string | undefined | null,
  language: DashboardLanguage,
) => {
  if (!value) return "--";
  return localized(footballPositionLabels[value] ?? { en: value, ar: value }, language);
};

const riskBadgeVariant = (
  prediction: InjuryRiskPrediction | null,
): "destructive" | "warning" | "success" | "outline" => {
  if (prediction?.risk_level === "High") return "destructive";
  if (prediction?.risk_level === "Medium") return "warning";
  if (prediction?.risk_level === "Low") return "success";
  return "outline";
};

export default function CoachInjuryRiskAIPage() {
  const language = useDashboardLanguage();
  const copy = pageCopy[language];
  const isArabic = language === "ar";
  const {
    can,
    isLoading: loadingPermissions,
    isError: permissionsError,
  } = useCoachPermissions();
  const canViewInjuryRisk = can("can_view_injury_risk");
  const canRunInjuryRisk = can("can_run_injury_risk");
  const canManageInjuryRisk = can("can_manage_injury_risk");
  const skipInjuryRiskQueries =
    loadingPermissions || permissionsError || !canViewInjuryRisk;
  const {
    data: painRows = emptyPainRows,
    isLoading: loadingPainRows,
    isFetching: fetchingPainRows,
    isError: painRowsError,
    refetch,
  } = useGetInjuryRiskPainDiscomfortQuery(undefined, {
    skip: skipInjuryRiskQueries,
  });
  const [savePainRows, { isLoading: savingPainRows, error: saveError }] =
    useUpsertInjuryRiskPainDiscomfortMutation();
  const {
    data: predictionRows = [],
    isLoading: loadingPredictions,
    isFetching: fetchingPredictions,
  } = useGetInjuryRiskPredictionsQuery(undefined, {
    skip: skipInjuryRiskQueries,
  });
  const [
    runPredictions,
    { isLoading: runningPredictions, error: predictionRunError },
  ] = useRunInjuryRiskPredictionsMutation();
  const [drafts, setDrafts] = useState<Record<string, PainValue | undefined>>(
    {},
  );
  const [saved, setSaved] = useState(false);

  const weekLabel = useMemo(() => {
    const firstRow = painRows[0];
    if (!firstRow) return copy.currentWeek;
    return `${formatDateOnly(firstRow.week_start, language)} - ${formatDateOnly(
      firstRow.week_end,
      language,
    )}`;
  }, [copy.currentWeek, language, painRows]);

  const draftKey = (row: InjuryRiskPainDiscomfortRecord) =>
    `${row.week_start}:${row.player_id}`;
  const selectedValueFor = (row: InjuryRiskPainDiscomfortRecord) => {
    const draft = drafts[draftKey(row)];
    if (isPainValue(draft)) return draft;
    return isPainValue(row.pain_or_discomfort)
      ? row.pain_or_discomfort
      : undefined;
  };

  const selectedCount = painRows.filter((row) =>
    isPainValue(selectedValueFor(row)),
  ).length;
  const selectedRows = painRows.filter((row) =>
    isPainValue(selectedValueFor(row)),
  );
  const canSave =
    canManageInjuryRisk &&
    selectedRows.length > 0 &&
    !savingPainRows &&
    !runningPredictions;
  const canSaveAndRun = canSave && canRunInjuryRisk;

  const updateDraft = (
    row: InjuryRiskPainDiscomfortRecord,
    value: PainValue,
  ) => {
    setSaved(false);
    setDrafts((current) => ({ ...current, [draftKey(row)]: value }));
  };

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await savePainRows({
        records: selectedRows.map((row) => ({
          playerId: row.player_id,
          painOrDiscomfort: selectedValueFor(row) as PainValue,
        })),
      }).unwrap();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaved(false);
    }
  };

  const handleSaveAndRunModel = async () => {
    if (!canSaveAndRun) return;
    try {
      await savePainRows({
        records: selectedRows.map((row) => ({
          playerId: row.player_id,
          painOrDiscomfort: selectedValueFor(row) as PainValue,
        })),
      }).unwrap();
      setSaved(true);
      await runPredictions().unwrap();
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaved(false);
    }
  };

  const handleRunModel = async () => {
    try {
      await runPredictions().unwrap();
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="goalix-injury-risk-page space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <PageHeader
        title={copy.title}
        description={copy.description}
        breadcrumbs={[
          { label: copy.home, href: "/coach/home" },
          { label: copy.title },
        ]}
      />

      {!loadingPermissions && (permissionsError || !canViewInjuryRisk) && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>
            Your assigned coach role does not include access to injury-risk data.
            Ask an academy administrator to update your branch or group assignment.
          </span>
        </div>
      )}

      {canViewInjuryRisk && (
        <>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[#253f5a] bg-[#06111f]/86 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-lime-300/30 bg-lime-300/10 text-lime-300">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">{copy.modelInputs}</h2>
              <p className="text-sm text-slate-400">
                {copy.modelInputsDescription}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {modelInputs.map((input) => (
              <div
                key={input.label.en}
                className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-200">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {localized(input.label, language)}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {localized(input.detail, language)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#253f5a] bg-[#06111f]/86 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">{copy.currentScope}</h2>
              <p className="text-sm text-slate-400">{copy.currentScopeDescription}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <Activity className="mt-0.5 h-4 w-4 text-lime-300" />
              <span>{copy.savedPerPlayer}</span>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <CircleGauge className="mt-0.5 h-4 w-4 text-cyan-200" />
              <span>{copy.normalizedPosition}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {copy.weeklyPain}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{weekLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saved && (
              <Badge variant="success" className="h-8 gap-1.5 px-3">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {copy.saved}
              </Badge>
            )}
            <RefreshButton
              size="sm"
              onRefresh={refetch}
              isRefreshing={fetchingPainRows}
              label={copy.refresh}
              refreshingLabel={copy.refreshingResults}
              disabled={fetchingPainRows || savingPainRows}
              className="border-[#253f5a] text-slate-100 hover:bg-white/10"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
            >
              {savingPainRows ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Inputs
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAndRunModel}
              disabled={!canSaveAndRun}
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
            >
              {savingPainRows || runningPredictions ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BrainCircuit className="h-4 w-4" />
              )}
              {copy.saveAndRun}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRunModel}
              disabled={!canRunInjuryRisk || runningPredictions || savingPainRows}
              className="bg-lime-300 text-slate-950 hover:bg-lime-200"
            >
              {runningPredictions ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BrainCircuit className="h-4 w-4" />
              )}
              {copy.runModel}
            </Button>
          </div>
        </div>

        {(painRowsError || saveError || predictionRunError) && (
          <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Unable to complete the injury risk operation. Check your assigned
              permission and the local Python model setup.
            </span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-[#253f5a] bg-[#06111f]/86">
          {loadingPainRows ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-14 rounded-lg bg-white/[0.06]"
                />
              ))}
            </div>
          ) : painRows.length ? (
            <table className={cn("w-full min-w-[760px] text-sm", isArabic ? "text-right" : "text-left")}>
              <thead className="border-b border-[#253f5a] bg-white/[0.035] text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{copy.player}</th>
                  <th className="px-4 py-3 font-semibold">{copy.position}</th>
                  <th className="px-4 py-3 font-semibold">{copy.painOrDiscomfort}</th>
                  <th className="px-4 py-3 font-semibold">{copy.currentValue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#253f5a]">
                {painRows.map((row) => {
                  const selectedValue = selectedValueFor(row);
                  return (
                    <tr key={row.player_id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-100">
                          {row.player_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.updated_at
                            ? `${copy.updated} ${formatDateOnly(row.updated_at, language)}`
                            : copy.notSubmitted}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {positionLabel(row.position, language)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex rounded-lg border border-[#253f5a] bg-white/[0.025] p-1">
                          {([0, 1] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={selectedValue === value}
                              disabled={!canManageInjuryRisk}
                              onClick={() => updateDraft(row, value)}
                              className={cn(
                                "h-9 w-12 rounded-md text-sm font-semibold text-slate-300 transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
                                selectedValue === value &&
                                  value === 0 &&
                                  "bg-emerald-400/[0.16] text-emerald-100 ring-1 ring-emerald-300/40",
                                selectedValue === value &&
                                  value === 1 &&
                                  "bg-amber-400/[0.16] text-amber-100 ring-1 ring-amber-300/40",
                              )}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isPainValue(selectedValue) ? (
                          <Badge
                            variant={selectedValue === 1 ? "warning" : "success"}
                            className="min-w-12 justify-center"
                          >
                            {selectedValue}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400">
                            {copy.pending}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              {copy.noPlayers}
            </div>
          )}
        </div>

        {painRows.length > 0 && (
          <div className="text-xs text-slate-500">
            {selectedCount}/{painRows.length} {copy.selected}
          </div>
        )}
      </section>
        </>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{copy.modelOutput}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {fetchingPredictions ? copy.refreshingResults : copy.latestPredictions}
            </p>
          </div>
          {predictionRows.length > 0 && (
            <Badge variant="secondary" className="w-fit">
              {predictionRows.filter((row) => row.prediction).length}/
              {predictionRows.length} {copy.predicted}
            </Badge>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#253f5a] bg-[#06111f]/86">
          {loadingPredictions ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-16 rounded-lg bg-white/[0.06]"
                />
              ))}
            </div>
          ) : predictionRows.length ? (
            <table className={cn("w-full min-w-[980px] text-sm", isArabic ? "text-right" : "text-left")}>
              <thead className="border-b border-[#253f5a] bg-white/[0.035] text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{copy.player}</th>
                  <th className="px-4 py-3 font-semibold">{copy.input}</th>
                  <th className="px-4 py-3 font-semibold">{copy.risk}</th>
                  <th className="px-4 py-3 font-semibold">{copy.recommendation}</th>
                  <th className="px-4 py-3 font-semibold">{copy.run}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#253f5a]">
                {predictionRows.map((row) => (
                  <tr key={row.player_id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-100">
                        {row.player_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {positionLabel(row.input?.position || row.position, language)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs leading-5 text-slate-400">
                      {row.input ? (
                        <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                          <span>{copy.inputAge}: {row.input.age ?? "--"}</span>
                          <span>{copy.inputPosition}: {positionLabel(row.input.position, language)}</span>
                          <span>{copy.inputAttendance}: {(row.input.attendance_rate * 100).toFixed(0)}%</span>
                          <span>{copy.inputSessions}: {row.input.training_sessions_per_week}</span>
                          <span>{copy.inputMinutes}: {row.input.match_minutes_last_week}</span>
                          <span>{copy.inputFatigue}: {row.input.fatigue_rating}/10</span>
                          <span>{copy.inputInjury}: {row.input.previous_injury}</span>
                          <span>{copy.inputPain}: {row.input.pain_or_discomfort}</span>
                        </div>
                      ) : (
                        "--"
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {row.error ? (
                        <Badge variant="destructive">{copy.error}</Badge>
                      ) : row.prediction ? (
                        <div className="space-y-2">
                          <Badge
                            variant={riskBadgeVariant(row.prediction)}
                            className="min-w-20 justify-center"
                          >
                            {riskLevelLabel(row.prediction.risk_level, language)}
                          </Badge>
                          <div className="text-xs text-slate-400">
                            {row.prediction.risk_percentage}%
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-slate-400">
                          {copy.pending}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {row.error || recommendationLabel(row.prediction?.recommendation, language)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {row.created_at ? formatDateOnly(row.created_at, language) : "--"}
                      {row.model_version && (
                        <div className="mt-1">{row.model_version}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              {copy.noOutput}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{copy.positionMapping}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {copy.positionMappingDescription}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#253f5a] bg-[#06111f]/86">
          <table className={cn("w-full min-w-[760px] text-sm", isArabic ? "text-right" : "text-left")}>
            <thead className="border-b border-[#253f5a] bg-white/[0.035] text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">{copy.modelCategory}</th>
                <th className="px-4 py-3 font-semibold">{copy.matchConfigPositions}</th>
                <th className="px-4 py-3 font-semibold">{copy.notes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#253f5a]">
              {(Object.entries(injuryRiskPositionGroups) as Array<
                [InjuryRiskPositionGroup, string[]]
              >).map(([group, positions]) => (
                <tr key={group} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {localized(positionGroupLabels[group], language)}
                      </span>
                      <Badge variant="secondary">{positions.length}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {positions.map((position) => (
                        <Badge key={position} variant="outline" className="rounded-full">
                          {positionLabel(position, language)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-400">
                    {localized(positionDescriptions[group], language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{copy.inputSourceRules}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {copy.inputSourceRulesDescription}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#253f5a] bg-[#06111f]/86">
          <table className={cn("w-full min-w-[760px] text-sm", isArabic ? "text-right" : "text-left")}>
            <thead className="border-b border-[#253f5a] bg-white/[0.035] text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">{copy.input}</th>
                <th className="px-4 py-3 font-semibold">{copy.preparedSource}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#253f5a]">
              {sourceRules.map((rule) => (
                <tr key={rule.input.en}>
                  <td className="px-4 py-4 font-semibold text-slate-100">
                    {localized(rule.input, language)}
                  </td>
                  <td className="px-4 py-4 text-slate-400">
                    {localized(rule.source, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
