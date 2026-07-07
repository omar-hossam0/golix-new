"use client";

import { useEffect, useState } from "react";

export type DashboardLanguage = "en" | "ar";

export function useDashboardLanguage() {
  const [language, setLanguage] = useState<DashboardLanguage>("en");

  useEffect(() => {
    const readLanguage = () => {
      const stored = window.localStorage.getItem("goalix-dashboard-language");
      const htmlLanguage = document.documentElement.dataset.goalixDashboardLanguage;
      const frameLanguage =
        document.querySelector(".goalix-reference-frame")?.getAttribute("data-dashboard-language") ||
        document.querySelector(".goalix-dashboard-viewport")?.getAttribute("data-dashboard-language");
      const next = frameLanguage || htmlLanguage || stored;
      setLanguage(next === "ar" ? "ar" : "en");
    };

    readLanguage();

    const observer = new MutationObserver(readLanguage);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-goalix-dashboard-language"],
    });

    const frame = document.querySelector(".goalix-reference-frame, .goalix-dashboard-viewport");
    if (frame) {
      observer.observe(frame, {
        attributes: true,
        attributeFilter: ["data-dashboard-language"],
      });
    }

    window.addEventListener("storage", readLanguage);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", readLanguage);
    };
  }, []);

  return language;
}
