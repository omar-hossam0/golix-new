"use client";

import { useEffect } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/api/errors";

type RouteErrorFallbackProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export function RouteErrorFallback({
  error,
  unstable_retry,
}: RouteErrorFallbackProps) {
  useEffect(() => {
    reportClientError(error, {
      source: "next_error_boundary",
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-card p-8 text-center shadow-xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-500/10 text-red-300">
          <CircleAlert className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page could not finish loading. Your saved data was not changed.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-muted-foreground">
            Support reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => unstable_retry()}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
