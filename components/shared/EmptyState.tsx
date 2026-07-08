import { cn } from "@/lib/utils";
import { FileX } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No data found",
  description = "There are no items to display at this time.",
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "goalix-empty-state flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 rounded-full bg-muted/50 p-4">
        {icon || <FileX className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
