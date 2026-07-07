import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { loginSuccess, logout } from "../slices/authSlice";
import { mapApiUser } from "@/lib/auth/mapApiUser";
import { hasAuthSessionMarker } from "@/lib/auth/session";
import { refreshAuthSession } from "@/lib/auth/refreshSession";
import { getApiBaseUrl } from "@/lib/api/baseUrl";
import {
  applyCsrfHeader,
  ensureCsrfToken,
  isCsrfRejectedError,
  isMutatingMethod,
  refreshCsrfToken,
} from "@/lib/api/csrf";

const API_BASE = getApiBaseUrl();

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE}/api/v1`,
  credentials: "include",
  prepareHeaders: (headers) => {
    return applyCsrfHeader(headers);
  },
});

function getRequestMethod(args: string | FetchArgs) {
  if (typeof args === "string") return "GET";
  return args.method || "GET";
}

function describeQueryArgs(args: string | FetchArgs) {
  if (typeof args === "string") return args;
  return `${args.method ?? "GET"} ${args.url}`;
}

function countResponseRows(data: unknown) {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data.length;
  if (
    record.data &&
    typeof record.data === "object" &&
    Array.isArray((record.data as Record<string, unknown>).data)
  ) {
    return ((record.data as Record<string, unknown>).data as unknown[]).length;
  }
  return undefined;
}

function approximatePayloadBytes(data: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  } catch {
    return undefined;
  }
}

function logQueryTiming(
  args: string | FetchArgs,
  endpoint: string,
  startedAt: number,
  result: { data?: unknown; error?: FetchBaseQueryError },
) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  const status = result.error?.status ?? "ok";
  const rows = countResponseRows(result.data);
  const bytes = approximatePayloadBytes(result.data);
  const message = `[api] ${endpoint} ${describeQueryArgs(args)} ${durationMs}ms`;
  const details = { endpoint, url: describeQueryArgs(args), status, durationMs, rows, bytes };
  if (durationMs >= 800) {
    console.warn(message, details);
  } else {
    console.debug(message, details);
  }
}

// mapApiUser imported from shared utilities

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const startedAt =
    process.env.NODE_ENV !== "production" && typeof performance !== "undefined"
      ? performance.now()
      : 0;

  if (isMutatingMethod(getRequestMethod(args))) {
    await ensureCsrfToken();
  }

  let result = await rawBaseQuery(args, api, extraOptions);

  if (isCsrfRejectedError(result.error)) {
    await refreshCsrfToken();
    result = await rawBaseQuery(args, api, extraOptions);
  }

  if (result.error?.status === 401) {
    if (!hasAuthSessionMarker()) {
      api.dispatch(logout());
      return result;
    }

    const refreshResult = await refreshAuthSession();

    if (!refreshResult.ok) {
      if (refreshResult.unauthorized) {
        api.dispatch(logout());
      }
      return result;
    }

    const user = mapApiUser(refreshResult.user);
    api.dispatch(loginSuccess({ user, role: user.role }));
    result = await rawBaseQuery(args, api, extraOptions);
  }

  if (startedAt) {
    logQueryTiming(args, api.endpoint, startedAt, result);
  }

  return result;
};
