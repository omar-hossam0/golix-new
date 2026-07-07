import { getApiBaseUrl } from "@/lib/api/baseUrl";
import { applyCsrfHeader, ensureCsrfToken, isMutatingMethod, refreshCsrfToken } from "@/lib/api/csrf";
import { hasAuthSessionMarker } from "@/lib/auth/session";
import { refreshAuthSession } from "@/lib/auth/refreshSession";

export const API_BASE = getApiBaseUrl();

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
};

export async function apiJson<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (isMutatingMethod(init?.method)) await ensureCsrfToken();
  applyCsrfHeader(headers);

  const res = await fetch(`${API_BASE}/api/v1/chat${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (res.status === 401 && retry && hasAuthSessionMarker()) {
    const refresh = await refreshAuthSession();
    if (refresh.ok) return apiJson<T>(path, init, false);
  }

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (
    res.status === 403 &&
    payload?.error?.code === "CSRF_TOKEN_REJECTED" &&
    retry
  ) {
    await refreshCsrfToken();
    return apiJson<T>(path, init, false);
  }
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error?.message || "Chat request failed");
  }
  return payload.data;
}

export function absoluteUploadUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const maxChatImageBytes = 8 * 1024 * 1024;
