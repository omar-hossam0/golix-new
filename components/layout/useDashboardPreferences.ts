import { useEffect, useState } from "react";
import type {
  DashboardDensity,
  DashboardFocus,
  DashboardLanguage,
  DashboardMotion,
  DashboardTheme,
} from "@/components/layout/dashboardFrameTypes";

export function useDashboardPreferences() {
  const [language, setLanguage] = useState<DashboardLanguage>("en");
  const [theme, setTheme] = useState<DashboardTheme>("light");
  const [density, setDensity] = useState<DashboardDensity>("comfortable");
  const [motion, setMotion] = useState<DashboardMotion>("full");
  const [focusMode, setFocusMode] = useState<DashboardFocus>("off");
  const [settingsReady, setSettingsReady] = useState(false);
  const [compactNav, setCompactNav] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedLanguage = window.localStorage.getItem("goalix-dashboard-language");
      const savedTheme = window.localStorage.getItem("goalix-dashboard-theme");
      const savedDensity = window.localStorage.getItem("goalix-dashboard-density");
      const savedMotion = window.localStorage.getItem("goalix-dashboard-motion");
      const savedFocus = window.localStorage.getItem("goalix-dashboard-focus");

      if (savedLanguage === "ar" || savedLanguage === "en") setLanguage(savedLanguage);
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      if (savedDensity === "comfortable" || savedDensity === "compact") setDensity(savedDensity);
      if (savedMotion === "full" || savedMotion === "reduced") setMotion(savedMotion);
      if (savedFocus === "off" || savedFocus === "on") setFocusMode(savedFocus);

      setSettingsReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1180px)");
    const syncCompactNav = () => setCompactNav(query.matches);

    syncCompactNav();
    query.addEventListener("change", syncCompactNav);

    return () => query.removeEventListener("change", syncCompactNav);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;

    window.localStorage.setItem("goalix-dashboard-language", language);
    window.localStorage.setItem("goalix-dashboard-theme", theme);
    window.localStorage.setItem("goalix-dashboard-density", density);
    window.localStorage.setItem("goalix-dashboard-motion", motion);
    window.localStorage.setItem("goalix-dashboard-focus", focusMode);

    document.documentElement.dataset.goalixDashboardLanguage = language;
    document.documentElement.dataset.goalixDashboardTheme = theme;
    document.documentElement.dataset.goalixDashboardDensity = density;
    document.documentElement.dataset.goalixDashboardMotion = motion;
    document.documentElement.dataset.goalixDashboardFocus = focusMode;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

    const viewport = document.querySelector(".goalix-dashboard-viewport");
    viewport?.setAttribute("data-dashboard-language", language);
    viewport?.setAttribute("data-dashboard-theme", theme);
    viewport?.setAttribute("data-dashboard-density", density);
    viewport?.setAttribute("data-dashboard-motion", motion);
    viewport?.setAttribute("data-dashboard-focus", focusMode);
  }, [density, focusMode, language, motion, settingsReady, theme]);

  useEffect(() => {
    const syncSettings = (event?: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as {
              language?: DashboardLanguage;
              theme?: DashboardTheme;
              density?: DashboardDensity;
              motion?: DashboardMotion;
              focusMode?: DashboardFocus;
            })
          : {};
      const savedLanguage =
        detail.language ?? window.localStorage.getItem("goalix-dashboard-language");
      const savedTheme =
        detail.theme ?? window.localStorage.getItem("goalix-dashboard-theme");
      const savedDensity =
        detail.density ?? window.localStorage.getItem("goalix-dashboard-density");
      const savedMotion =
        detail.motion ?? window.localStorage.getItem("goalix-dashboard-motion");
      const savedFocus =
        detail.focusMode ?? window.localStorage.getItem("goalix-dashboard-focus");

      if (savedLanguage === "ar" || savedLanguage === "en") setLanguage(savedLanguage);
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      if (savedDensity === "comfortable" || savedDensity === "compact") setDensity(savedDensity);
      if (savedMotion === "full" || savedMotion === "reduced") setMotion(savedMotion);
      if (savedFocus === "off" || savedFocus === "on") setFocusMode(savedFocus);
    };

    const syncFromStorage = () => syncSettings();

    window.addEventListener("goalix-dashboard-settings-changed", syncSettings);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener("goalix-dashboard-settings-changed", syncSettings);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  return {
    language,
    setLanguage,
    theme,
    setTheme,
    density,
    setDensity,
    motion,
    setMotion,
    focusMode,
    setFocusMode,
    compactNav,
  };
}
