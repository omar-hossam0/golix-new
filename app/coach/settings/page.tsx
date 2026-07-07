"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Languages,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Move,
  PanelLeftClose,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Users,
  ZapOff,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth/auth-context";
import {
  useGetCurrentUserQuery,
} from "@/lib/store/api/adminApi";
import {
  type CoachGroup,
  useGetCoachGroupsScopedQuery,
} from "@/lib/store/api/calendarApi";
import { cn, getInitials } from "@/lib/utils";

type DashboardLanguage = "en" | "ar";
type DashboardTheme = "light" | "dark";
type DashboardDensity = "comfortable" | "compact";
type DashboardMotion = "full" | "reduced";
type DashboardFocus = "off" | "on";
type TrainingEvaluationMode = "all" | "search";
type IconType = React.ComponentType<{ className?: string }>;

const keys = {
  language: "goalix-dashboard-language",
  theme: "goalix-dashboard-theme",
  density: "goalix-dashboard-density",
  motion: "goalix-dashboard-motion",
  focus: "goalix-dashboard-focus",
  notifications: "goalix-coach-browser-notifications",
  evaluationMode: "goalix-coach-training-evaluation-mode",
};

const readPreference = <T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
) => {
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(key);
  return allowed.includes(saved as T) ? (saved as T) : fallback;
};

const emitDashboardSettings = (settings: {
  language: DashboardLanguage;
  theme: DashboardTheme;
  density: DashboardDensity;
  motion: DashboardMotion;
  focusMode: DashboardFocus;
}) => {
  window.dispatchEvent(
    new CustomEvent("goalix-dashboard-settings-changed", {
      detail: settings,
    }),
  );
};

const emitCoachSettings = (settings: {
  evaluationMode: TrainingEvaluationMode;
}) => {
  window.dispatchEvent(
    new CustomEvent("goalix-coach-settings-changed", {
      detail: settings,
    }),
  );
};

function OptionCard({
  active,
  title,
  description,
  icon: Icon,
  onClick,
  disabled = false,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: IconType;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left transition",
        disabled && "cursor-not-allowed opacity-55",
        active
          ? "border-lime-300/45 bg-lime-300/10 text-white shadow-[0_0_24px_rgba(190,242,100,0.08)]"
          : disabled
            ? "border-white/10 bg-white/[0.025] text-slate-500"
            : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.055]",
      )}
    >
      <span
        className={cn(
          "rounded-lg p-2",
          active
            ? "bg-lime-300/15 text-lime-100"
            : disabled
              ? "bg-white/[0.035] text-slate-500"
              : "bg-white/[0.05] text-slate-300",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-semibold">
          {title}
          {active && <CheckCircle2 className="h-4 w-4 text-lime-300" />}
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-400">
          {description}
        </span>
      </span>
    </button>
  );
}

const titleCase = (value: string | null | undefined) =>
  (value || "Not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

function PermissionStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: IconType;
  tone: "lime" | "cyan" | "amber" | "slate";
}) {
  const toneClass = {
    lime: "bg-lime-300/10 text-lime-100",
    cyan: "bg-cyan-300/10 text-cyan-100",
    amber: "bg-amber-300/10 text-amber-100",
    slate: "bg-white/[0.055] text-slate-100",
  }[tone];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </span>
        <span className={cn("rounded-lg p-2", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function PermissionBadge({
  enabled,
  label,
  disabledLabel,
}: {
  enabled: boolean;
  label: string;
  disabledLabel: string;
}) {
  return (
    <Badge variant={enabled ? "success" : "secondary"}>
      {enabled ? label : disabledLabel}
    </Badge>
  );
}

function CoachGroupPermissionRow({
  group,
  labels,
}: {
  group: CoachGroup;
  labels: {
    training: string;
    noTraining: string;
    attendance: string;
    noAttendance: string;
    evaluation: string;
    noEvaluation: string;
  };
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{group.group_name}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <Building2 className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="truncate">{group.branch_name}</span>
          </p>
        </div>
        <Badge
          variant={
            group.can_create_training ||
            group.can_take_attendance ||
            group.can_evaluate_players
              ? "info"
              : "outline"
          }
          className="w-fit"
        >
          {titleCase(group.role)}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PermissionBadge
          enabled={group.can_create_training}
          label={labels.training}
          disabledLabel={labels.noTraining}
        />
        <PermissionBadge
          enabled={group.can_take_attendance}
          label={labels.attendance}
          disabledLabel={labels.noAttendance}
        />
        <PermissionBadge
          enabled={group.can_evaluate_players}
          label={labels.evaluation}
          disabledLabel={labels.noEvaluation}
        />
      </div>
    </div>
  );
}

const coachSettingsCopy = {
  en: {
    pageTitle: "Coach Settings",
    pageDescription:
      "Control your coach workspace and review the group permissions assigned by the academy.",
    home: "Home",
    settings: "Settings",
    loginSecurity: "Coach Login Security",
    twoFactorOn: "2FA On",
    twoFactorOff: "2FA Off",
    mfaEnabled:
      "Coach login is protected with MFA. Authenticator devices and backup codes are managed by the academy admin.",
    mfaDisabled:
      "MFA has not been configured for this coach account yet. Ask an academy admin to add an authenticator device before using the coach dashboard.",
    adminManagedSecurity: "Admin managed security",
    adminManagedSecurityDescription:
      "Coaches can sign in with their authenticator code or a backup code issued by the admin. They cannot add devices, disable MFA, or generate backup codes from this page.",
    coachFallback: "Coach",
    personalPreferences: "Personal coach preferences for this browser.",
    arabic: "Arabic",
    english: "English",
    dark: "Dark",
    light: "Light",
    compact: "Compact",
    comfortable: "Comfortable",
    focus: "Focus",
    standard: "Standard",
    searchReview: "Search review",
    allPlayerReview: "All-player review",
    loadingScope: "Loading scope",
    groupsCount: (count: number) => `${count} groups`,
    checkingEvaluation: "Checking evaluation",
    evaluationGroupsCount: (count: number) => `${count} evaluation groups`,
    permissionsScope: "Coach Permissions & Scope",
    assignedGroups: "Assigned groups",
    assignedGroupsHint: "Groups visible in your coach workspace.",
    createTraining: "Create training",
    createTrainingHint: "Groups where you can create sessions.",
    attendance: "Attendance",
    attendanceHint: "Groups where attendance can be edited.",
    evaluation: "Evaluation",
    evaluationHint: "Groups where player ratings can be saved.",
    loadingPermissions: "Loading coach permissions...",
    permissionsError:
      "Could not load your coach permissions right now. Saved workspace preferences will still work on this browser.",
    noGroups:
      "No coach groups are assigned to this account yet. Academy admins control group assignment and system permissions.",
    training: "Training",
    noTraining: "No training",
    noAttendance: "No attendance",
    noEvaluation: "No evaluation",
    evaluationWorkspace: "Training Evaluation Workspace",
    evaluationWorkspaceHint:
      "Applies to training evaluation pages where your group role allows player ratings.",
    checkingAccess: "Checking access",
    evaluationGroupCount: (count: number) =>
      `${count} evaluation group${count === 1 ? "" : "s"}`,
    noEvaluationAccess: "No evaluation access",
    allPlayers: "All players",
    allPlayersDescription:
      "Open training evaluations with every attended player visible.",
    searchPlayer: "Search player",
    searchPlayerDescription:
      "Open training evaluations in focused search mode.",
    browserNotifications: "Browser Notifications",
    enabled: "Enabled",
    disabled: "Disabled",
    permission: "Permission",
    notSupported: "not supported",
    turnOff: "Turn off",
    turnOn: "Turn on",
    language: "Language",
    englishDescription: "English labels and left-to-right layout.",
    arabicDescription: "Arabic labels and right-to-left layout.",
    theme: "Theme",
    lightDescription: "Brighter surfaces for daytime work.",
    darkDescription: "Darker surfaces for late sessions.",
    density: "Density",
    comfortableDescription: "More spacing between dashboard sections.",
    compactDescription: "Tighter layout for quicker scanning.",
    motion: "Motion",
    fullMotion: "Full motion",
    fullMotionDescription: "Keep transitions and loading animations.",
    reducedMotion: "Reduced motion",
    reducedMotionDescription: "Minimize transitions during repeated work.",
    focusMode: "Focus Mode",
    standardDescription: "Show all sidebar content and assistant prompts.",
    focused: "Focused",
    focusedDescription: "Hide non-essential sidebar promo content.",
    resetPreferences: "Reset coach preferences",
    resetDescription: "Restores the workspace to the default coach experience.",
    reset: "Reset",
  },
  ar: {
    pageTitle: "إعدادات المدرب",
    pageDescription:
      "تحكم في مساحة عمل المدرب وراجع صلاحيات المجموعات المعينة من الأكاديمية.",
    home: "الرئيسية",
    settings: "الإعدادات",
    loginSecurity: "أمان تسجيل دخول المدرب",
    twoFactorOn: "المصادقة الثنائية مفعلة",
    twoFactorOff: "المصادقة الثنائية غير مفعلة",
    mfaEnabled:
      "تسجيل دخول المدرب محمي بالمصادقة متعددة العوامل. أجهزة المصادقة وأكواد النسخ الاحتياطي يديرها مسؤول الأكاديمية.",
    mfaDisabled:
      "لم يتم إعداد المصادقة متعددة العوامل لهذا الحساب بعد. اطلب من مسؤول الأكاديمية إضافة جهاز مصادقة قبل استخدام لوحة المدرب.",
    adminManagedSecurity: "أمان مدار من المسؤول",
    adminManagedSecurityDescription:
      "يمكن للمدربين تسجيل الدخول بكود المصادقة أو كود احتياطي صادر من المسؤول. لا يمكن إضافة أجهزة أو تعطيل المصادقة أو إنشاء أكواد احتياطية من هذه الصفحة.",
    coachFallback: "مدرب",
    personalPreferences: "تفضيلات المدرب الشخصية لهذا المتصفح.",
    arabic: "العربية",
    english: "الإنجليزية",
    dark: "داكن",
    light: "فاتح",
    compact: "مضغوط",
    comfortable: "مريح",
    focus: "تركيز",
    standard: "قياسي",
    searchReview: "مراجعة بالبحث",
    allPlayerReview: "مراجعة كل اللاعبين",
    loadingScope: "تحميل النطاق",
    groupsCount: (count: number) => `${count} مجموعات`,
    checkingEvaluation: "فحص التقييم",
    evaluationGroupsCount: (count: number) => `${count} مجموعات تقييم`,
    permissionsScope: "صلاحيات ونطاق المدرب",
    assignedGroups: "المجموعات المعينة",
    assignedGroupsHint: "المجموعات الظاهرة في مساحة عمل المدرب.",
    createTraining: "إنشاء تدريب",
    createTrainingHint: "المجموعات التي يمكنك إنشاء حصص لها.",
    attendance: "الحضور",
    attendanceHint: "المجموعات التي يمكن تعديل الحضور فيها.",
    evaluation: "التقييم",
    evaluationHint: "المجموعات التي يمكن حفظ تقييمات اللاعبين فيها.",
    loadingPermissions: "جاري تحميل صلاحيات المدرب...",
    permissionsError:
      "تعذر تحميل صلاحيات المدرب الآن. ستظل تفضيلات مساحة العمل المحفوظة تعمل على هذا المتصفح.",
    noGroups:
      "لا توجد مجموعات مدرب معينة لهذا الحساب بعد. مسؤولو الأكاديمية يديرون تعيين المجموعات وصلاحيات النظام.",
    training: "التدريب",
    noTraining: "لا يوجد تدريب",
    noAttendance: "لا يوجد حضور",
    noEvaluation: "لا يوجد تقييم",
    evaluationWorkspace: "مساحة تقييم التدريب",
    evaluationWorkspaceHint:
      "تطبق على صفحات تقييم التدريب عندما تسمح صلاحية المجموعة بتقييم اللاعبين.",
    checkingAccess: "فحص الوصول",
    evaluationGroupCount: (count: number) => `${count} مجموعات تقييم`,
    noEvaluationAccess: "لا توجد صلاحية تقييم",
    allPlayers: "كل اللاعبين",
    allPlayersDescription: "افتح تقييم التدريب مع ظهور كل اللاعبين الحاضرين.",
    searchPlayer: "البحث عن لاعب",
    searchPlayerDescription: "افتح تقييم التدريب في وضع البحث المركز.",
    browserNotifications: "إشعارات المتصفح",
    enabled: "مفعلة",
    disabled: "معطلة",
    permission: "الصلاحية",
    notSupported: "غير مدعومة",
    turnOff: "إيقاف",
    turnOn: "تشغيل",
    language: "اللغة",
    englishDescription: "تسميات إنجليزية واتجاه من اليسار إلى اليمين.",
    arabicDescription: "تسميات عربية واتجاه من اليمين إلى اليسار.",
    theme: "الثيم",
    lightDescription: "أسطح أفتح للعمل أثناء النهار.",
    darkDescription: "أسطح داكنة للجلسات المتأخرة.",
    density: "الكثافة",
    comfortableDescription: "مسافات أكبر بين أقسام لوحة التحكم.",
    compactDescription: "تخطيط أضيق للمراجعة السريعة.",
    motion: "الحركة",
    fullMotion: "حركة كاملة",
    fullMotionDescription: "الإبقاء على الانتقالات وحركات التحميل.",
    reducedMotion: "حركة مخففة",
    reducedMotionDescription: "تقليل الانتقالات أثناء العمل المتكرر.",
    focusMode: "وضع التركيز",
    standardDescription: "إظهار كل محتوى الشريط الجانبي وتنبيهات المساعد.",
    focused: "مركز",
    focusedDescription: "إخفاء محتوى الشريط الجانبي غير الأساسي.",
    resetPreferences: "إعادة تفضيلات المدرب",
    resetDescription: "يعيد مساحة العمل إلى تجربة المدرب الافتراضية.",
    reset: "إعادة ضبط",
  },
} as const;

export default function CoachSettingsPage() {
  const { user } = useCurrentUser();
  const { data: currentUser } = useGetCurrentUserQuery();
  const [settingsReady, setSettingsReady] = useState(false);
  const [language, setLanguage] = useState<DashboardLanguage>("en");
  const [theme, setTheme] = useState<DashboardTheme>("light");
  const [density, setDensity] =
    useState<DashboardDensity>("comfortable");
  const [motion, setMotion] = useState<DashboardMotion>("full");
  const [focusMode, setFocusMode] = useState<DashboardFocus>("off");
  const [evaluationMode, setEvaluationMode] =
    useState<TrainingEvaluationMode>("all");
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const groupsQuery = useGetCoachGroupsScopedQuery();
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const t = coachSettingsCopy[language];
  const permissionCounts = useMemo(
    () =>
      groups.reduce(
        (acc, group) => {
          acc.total += 1;
          if (group.can_create_training) acc.training += 1;
          if (group.can_take_attendance) acc.attendance += 1;
          if (group.can_evaluate_players) acc.evaluation += 1;
          return acc;
        },
        { total: 0, training: 0, attendance: 0, evaluation: 0 },
      ),
    [groups],
  );
  const permissionsLoading =
    groupsQuery.isLoading || (groupsQuery.isFetching && groups.length === 0);
  const evaluationOptionsDisabled =
    !permissionsLoading && permissionCounts.evaluation === 0;
  const totpEnabled = Boolean(currentUser?.totpEnabled);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLanguage(readPreference(keys.language, ["en", "ar"] as const, "en"));
      setTheme(readPreference(keys.theme, ["light", "dark"] as const, "light"));
      setDensity(
        readPreference(
          keys.density,
          ["comfortable", "compact"] as const,
          "comfortable",
        ),
      );
      setMotion(readPreference(keys.motion, ["full", "reduced"] as const, "full"));
      setFocusMode(readPreference(keys.focus, ["off", "on"] as const, "off"));
      setEvaluationMode(
        readPreference(keys.evaluationMode, ["all", "search"] as const, "all"),
      );
      setBrowserNotifications(
        window.localStorage.getItem(keys.notifications) === "on",
      );
      setNotificationPermission(
        "Notification" in window
          ? window.Notification.permission
          : "unsupported",
      );
      setSettingsReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const dashboardSettings = useMemo(
    () => ({ language, theme, density, motion, focusMode }),
    [density, focusMode, language, motion, theme],
  );

  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(keys.language, dashboardSettings.language);
    window.localStorage.setItem(keys.theme, dashboardSettings.theme);
    window.localStorage.setItem(keys.density, dashboardSettings.density);
    window.localStorage.setItem(keys.motion, dashboardSettings.motion);
    window.localStorage.setItem(keys.focus, dashboardSettings.focusMode);
    emitDashboardSettings(dashboardSettings);
  }, [dashboardSettings, settingsReady]);

  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(keys.evaluationMode, evaluationMode);
    emitCoachSettings({ evaluationMode });
  }, [evaluationMode, settingsReady]);

  const toggleBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    let permission = window.Notification.permission;
    if (permission === "default") {
      permission = await window.Notification.requestPermission();
    }

    setNotificationPermission(permission);
    const enabled = permission === "granted" ? !browserNotifications : false;
    setBrowserNotifications(enabled);
    window.localStorage.setItem(keys.notifications, enabled ? "on" : "off");
  };

  const resetPreferences = () => {
    setLanguage("en");
    setTheme("light");
    setDensity("comfortable");
    setMotion("full");
    setFocusMode("off");
    setEvaluationMode("all");
    setBrowserNotifications(false);
    window.localStorage.setItem(keys.notifications, "off");
  };

  const summary = [
    language === "ar" ? t.arabic : t.english,
    theme === "dark" ? t.dark : t.light,
    density === "compact" ? t.compact : t.comfortable,
    focusMode === "on" ? t.focus : t.standard,
    evaluationMode === "search" ? t.searchReview : t.allPlayerReview,
    permissionsLoading ? t.loadingScope : t.groupsCount(permissionCounts.total),
    permissionsLoading
      ? t.checkingEvaluation
      : t.evaluationGroupsCount(permissionCounts.evaluation),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.settings },
        ]}
      />

      <Card className="border-white/10 bg-white/[0.045] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-lime-300" />
              {t.loginSecurity}
            </span>
            <Badge variant={totpEnabled ? "success" : "secondary"}>
              {totpEnabled ? t.twoFactorOn : t.twoFactorOff}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              "rounded-lg border p-4 text-sm",
              totpEnabled
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-amber-400/20 bg-amber-400/10 text-amber-100",
            )}
          >
            {totpEnabled ? t.mfaEnabled : t.mfaDisabled}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="font-semibold text-white">{t.adminManagedSecurity}</p>
            <p className="mt-1 text-sm text-slate-400">
              {t.adminManagedSecurityDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.045] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-lg bg-lime-300/10 text-lg font-bold text-lime-100">
              {getInitials(user?.fullName || t.coachFallback)}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {user?.fullName || t.coachFallback}
              </p>
              <p className="text-sm text-slate-400">
                {t.personalPreferences}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.045] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-lime-300" />
            {t.permissionsScope}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PermissionStat
              label={t.assignedGroups}
              value={permissionsLoading ? "..." : permissionCounts.total}
              hint={t.assignedGroupsHint}
              icon={Users}
              tone="slate"
            />
            <PermissionStat
              label={t.createTraining}
              value={permissionsLoading ? "..." : permissionCounts.training}
              hint={t.createTrainingHint}
              icon={Dumbbell}
              tone="cyan"
            />
            <PermissionStat
              label={t.attendance}
              value={permissionsLoading ? "..." : permissionCounts.attendance}
              hint={t.attendanceHint}
              icon={ClipboardCheck}
              tone="amber"
            />
            <PermissionStat
              label={t.evaluation}
              value={permissionsLoading ? "..." : permissionCounts.evaluation}
              hint={t.evaluationHint}
              icon={Star}
              tone="lime"
            />
          </div>

          {permissionsLoading ? (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-lime-300" />
              {t.loadingPermissions}
            </div>
          ) : groupsQuery.isError ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              {t.permissionsError}
            </div>
          ) : groups.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {groups.map((group) => (
                <CoachGroupPermissionRow
                  key={group.group_id}
                  group={group}
                  labels={{
                    training: t.training,
                    noTraining: t.noTraining,
                    attendance: t.attendance,
                    noAttendance: t.noAttendance,
                    evaluation: t.evaluation,
                    noEvaluation: t.noEvaluation,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
              {t.noGroups}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-lime-300" />
              {t.evaluationWorkspace}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                {t.evaluationWorkspaceHint}
              </p>
              <Badge
                variant={
                  permissionsLoading
                    ? "info"
                    : permissionCounts.evaluation > 0
                      ? "success"
                      : "warning"
                }
                className="w-fit"
              >
                {permissionsLoading
                  ? t.checkingAccess
                  : permissionCounts.evaluation > 0
                    ? t.evaluationGroupCount(permissionCounts.evaluation)
                    : t.noEvaluationAccess}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                active={evaluationMode === "all"}
                title={t.allPlayers}
                description={t.allPlayersDescription}
                icon={Users}
                onClick={() => setEvaluationMode("all")}
                disabled={evaluationOptionsDisabled}
              />
              <OptionCard
                active={evaluationMode === "search"}
                title={t.searchPlayer}
                description={t.searchPlayerDescription}
                icon={Search}
                onClick={() => setEvaluationMode("search")}
                disabled={evaluationOptionsDisabled}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-amber-300" />
              {t.browserNotifications}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-white">
                {browserNotifications ? t.enabled : t.disabled}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {t.permission}:{" "}
                {notificationPermission === "unsupported"
                  ? t.notSupported
                  : notificationPermission}
              </p>
            </div>
            <Button
              type="button"
              variant={browserNotifications ? "outline" : "default"}
              onClick={toggleBrowserNotifications}
              disabled={notificationPermission === "unsupported"}
            >
              {browserNotifications ? t.turnOff : t.turnOn}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="h-4 w-4 text-cyan-300" />
              {t.language}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <OptionCard
              active={language === "en"}
              title={t.english}
              description={t.englishDescription}
              icon={Languages}
              onClick={() => setLanguage("en")}
            />
            <OptionCard
              active={language === "ar"}
              title={t.arabic}
              description={t.arabicDescription}
              icon={Languages}
              onClick={() => setLanguage("ar")}
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-lime-300" />
              {t.theme}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <OptionCard
              active={theme === "light"}
              title={t.light}
              description={t.lightDescription}
              icon={Sun}
              onClick={() => setTheme("light")}
            />
            <OptionCard
              active={theme === "dark"}
              title={t.dark}
              description={t.darkDescription}
              icon={Moon}
              onClick={() => setTheme("dark")}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Minimize2 className="h-4 w-4 text-cyan-300" />
              {t.density}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <OptionCard
              active={density === "comfortable"}
              title={t.comfortable}
              description={t.comfortableDescription}
              icon={Maximize2}
              onClick={() => setDensity("comfortable")}
            />
            <OptionCard
              active={density === "compact"}
              title={t.compact}
              description={t.compactDescription}
              icon={Minimize2}
              onClick={() => setDensity("compact")}
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Move className="h-4 w-4 text-amber-300" />
              {t.motion}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <OptionCard
              active={motion === "full"}
              title={t.fullMotion}
              description={t.fullMotionDescription}
              icon={Sparkles}
              onClick={() => setMotion("full")}
            />
            <OptionCard
              active={motion === "reduced"}
              title={t.reducedMotion}
              description={t.reducedMotionDescription}
              icon={ZapOff}
              onClick={() => setMotion("reduced")}
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PanelLeftClose className="h-4 w-4 text-lime-300" />
              {t.focusMode}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <OptionCard
              active={focusMode === "off"}
              title={t.standard}
              description={t.standardDescription}
              icon={Settings}
              onClick={() => setFocusMode("off")}
            />
            <OptionCard
              active={focusMode === "on"}
              title={t.focused}
              description={t.focusedDescription}
              icon={PanelLeftClose}
              onClick={() => setFocusMode("on")}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/[0.045] shadow-none">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">{t.resetPreferences}</p>
            <p className="mt-1 text-sm text-slate-400">
              {t.resetDescription}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={resetPreferences}>
            <RotateCcw className="h-4 w-4" />
            {t.reset}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
