"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { GoalixAuthShell } from "@/components/auth/GoalixAuthShell";
import { Button } from "@/components/ui/button";
import { ROLE_ROUTES } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

type MeResponse = {
  user?: {
    role: UserRole;
    totpEnabled?: boolean;
  };
};

async function apiFetch(path: string) {
  return fetch(`/api/v1${path}`, {
    credentials: "include",
  });
}

function setupRouteFor(role: UserRole) {
  if (role === "admin") return "/admin/settings";
  if (role === "coach") return "/coach/settings";
  return ROLE_ROUTES[role];
}

export default function MfaSetupPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function redirectToSettings() {
      try {
        const meRes = await apiFetch("/auth/me");
        const meJson = await meRes.json();
        const data = meJson.data as MeResponse;
        if (!meRes.ok || !data?.user) throw new Error("Could not load account.");
        router.replace(data.user.totpEnabled ? ROLE_ROUTES[data.user.role] : setupRouteFor(data.user.role));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load account.");
      }
    }

    void redirectToSettings();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <GoalixAuthShell>
      <div className="goalix-login-card">
        <div className="goalix-login-card-head">
          <div className="goalix-login-card-icon">
            <ShieldCheck size={24} />
          </div>
          <span>Security setup moved</span>
          <h1>MFA setup</h1>
          <p>Authenticator device setup is managed from account settings.</p>
        </div>

        {error ? (
          <div className="goalix-login-form">
            <p className="text-sm text-red-400">{error}</p>
            <Button type="button" onClick={() => router.replace("/admin-login")}>
              Back to login
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            Redirecting to settings...
          </div>
        )}
      </div>
    </GoalixAuthShell>
  );
}
