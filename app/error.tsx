"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Unhandled runtime error:", error);
  }, [error]);

  return (
    <div className="goalix-error-viewport flex min-h-screen flex-col items-center justify-center p-4">
      {/* Background gradients */}
      <div className="goalix-dashboard-ambient pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(239,68,68,0.08),transparent_34%),radial-gradient(circle_at_78%_4%,rgba(245,158,11,0.08),transparent_30%),linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)]" />
      
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl shadow-slate-100/50 backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 shadow-inner">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <h1 className="mb-3 font-display text-2xl font-bold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        
        <p className="mb-8 text-sm leading-relaxed text-slate-500">
          An unexpected error occurred while loading this page. Our technical team has been notified.
        </p>

        {error.message && (
          <div className="mb-8 overflow-x-auto rounded-xl bg-slate-50 p-4 text-left font-mono text-xs text-red-600 border border-slate-100">
            <span className="font-semibold">Error:</span> {error.message}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="w-full gap-2 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all py-6 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>

          <Button
            onClick={() => window.location.replace("/")}
            variant="outline"
            className="w-full rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-600 py-6 text-sm font-medium"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    </div>
  );
}
