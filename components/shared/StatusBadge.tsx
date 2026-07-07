import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PAYMENT_STATUS_CONFIG,
  ATTENDANCE_STATUS_CONFIG,
  PLAYER_LEVELS,
} from "@/lib/constants";
import type { PaymentStatus, AttendanceStatus, PlayerLevel } from "@/lib/types";

interface StatusBadgeProps {
  status: string;
  type: "payment" | "attendance" | "level" | "generic";
  className?: string;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  if (type === "payment") {
    const config = PAYMENT_STATUS_CONFIG[status as PaymentStatus];
    return (
      <Badge variant={config?.variant ?? "secondary"} className={className}>
        {config?.label ?? status}
      </Badge>
    );
  }

  if (type === "attendance") {
    const config = ATTENDANCE_STATUS_CONFIG[status as AttendanceStatus];
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          className
        )}
        style={{
          backgroundColor: `${config?.color}20`,
          color: config?.color,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config?.color }}
        />
        {config?.label ?? status}
      </span>
    );
  }

  if (type === "level") {
    const config = PLAYER_LEVELS[status as PlayerLevel];
    const colorMap: Record<string, string> = {
      emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      red: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
          config ? colorMap[config.color] : "",
          className
        )}
      >
        {config?.label ?? status}
      </span>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      {status}
    </Badge>
  );
}
