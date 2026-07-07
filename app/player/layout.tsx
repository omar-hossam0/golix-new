"use client";

import { useEffect } from "react";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { DashboardAccessState } from "@/components/auth/DashboardAccessState";
import { useCurrentUser } from "@/lib/auth/auth-context";
import { ROLE_ROUTES } from "@/lib/constants";

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isInitialized, role } = useCurrentUser();

  useEffect(() => {
    if (!isInitialized) return;

    const destination = !isAuthenticated
      ? "/login"
      : role !== "player"
        ? role
          ? ROLE_ROUTES[role]
          : "/login"
        : null;

    if (destination) window.location.replace(destination);
  }, [isAuthenticated, isInitialized, role]);

  if (!isInitialized || !isAuthenticated || role !== "player") {
    return (
      <DashboardAccessState
        initialized={isInitialized}
        authenticated={isAuthenticated}
        role={role}
      />
    );
  }

  return (
    <div className="goalix-dashboard-viewport min-h-screen">
      <div className="goalix-dashboard-ambient pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(47,140,255,0.13),transparent_34%),radial-gradient(circle_at_78%_4%,rgba(0,216,255,0.13),transparent_30%),linear-gradient(135deg,#e8ecef_0%,#f5f6f1_52%,#dfe4e7_100%)]" />
      <div className="goalix-dashboard-grid pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(14,42,27,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(14,42,27,0.055)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="relative min-h-screen">
        <main className="min-h-screen w-full p-2 sm:p-3 lg:p-4">
          <DashboardFrame role="player">{children}</DashboardFrame>
        </main>
      </div>
    </div>
  );
}
