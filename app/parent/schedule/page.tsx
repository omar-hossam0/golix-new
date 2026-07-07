"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Loader2,
  MapPin,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ParentChildTabs } from "@/components/parent/ParentChildTabs";
import { ParentDataError } from "@/components/parent/ParentDataError";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import {
  type CalendarEvent,
  type Match,
  useGetParentChildMatchesQuery,
  useGetParentChildTrainingsQuery,
} from "@/lib/store/api/calendarApi";
import { cn, formatDate, formatTime12, localDatePart, normalizeTime24 } from "@/lib/utils";

const copy = {
  en: {
    title: "Schedule",
    description: (name?: string | null) =>
      `Training sessions and matches for ${name || "your child"}.`,
    home: "Home",
    player: "Player",
    group: "Group",
    totalEvents: "Total events",
    upcoming: "Upcoming",
    past: "Past",
    trainings: "Training",
    matches: "Matches",
    noChild: "No linked child found for this parent account.",
    selectChild: "Select a child",
    loading: "Loading schedule...",
    loadError: "Schedule could not be loaded",
    loadErrorBody: "Check your connection, then try loading the schedule again.",
    retry: "Try again",
    noEvents: "No training sessions or matches yet.",
    noSelectedDate: "No events on this date.",
    noUpcoming: "No upcoming training sessions or matches.",
    noPast: "No past training sessions or matches.",
    selectedDate: "Selected date",
    monthOverview: "Month overview",
    training: "Training",
    match: "Match",
    location: "Location",
    coach: "Coach",
    opponent: "Opponent",
    notSelected: "Not selected yet",
    scheduled: "Scheduled",
    completed: "Completed",
    finished: "Finished",
    cancelled: "Cancelled",
    postponed: "Postponed",
    unknownStatus: "Unknown status",
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },
  ar: {
    title: "الجدول",
    description: (name?: string | null) =>
      `التمرينات والمباريات الخاصة بـ ${name || "اللاعب"}.`,
    home: "الرئيسية",
    player: "اللاعب",
    group: "المجموعة",
    totalEvents: "إجمالي الأحداث",
    upcoming: "القادمة",
    past: "السابقة",
    trainings: "التمرينات",
    matches: "المباريات",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    selectChild: "اختر اللاعب",
    loading: "جاري تحميل الجدول...",
    loadError: "تعذر تحميل الجدول",
    loadErrorBody: "تحقق من الاتصال ثم حاول تحميل الجدول مرة أخرى.",
    retry: "إعادة المحاولة",
    noEvents: "لا توجد تمرينات أو مباريات حتى الآن.",
    noSelectedDate: "لا توجد أحداث في هذا التاريخ.",
    noUpcoming: "لا توجد تمرينات أو مباريات قادمة.",
    noPast: "لا توجد تمرينات أو مباريات سابقة.",
    selectedDate: "التاريخ المحدد",
    monthOverview: "نظرة الشهر",
    training: "تمرين",
    match: "مباراة",
    location: "المكان",
    coach: "المدرب",
    opponent: "المنافس",
    notSelected: "لم يتم الاختيار بعد",
    scheduled: "مجدول",
    completed: "مكتمل",
    finished: "منتهي",
    cancelled: "ملغي",
    postponed: "مؤجل",
    unknownStatus: "حالة غير محددة",
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
  },
} as const;

type DashboardLanguage = keyof typeof copy;
type ScheduleKind = "training" | "match";

type ScheduleItem = {
  id: string;
  kind: ScheduleKind;
  title: string;
  start: string;
  end: string | null;
  dateKey: string;
  location: string | null;
  status: string;
  groupNames: string[];
  detail: string | null;
  timestamp: number;
};

type CalendarCell = {
  date: Date;
  dateKey: string;
  inMonth: boolean;
};

const weekdayLabels = (locale: string) => {
  const start = new Date(2026, 5, 7);
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
    ),
  );
};

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);

const dayNumber = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);

const monthCells = (visibleMonth: Date): CalendarCell[] => {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      dateKey: localDatePart(date),
      inMonth: date.getMonth() === visibleMonth.getMonth(),
    };
  });
};

const statusVariant = (status: string) => {
  if (status === "cancelled") return "destructive" as const;
  if (status === "postponed") return "warning" as const;
  if (status === "completed" || status === "finished") return "success" as const;
  return "secondary" as const;
};

const statusLabel = (status: string, language: DashboardLanguage) => {
  const labels = copy[language];
  return labels[status as "scheduled" | "completed" | "finished" | "cancelled" | "postponed"] ||
    labels.unknownStatus;
};

const trainingToScheduleItem = (event: CalendarEvent): ScheduleItem => ({
  id: `training:${event.id}`,
  kind: "training",
  title: event.title,
  start: event.start_datetime,
  end: event.end_datetime,
  dateKey: localDatePart(event.start_datetime),
  location: event.location,
  status: event.status,
  groupNames: event.groups?.map((group) => group.name).filter(Boolean) ?? [],
  detail: event.training?.training_focus || null,
  timestamp: new Date(event.start_datetime).getTime(),
});

const matchToScheduleItem = (match: Match): ScheduleItem => {
  const time = normalizeTime24(match.match_time) || "00:00";
  const start = `${localDatePart(match.match_date)}T${time}:00`;
  return {
    id: `match:${match.id}`,
    kind: "match",
    title: match.opponent_name,
    start,
    end: null,
    dateKey: localDatePart(match.match_date),
    location: match.location,
    status: match.match_status || match.status,
    groupNames: match.groups?.map((group) => group.name).filter(Boolean) ?? [],
    detail: match.match_type?.replace(/_/g, " ") || null,
    timestamp: new Date(start).getTime(),
  };
};

function EventIcon({ kind }: { kind: ScheduleKind }) {
  return kind === "match" ? (
    <Trophy className="h-4 w-4" />
  ) : (
    <Dumbbell className="h-4 w-4" />
  );
}

function ScheduleRow({
  item,
  language,
}: {
  item: ScheduleItem;
  language: DashboardLanguage;
}) {
  const t = copy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";

  return (
    <Card className="border-border/40 bg-card">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
                item.kind === "match"
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
                  : "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
              )}
            >
              <EventIcon kind={item.kind} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 text-sm font-semibold sm:text-base">
                  {item.kind === "match" ? `${t.opponent}: ${item.title}` : item.title}
                </h3>
                <Badge variant={item.kind === "match" ? "warning" : "info"}>
                  {item.kind === "match" ? t.match : t.training}
                </Badge>
                <Badge variant={statusVariant(item.status)}>
                  {statusLabel(item.status, language)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(item.start, locale)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime12(item.start, locale)}
                  {item.end ? ` - ${formatTime12(item.end, locale)}` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.location || t.location}
                </span>
                {item.groupNames.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {item.groupNames.join(", ")}
                  </span>
                )}
              </div>
              {item.detail && (
                <p className="mt-3 text-xs capitalize text-muted-foreground">
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventList({
  title,
  items,
  emptyText,
  language,
}: {
  title: string;
  items: ScheduleItem[];
  emptyText: string;
  language: DashboardLanguage;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <ScheduleRow key={item.id} item={item} language={language} />
          ))}
        </div>
      ) : (
        <Card className="border-border/30 bg-card">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default function ParentSchedulePage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const todayKey = localDatePart(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentTime] = useState(() => Date.now());
  const {
    children,
    selectedChild,
    selectedChildId,
    setSelectedChildId,
    isLoading: childrenLoading,
    isError: childrenError,
    refetch: refetchChildren,
  } = useParentSelectedChild();
  const {
    data: trainingData,
    isLoading: trainingsLoading,
    isError: trainingsError,
    refetch: refetchTrainings,
  } = useGetParentChildTrainingsQuery(selectedChildId, { skip: !selectedChildId });
  const {
    data: matchesData,
    isLoading: matchesLoading,
    isError: matchesError,
    refetch: refetchMatches,
  } = useGetParentChildMatchesQuery(selectedChildId, { skip: !selectedChildId });

  const schedule = useMemo(() => {
    const trainings = (trainingData?.data ?? []).map(trainingToScheduleItem);
    const matches = (matchesData?.data ?? []).map(matchToScheduleItem);
    return [...trainings, ...matches].sort((a, b) => a.timestamp - b.timestamp);
  }, [matchesData?.data, trainingData?.data]);

  const eventsByDate = useMemo(() => {
    return schedule.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
      acc[item.dateKey] = acc[item.dateKey] || [];
      acc[item.dateKey].push(item);
      return acc;
    }, {});
  }, [schedule]);

  const upcoming = schedule.filter(
    (item) =>
      item.timestamp >= currentTime &&
      item.status !== "finished" &&
      item.status !== "completed",
  );
  const past = schedule
    .filter(
      (item) =>
        item.timestamp < currentTime ||
        item.status === "finished" ||
        item.status === "completed",
    )
    .sort((a, b) => b.timestamp - a.timestamp);
  const selectedEvents = eventsByDate[selectedDate] ?? [];
  const cells = monthCells(visibleMonth);
  const weekDays = weekdayLabels(locale);
  const trainingCount = schedule.filter((item) => item.kind === "training").length;
  const matchCount = schedule.filter((item) => item.kind === "match").length;
  const isLoading = childrenLoading || trainingsLoading || matchesLoading;
  const isError = childrenError || trainingsError || matchesError;

  const moveMonth = (step: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  };

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description(selectedChild?.full_name)}
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.title },
        ]}
      />

      <ParentChildTabs
        items={children}
        selectedChildId={selectedChildId}
        onSelect={setSelectedChildId}
        ariaLabel={t.selectChild}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border/40 bg-card md:col-span-2">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selectedChild?.full_name || "-"}</p>
              <p className="text-xs text-muted-foreground">{t.player}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-300">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selectedChild?.group_name || t.notSelected}</p>
              <p className="text-xs text-muted-foreground">{selectedChild?.branch_name || t.group}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/10 text-amber-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{schedule.length}</p>
              <p className="text-xs text-muted-foreground">{t.totalEvents}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isError ? (
        <ParentDataError
          title={t.loadError}
          description={t.loadErrorBody}
          retryLabel={t.retry}
          onRetry={() => {
            refetchChildren();
            if (selectedChildId) {
              refetchTrainings();
              refetchMatches();
            }
          }}
        />
      ) : !selectedChildId && !childrenLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noChild}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : schedule.length ? (
        <>
          <Card className="border-border/40 bg-card">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{t.monthOverview}</h2>
                  <p className="text-sm text-muted-foreground">{monthLabel(visibleMonth, locale)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={t.previousMonth}
                    onClick={() => moveMonth(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={t.nextMonth}
                    onClick={() => moveMonth(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                    {weekDays.map((day) => (
                      <div key={day} className="py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {cells.map((cell) => {
                      const items = eventsByDate[cell.dateKey] ?? [];
                      const trainings = items.filter((item) => item.kind === "training").length;
                      const matches = items.filter((item) => item.kind === "match").length;
                      const active = cell.dateKey === selectedDate;
                      const today = cell.dateKey === todayKey;

                      return (
                        <button
                          key={cell.dateKey}
                          type="button"
                          className={cn(
                            "min-h-[88px] rounded-md border border-border/30 bg-muted/10 p-2 text-start transition hover:border-primary/50 hover:bg-primary/5",
                            !cell.inMonth && "opacity-45",
                            active && "border-primary/70 bg-primary/10",
                          )}
                          onClick={() => setSelectedDate(cell.dateKey)}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                              today && "bg-primary text-primary-foreground",
                            )}
                          >
                            {dayNumber(cell.date, locale)}
                          </span>
                          <div className="mt-2 min-h-8 space-y-1">
                            {trainings > 0 && (
                              <span className="flex items-center gap-1 truncate rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                                <Dumbbell className="h-3 w-3 shrink-0" />
                                {trainings}
                              </span>
                            )}
                            {matches > 0 && (
                              <span className="flex items-center gap-1 truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                <Trophy className="h-3 w-3 shrink-0" />
                                {matches}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{t.selectedDate}</h3>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedDate, locale)}</p>
                    </div>
                    <Badge variant="outline">{selectedEvents.length}</Badge>
                  </div>
                  {selectedEvents.length ? (
                    <div className="space-y-3">
                      {selectedEvents.map((item) => (
                        <ScheduleRow key={item.id} item={item} language={language} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                      {t.noSelectedDate}
                    </div>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/40 bg-card">
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{upcoming.length}</p>
                <p className="text-xs text-muted-foreground">{t.upcoming}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card">
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{trainingCount}</p>
                <p className="text-xs text-muted-foreground">{t.trainings}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card">
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{matchCount}</p>
                <p className="text-xs text-muted-foreground">{t.matches}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <EventList
              title={t.upcoming}
              items={upcoming}
              emptyText={t.noUpcoming}
              language={language}
            />
            <EventList
              title={t.past}
              items={past}
              emptyText={t.noPast}
              language={language}
            />
          </div>
        </>
      ) : (
        <Card className="border-border/30 bg-card">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">{t.noEvents}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
