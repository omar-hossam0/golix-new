"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

export type MonthCalendarItem = {
  id: string;
  title: string;
  date: string;
  type: string;
  status?: string | null;
  subtitle?: string | null;
};

type MonthCalendarProps = {
  title?: string;
  items: MonthCalendarItem[];
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseItemDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toDateKey(new Date(value));
};

export function MonthCalendar({ title = "Calendar", items }: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toDateKey(new Date()));

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const itemMap = useMemo(() => {
    const map = new Map<string, MonthCalendarItem[]>();
    items.forEach((item) => {
      const key = parseItemDate(item.date);
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return map;
  }, [items]);

  const days = useMemo(() => {
    const start = new Date(monthStart);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = toDateKey(day);
      return {
        date: day,
        key,
        inMonth: day.getMonth() === cursor.getMonth(),
        items: itemMap.get(key) ?? [],
      };
    });
  }, [cursor, itemMap, monthStart]);

  const selectedItems = itemMap.get(selectedDay) ?? [];

  const moveMonth = (offset: number) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => moveMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-36 text-center text-sm font-semibold">{monthLabel}</div>
          <Button variant="outline" size="icon-sm" onClick={() => moveMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {weekdays.map((day) => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDay(day.key)}
              className={cn(
                "min-h-24 rounded-lg border border-border/40 bg-background/20 p-2 text-left transition-colors hover:border-primary/70",
                !day.inMonth && "opacity-40",
                selectedDay === day.key && "border-primary bg-primary/10"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{day.date.getDate()}</span>
                {!!day.items.length && <Badge variant="secondary">{day.items.length}</Badge>}
              </div>
              <div className="mt-2 space-y-1">
                {day.items.slice(0, 2).map((item) => (
                  <div key={item.id} className="truncate rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary">
                    {item.title}
                  </div>
                ))}
                {day.items.length > 2 && <div className="text-[11px] text-muted-foreground">+{day.items.length - 2} more</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-border/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{formatDate(selectedDay)}</h3>
            <Badge variant="outline">{selectedItems.length} items</Badge>
          </div>
          <div className="space-y-2">
            {selectedItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle || item.type}</p>
                </div>
                {item.status && <Badge variant={item.status === "cancelled" ? "destructive" : item.status === "finished" || item.status === "completed" ? "success" : "secondary"}>{item.status}</Badge>}
              </div>
            ))}
            {!selectedItems.length && <p className="py-4 text-center text-sm text-muted-foreground">No matches or events on this day.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
