"use client";

import type { ParentChild } from "@/lib/store/api/calendarApi";
import { cn } from "@/lib/utils";

interface ParentChildTabsProps {
  items: ParentChild[];
  selectedChildId: string;
  onSelect: (childId: string) => void;
  ariaLabel: string;
}

export function ParentChildTabs({
  items,
  selectedChildId,
  onSelect,
  ariaLabel,
}: ParentChildTabsProps) {
  if (items.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full flex-wrap gap-2"
    >
      {items.map((child) => {
        const selected = selectedChildId === child.id;

        return (
          <button
            key={child.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(child.id)}
            className={cn(
              "min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent",
            )}
          >
            {child.full_name}
          </button>
        );
      })}
    </div>
  );
}
