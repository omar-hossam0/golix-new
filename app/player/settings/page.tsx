"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Languages,
  Maximize2,
  Minimize2,
  Moon,
  Move,
  PanelLeftClose,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  ZapOff,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth/auth-context";
import { cn, getInitials } from "@/lib/utils";

type DashboardLanguage = "en" | "ar";
type DashboardTheme = "light" | "dark";
type DashboardDensity = "comfortable" | "compact";
type DashboardMotion = "full" | "reduced";
type DashboardFocus = "off" | "on";

const keys = {
  language: "goalix-dashboard-language",
  theme: "goalix-dashboard-theme",
  density: "goalix-dashboard-density",
  motion: "goalix-dashboard-motion",
  focus: "goalix-dashboard-focus",
  notifications: "goalix-player-browser-notifications",
};

const settingsCopy = {
  en: {
    player: "Player",
    title: "Player Settings",
    description: "Tune the dashboard behavior on this device.",
    home: "Home",
    settings: "Settings",
    savedBrowser: "Preferences are saved for this browser.",
    language: "Language",
    english: "English",
    arabic: "Arabic",
    englishDescription: "English labels and left-to-right layout.",
    arabicDescription: "Arabic labels and right-to-left layout.",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    lightDescription: "Brighter surfaces for daytime use.",
    darkDescription: "Darker surfaces for low-light sessions.",
    density: "Density",
    comfortable: "Comfortable",
    compact: "Compact",
    comfortableDescription: "More breathing room between dashboard elements.",
    compactDescription: "Tighter spacing for scanning more data at once.",
    motion: "Motion",
    fullMotion: "Full motion",
    reducedMotion: "Reduced motion",
    fullMotionDescription: "Keep transitions and animated loaders enabled.",
    reducedMotionDescription: "Minimize transitions across the player dashboard.",
    focusMode: "Focus Mode",
    standard: "Standard",
    focused: "Focused",
    standardDescription: "Show all dashboard panels and sidebar extras.",
    focusedDescription: "Hide non-essential sidebar promo content.",
    browserNotifications: "Browser Notifications",
    enabled: "Enabled",
    disabled: "Disabled",
    permission: "Permission:",
    notSupported: "not supported",
    turnOff: "Turn off",
    turnOn: "Turn on",
    reset: "Reset",
    focusSummary: "Focus mode",
    standardSummary: "Standard mode",
  },
  ar: {
    player: "اللاعب",
    title: "إعدادات اللاعب",
    description: "اضبط سلوك لوحة التحكم على هذا الجهاز.",
    home: "الرئيسية",
    settings: "الإعدادات",
    savedBrowser: "يتم حفظ التفضيلات لهذا المتصفح.",
    language: "اللغة",
    english: "الإنجليزية",
    arabic: "العربية",
    englishDescription: "تسميات إنجليزية واتجاه من اليسار إلى اليمين.",
    arabicDescription: "تسميات عربية واتجاه من اليمين إلى اليسار.",
    theme: "الثيم",
    light: "فاتح",
    dark: "داكن",
    lightDescription: "أسطح أكثر وضوحًا للاستخدام نهارًا.",
    darkDescription: "أسطح داكنة للحصص منخفضة الإضاءة.",
    density: "كثافة العرض",
    comfortable: "مريح",
    compact: "مضغوط",
    comfortableDescription: "مساحة أكبر بين عناصر لوحة التحكم.",
    compactDescription: "مسافات أضيق لمراجعة بيانات أكثر بسرعة.",
    motion: "الحركة",
    fullMotion: "حركة كاملة",
    reducedMotion: "حركة أقل",
    fullMotionDescription: "إبقاء الانتقالات ومؤشرات التحميل المتحركة مفعلة.",
    reducedMotionDescription: "تقليل الانتقالات داخل لوحة اللاعب.",
    focusMode: "وضع التركيز",
    standard: "قياسي",
    focused: "مركز",
    standardDescription: "إظهار كل لوحات الداشبورد وإضافات السايد بار.",
    focusedDescription: "إخفاء العناصر الجانبية غير الأساسية.",
    browserNotifications: "إشعارات المتصفح",
    enabled: "مفعلة",
    disabled: "معطلة",
    permission: "الصلاحية:",
    notSupported: "غير مدعومة",
    turnOff: "إيقاف",
    turnOn: "تشغيل",
    reset: "إعادة ضبط",
    focusSummary: "وضع التركيز",
    standardSummary: "الوضع القياسي",
  },
} as const;

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

function OptionCard({
  active,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left transition",
        active
          ? "border-cyan-300/45 bg-cyan-400/10 text-white shadow-[0_0_24px_rgba(34,211,238,0.08)]"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.055]",
      )}
    >
      <span
        className={cn(
          "rounded-lg p-2",
          active ? "bg-cyan-300/15 text-cyan-100" : "bg-white/[0.05] text-slate-300",
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

export default function PlayerSettingsPage() {
  const { user } = useCurrentUser();
  const [language, setLanguage] = useState<DashboardLanguage>(() =>
    readPreference(keys.language, ["en", "ar"] as const, "en"),
  );
  const [theme, setTheme] = useState<DashboardTheme>(() =>
    readPreference(keys.theme, ["light", "dark"] as const, "light"),
  );
  const [density, setDensity] = useState<DashboardDensity>(() =>
    readPreference(keys.density, ["comfortable", "compact"] as const, "comfortable"),
  );
  const [motion, setMotion] = useState<DashboardMotion>(() =>
    readPreference(keys.motion, ["full", "reduced"] as const, "full"),
  );
  const [focusMode, setFocusMode] = useState<DashboardFocus>(() =>
    readPreference(keys.focus, ["off", "on"] as const, "off"),
  );
  const [browserNotifications, setBrowserNotifications] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(keys.notifications) === "on";
  });
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">(() => {
      if (typeof window === "undefined") return "default";
      return "Notification" in window
        ? window.Notification.permission
        : "unsupported";
    });

  const t = settingsCopy[language];
  const dashboardSettings = useMemo(
    () => ({ language, theme, density, motion, focusMode }),
    [density, focusMode, language, motion, theme],
  );

  useEffect(() => {
    window.localStorage.setItem(keys.language, language);
    window.localStorage.setItem(keys.theme, theme);
    window.localStorage.setItem(keys.density, density);
    window.localStorage.setItem(keys.motion, motion);
    window.localStorage.setItem(keys.focus, focusMode);
    emitDashboardSettings(dashboardSettings);
  }, [dashboardSettings, density, focusMode, language, motion, theme]);

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
    setBrowserNotifications(false);
    window.localStorage.setItem(keys.notifications, "off");
  };

  const summary = [
    language === "ar" ? t.arabic : t.english,
    theme === "dark" ? t.dark : t.light,
    density === "compact" ? t.compact : t.comfortable,
    motion === "reduced" ? t.reducedMotion : t.fullMotion,
    focusMode === "on" ? t.focusSummary : t.standardSummary,
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.settings },
        ]}
      />

      <Card className="border-white/10 bg-white/[0.045] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-lg bg-cyan-400/10 text-lg font-bold text-cyan-100">
              {getInitials(user?.fullName || t.player)}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {user?.fullName || t.player}
              </p>
              <p className="text-sm text-slate-400">
                {t.savedBrowser}
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
              {t.permission}{" "}
              {notificationPermission === "unsupported"
                ? t.notSupported
                : notificationPermission}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={browserNotifications ? "outline" : "default"}
              onClick={toggleBrowserNotifications}
              disabled={notificationPermission === "unsupported"}
            >
              {browserNotifications ? t.turnOff : t.turnOn}
            </Button>
            <Button type="button" variant="outline" onClick={resetPreferences}>
              <RotateCcw className="h-4 w-4" />
              {t.reset}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
