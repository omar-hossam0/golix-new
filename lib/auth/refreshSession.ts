import { forgetAuthSession, hasAuthSessionMarker, rememberAuthSession } from "@/lib/auth/session";
import { getApiBaseUrl } from "@/lib/api/baseUrl";

export type RefreshSessionResult =
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; unauthorized: boolean };

let refreshSessionPromise: Promise<RefreshSessionResult> | null = null;

export function refreshAuthSession(signal?: AbortSignal): Promise<RefreshSessionResult> {
  if (!hasAuthSessionMarker()) {
    return Promise.resolve({ ok: false, unauthorized: true });
  }

  if (!refreshSessionPromise) {
    const apiBase = getApiBaseUrl();
    refreshSessionPromise = fetch(`${apiBase}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      signal,
    })
      .then(async (response) => {
        const json = response.ok ? await response.json().catch(() => null) : null;
        const apiUser = json?.data?.user as Record<string, unknown> | undefined;

        if (response.ok && apiUser) {
          rememberAuthSession();
          return { ok: true, user: apiUser } as const;
        }

        if (response.status === 401 || response.status === 403) {
          forgetAuthSession();
          return { ok: false, unauthorized: true } as const;
        }

        return { ok: false, unauthorized: false } as const;
      })
      .catch(() => ({ ok: false, unauthorized: false }) as const)
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}
