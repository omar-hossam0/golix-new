import { cn } from "@/lib/utils";

const logoSizeClasses = {
  sm: {
    wrapper: "gap-2.5",
    badge: "h-12 w-12 rounded-[1rem]",
    badgeText: "text-[1.55rem]",
    wordmark: "text-[2rem]",
  },
  md: {
    wrapper: "gap-3",
    badge: "h-14 w-14 rounded-[1.15rem]",
    badgeText: "text-[1.8rem]",
    wordmark: "text-[2.35rem]",
  },
  lg: {
    wrapper: "gap-3.5",
    badge: "h-16 w-16 rounded-[1.25rem]",
    badgeText: "text-[2rem]",
    wordmark: "text-[2.75rem]",
  },
} as const;

type GoalixLogoSize = keyof typeof logoSizeClasses;

interface GoalixLogoProps {
  collapsed?: boolean;
  size?: GoalixLogoSize;
  className?: string;
}

export function GoalixLogo({
  collapsed = false,
  size = "md",
  className,
}: GoalixLogoProps) {
  const sizeClasses = logoSizeClasses[size];

  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        collapsed ? "justify-center" : sizeClasses.wrapper,
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-gradient-to-br from-primary via-cyan-300 to-accent text-slate-950 shadow-[0_18px_34px_-22px_rgba(34,211,238,0.95)]",
          collapsed ? "h-12 w-12 rounded-2xl" : sizeClasses.badge
        )}
      >
        <span
          className={cn(
            "font-display font-extrabold leading-none tracking-[0.04em]",
            collapsed ? "text-[1.7rem]" : sizeClasses.badgeText
          )}
        >
          G
        </span>
      </div>
      {!collapsed && (
        <span
          className={cn(
            "block font-display font-bold leading-none tracking-[0.08em] text-foreground",
            sizeClasses.wordmark
          )}
        >
          Goalix
        </span>
      )}
    </div>
  );
}