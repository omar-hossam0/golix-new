import { getApiBaseUrl } from "@/lib/api/baseUrl";

export const CSRF_COOKIE_NAME = "csrfToken";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

let csrfRefreshPromise: Promise<string> | null = null;

export function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

export function getCsrfToken() {
  const token = readCookie(CSRF_COOKIE_NAME);
  return token ? decodeURIComponent(token) : "";
}

export function applyCsrfHeader(headers: Headers) {
  const csrfToken = getCsrfToken();
  if (csrfToken) headers.set(CSRF_HEADER_NAME, csrfToken);
  return headers;
}

export function isMutatingMethod(method?: string) {
  const normalized = (method || "GET").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalized);
}

export async function refreshCsrfToken() {
  if (typeof window === "undefined") return "";

  if (!csrfRefreshPromise) {
    const apiBase = getApiBaseUrl();
    csrfRefreshPromise = fetch(`${apiBase}/api/v1/csrf-token`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        return (payload?.data?.csrfToken as string | undefined) || getCsrfToken();
      })
      .catch(() => getCsrfToken())
      .finally(() => {
        csrfRefreshPromise = null;
      });
  }

  return csrfRefreshPromise;
}

export async function ensureCsrfToken() {
  return getCsrfToken() || refreshCsrfToken();
}

export function isCsrfRejectedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const nestedError = data?.error as Record<string, unknown> | undefined;
  return record.status === 403 && nestedError?.code === "CSRF_TOKEN_REJECTED";
}
