"use client";

import { useEffect, useState } from "react";
import { CircleAlert, X } from "lucide-react";
import { normalizeApiError, reportClientError } from "@/lib/api/errors";

type ClientErrorNotice = {
  message: string;
  requestId?: string;
};

export function ClientErrorMonitor() {
  const [notice, setNotice] = useState<ClientErrorNotice | null>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeApiError(event.reason);
      reportClientError(event.reason, { source: "unhandled_promise_rejection" });
      setNotice({
        message: normalized.message,
        requestId: normalized.requestId,
      });
      if (process.env.NODE_ENV === "production") event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () =>
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
  }, []);

  if (!notice) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-1/2 z-[200] flex w-[min(92vw,680px)] -translate-x-1/2 items-start gap-3 rounded-xl border border-red-400/30 bg-[#160f18]/95 p-4 text-sm text-red-50 shadow-2xl backdrop-blur"
    >
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">The action could not be completed.</p>
        <p className="mt-0.5 text-red-100/80">{notice.message}</p>
        {notice.requestId && (
          <p className="mt-1 text-xs text-red-100/60">
            Reference: {notice.requestId}
          </p>
        )}
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-red-100/70 hover:bg-white/10 hover:text-white"
        aria-label="Dismiss error"
        onClick={() => setNotice(null)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
