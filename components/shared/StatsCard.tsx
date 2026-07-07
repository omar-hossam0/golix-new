"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  ClipboardCheck,
  CreditCard,
  UserCheck,
  Layers,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Users,
  ClipboardCheck,
  CreditCard,
  UserCheck,
  Layers,
  AlertTriangle,
};

interface StatsCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
  className?: string;
}

export function StatsCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  className,
}: StatsCardProps) {
  const Icon = icon ? iconMap[icon] : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          {change > 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          ) : change < 0 ? (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          ) : (
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              change > 0
                ? "text-emerald-400"
                : change < 0
                ? "text-red-400"
                : "text-muted-foreground"
            )}
          >
            {change > 0 ? "+" : ""}
            {change}
            {typeof change === "number" && changeLabel
              ? ` ${changeLabel}`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}
