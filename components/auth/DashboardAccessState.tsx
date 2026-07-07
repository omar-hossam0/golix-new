"use client";

import { Loader2 } from "lucide-react";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

export function DashboardAccessState({
  initialized,
  authenticated,
  role,
}: {
  initialized: boolean;
  authenticated: boolean;
  role: string | null;
}) {
  const language = useDashboardLanguage();
  const message =
    language === "ar"
      ? initialized
        ? "جاري تحويلك..."
        : "جاري التحقق من الجلسة..."
      : initialized
        ? "Redirecting..."
        : "Checking your session...";

  return (
    <div
      className="grid min-h-dvh place-items-center bg-background px-6 text-foreground"
      data-auth-initialized={initialized ? "true" : "false"}
      data-authenticated={authenticated ? "true" : "false"}
      data-auth-role={role || "none"}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
