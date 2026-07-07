import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export type GoalixApiError = {
  code: string;
  message: string;
  details: unknown[];
  requestId?: string;
  status?: number | string;
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
  meta: {
    requestId?: string;
    timestamp: string;
  };
};

const sensitiveMessagePattern =
  /\b(insert into|update\s+"|delete from|select\s.+\sfrom|relation\s+"?.+"?\sdoes not exist|column\s+"?.+"?\sdoes not exist|sqlstate|postgres|knex|constraint\s+"|syntax error at or near)\b/i;

const statusMessage = (status?: number | string) => {
  if (status === 400) return "Please check the entered data and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 409) return "This action conflicts with existing data.";
  if (status === 413) return "The uploaded file is too large.";
  if (status === 422) return "Some entered values are invalid.";
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status === 502 || status === 503 || status === 504) {
    return "The service is temporarily unavailable. Please try again.";
  }
  return "Something went wrong. Please try again.";
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

const safeMessage = (
  value: unknown,
  status?: number | string,
  fallback?: string,
) => {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || sensitiveMessagePattern.test(message)) {
    return fallback || statusMessage(status);
  }
  return message;
};

export function normalizeApiError(
  error: unknown,
  fallback?: string,
): GoalixApiError {
  const root = asRecord(error);
  const status =
    typeof root?.status === "number" || typeof root?.status === "string"
      ? root.status
      : undefined;
  const payload = asRecord(root?.data) ?? root;
  const apiError = asRecord(payload?.error);
  const meta = asRecord(payload?.meta);

  const code =
    typeof apiError?.code === "string"
      ? apiError.code
      : typeof root?.status === "string"
        ? root.status
        : "UNKNOWN_ERROR";
  const rawMessage =
    apiError?.message ??
    root?.message ??
    (error instanceof Error ? error.message : undefined);
  const details = Array.isArray(apiError?.details) ? apiError.details : [];

  return {
    code,
    message: safeMessage(rawMessage, status, fallback),
    details,
    requestId:
      typeof meta?.requestId === "string" ? meta.requestId : undefined,
    status,
  };
}

export function apiErrorMessage(error: unknown, fallback: string) {
  return normalizeApiError(error, fallback).message;
}

export function toErrorEnvelope(
  error: unknown,
  fallback?: string,
): ErrorEnvelope {
  const normalized = normalizeApiError(error, fallback);
  return {
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    },
    meta: {
      requestId: normalized.requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

export function normalizeBaseQueryError(
  error: FetchBaseQueryError,
): FetchBaseQueryError {
  const envelope = toErrorEnvelope(error);
  if (typeof error.status === "number") {
    return { ...error, data: envelope };
  }

  return {
    ...error,
    error: envelope.error.message,
    data: envelope,
  } as FetchBaseQueryError;
}

export function reportClientError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const normalized = normalizeApiError(error);
  const report = {
    code: normalized.code,
    message: normalized.message,
    requestId: normalized.requestId,
    ...context,
  };

  if (process.env.NODE_ENV !== "production") {
    console.error("[goalix:error]", report, error);
  }

  return report;
}
