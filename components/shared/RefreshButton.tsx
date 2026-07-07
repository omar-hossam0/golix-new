"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RefreshStatus = "idle" | "refreshing" | "refreshed" | "failed";

interface RefreshButtonProps
  extends Omit<ButtonProps, "children" | "onClick" | "type"> {
  onRefresh: () => unknown;
  isRefreshing?: boolean;
  label?: string;
  refreshingLabel?: string;
  refreshedLabel?: string;
  failedLabel?: string;
}

const hasRequestError = (result: unknown): boolean => {
  if (Array.isArray(result)) return result.some(hasRequestError);
  return Boolean(
    result &&
      typeof result === "object" &&
      "error" in result &&
      (result as { error?: unknown }).error,
  );
};

export function RefreshButton({
  onRefresh,
  isRefreshing = false,
  label = "Refresh",
  refreshingLabel = "Refreshing...",
  refreshedLabel = "Updated",
  failedLabel = "Try again",
  variant = "outline",
  size = "default",
  className,
  disabled,
  ...props
}: RefreshButtonProps) {
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = status === "refreshing" || isRefreshing;
  const iconOnly = size === "icon" || size === "icon-sm";

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const resetLater = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 1800);
  };

  const handleRefresh = async () => {
    if (active) return;
    setStatus("refreshing");
    try {
      const result = await onRefresh();
      if (hasRequestError(result)) throw new Error("Refresh request failed");
      setStatus("refreshed");
    } catch {
      setStatus("failed");
    } finally {
      resetLater();
    }
  };

  const displayLabel = active
    ? refreshingLabel
    : status === "refreshed"
      ? refreshedLabel
      : status === "failed"
        ? failedLabel
        : label;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      disabled={disabled || active}
      aria-busy={active}
      aria-label={iconOnly ? displayLabel : props["aria-label"]}
      {...props}
      onClick={() => void handleRefresh()}
    >
      {status === "refreshed" && !active ? (
        <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
      ) : status === "failed" && !active ? (
        <TriangleAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
      ) : (
        <RefreshCw
          className={cn("h-4 w-4", active && "animate-spin")}
          aria-hidden="true"
        />
      )}
      {!iconOnly && <span aria-live="polite">{displayLabel}</span>}
    </Button>
  );
}
