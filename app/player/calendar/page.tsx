"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Loader2,
  MapPin,
  ShieldCheck,
  Target,
  Trophy,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGetPlayerCalendarEventsQuery,
  useGetPlayerMatchesQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import type { CalendarEvent, Match } from "@/lib/store/api/calendarApi";
import { cn, formatTime12, localDatePart, localDateTimeTimestamp } from "@/lib/utils";

type DashboardLanguage = "en" | "ar";

const labelMaps: Record<DashboardLanguage, Record<string, string>> = {
  en: {
    absent: "Absent",
    cancelled: "Cancelled",
    completed: "Completed",
    finished: "Finished",
    injured: "Injured",
    late: "Late",
    match: "Match",
    postponed: "Postponed",
    present: "Present",
    reserve: "Reserve",
    scheduled: "Scheduled",
    starter: "Starter",
    substitute: "Substitute",
    training: "Training",
  },
  ar: {
    absent: "غائب",
    cancelled: "ملغي",
    completed: "مكتمل",
    finished: "منتهي",
    injured: "مصاب",
    late: "متأخر",
    match: "مباراة",
    postponed: "مؤجل",
    present: "حاضر",
    reserve: "احتياطي",
    scheduled: "مجدول",
    starter: "أساسي",
    substitute: "بديل",
    training: "تدريب",
  },
};

const titleCase = (
  value: string | null | undefined,
  language: DashboardLanguage,
  fallback: string,
) => {
  if (!value) return fallback;
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  const mapped = labelMaps[language][normalized];
  if (mapped) return mapped;
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const calendarCopy = {
  en: {
    pageTitle: "Calendar",
    pageDescription:
      "Your visible academy events, training sessions, match reminders, and published plans.",
    home: "Home",
    calendar: "Calendar",
    loading: "Loading calendar...",
    monthOverview: "Month Overview",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    selectedDate: "Selected Date",
    noItemsOnDate: "No training or matches on this date.",
    focus: "Focus",
    intensity: "Intensity",
    notSet: "Not set",
    notSelected: "Not selected",
    notAssigned: "Not assigned",
    yourPosition: "Your Position",
    formation: "Formation",
    yourInstructions: "Your Instructions",
    tacticalNotes: "Tactical Notes",
    unpublishedPlan: "Match configuration has not been published for you yet.",
    upcomingAgenda: "Upcoming Agenda",
    noUpcoming: "No upcoming calendar events are visible for you yet.",
    matchReminders: "Match Reminders",
    noReminders: "No match reminders yet.",
    recentEvents: "Recent Events",
    noRecent: "No recent events yet.",
  },
  ar: {
    pageTitle: "التقويم",
    pageDescription:
      "أحداث الأكاديمية الظاهرة لك، حصص التدريب، تذكيرات المباريات، والخطط المنشورة.",
    home: "الرئيسية",
    calendar: "التقويم",
    loading: "جاري تحميل التقويم...",
    monthOverview: "نظرة الشهر",
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    selectedDate: "التاريخ المحدد",
    noItemsOnDate: "لا توجد تدريبات أو مباريات في هذا التاريخ.",
    focus: "التركيز",
    intensity: "الشدة",
    notSet: "غير محدد",
    notSelected: "لم يتم الاختيار",
    notAssigned: "غير معين",
    yourPosition: "مركزك",
    formation: "الخطة",
    yourInstructions: "تعليماتك",
    tacticalNotes: "ملاحظات تكتيكية",
    unpublishedPlan: "لم يتم نشر إعدادات المباراة لك بعد.",
    upcomingAgenda: "الأجندة القادمة",
    noUpcoming: "لا توجد أحداث قادمة ظاهرة لك حتى الآن.",
    matchReminders: "تذكيرات المباريات",
    noReminders: "لا توجد تذكيرات مباريات بعد.",
    recentEvents: "الأحداث الأخيرة",
    noRecent: "لا توجد أحداث حديثة بعد.",
  },
} as const;

type CalendarCopy = (typeof calendarCopy)[DashboardLanguage];

const localeFor = (language: DashboardLanguage) =>
  language === "ar" ? "ar-EG" : "en-US";

const formatCalendarDate = (value: string | Date, language: DashboardLanguage) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const eventTimestamp = (event: CalendarEvent) => {
  const timestamp = Date.parse(event.start_datetime ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const matchTimestamp = (match: Match) => {
  const timestamp = localDateTimeTimestamp(match.match_date, match.match_time);
  if (timestamp) return timestamp;
  return Date.parse(`${match.match_date}T00:00:00`) || 0;
};

type MonthItem = {
  id: string;
  kind: "training" | "match";
  title: string;
  dateKey: string;
  start: string;
  location: string | null;
  status: string;
};

type MonthCell = {
  date: Date;
  dateKey: string;
  inMonth: boolean;
};

const statusVariant = (status: string) => {
  if (["completed", "finished", "present", "starter"].includes(status)) {
    return "success" as const;
  }
  if (["scheduled", "substitute", "reserve"].includes(status)) {
    return "info" as const;
  }
  if (["postponed", "late"].includes(status)) return "warning" as const;
  if (["cancelled", "absent", "injured"].includes(status)) {
    return "destructive" as const;
  }
  return "secondary" as const;
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const Icon = type === "training" ? Dumbbell : type === "match" ? Trophy : CalendarDays;
  return (
    <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-200">
      <Icon className="h-5 w-5" />
    </div>
  );
}

const monthCells = (visibleMonth: Date): MonthCell[] => {
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

const weekdayLabels = (language: DashboardLanguage) => {
  const start = new Date(2026, 5, 7);
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(localeFor(language), { weekday: "short" }).format(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
    ),
  );
};

const monthLabel = (date: Date, language: DashboardLanguage) =>
  new Intl.DateTimeFormat(localeFor(language), {
    month: "long",
    year: "numeric",
  }).format(date);

function MonthOverview({
  items,
  language,
  copy,
}: {
  items: MonthItem[];
  language: DashboardLanguage;
  copy: CalendarCopy;
}) {
  const [todayKey] = useState(() => localDatePart(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const cells = monthCells(visibleMonth);
  const weekDays = weekdayLabels(language);
  const eventsByDate = useMemo(
    () =>
      items.reduce<Record<string, MonthItem[]>>((acc, item) => {
        acc[item.dateKey] = acc[item.dateKey] || [];
        acc[item.dateKey].push(item);
        return acc;
      }, {}),
    [items],
  );
  const selectedItems = eventsByDate[selectedDate] ?? [];

  const moveMonth = (step: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  };

  return (
    <Card className="border-white/10 bg-white/[0.045] shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{copy.monthOverview}</h2>
            <p className="text-sm text-slate-400">{monthLabel(visibleMonth, language)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={copy.previousMonth}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={copy.nextMonth}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500">
              {weekDays.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const dayItems = eventsByDate[cell.dateKey] ?? [];
                const trainings = dayItems.filter((item) => item.kind === "training").length;
                const matches = dayItems.filter((item) => item.kind === "match").length;
                const active = cell.dateKey === selectedDate;
                const today = cell.dateKey === todayKey;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    className={cn(
                      "min-h-[88px] rounded-lg border border-white/10 bg-white/[0.025] p-2 text-start transition hover:border-cyan-300/45 hover:bg-cyan-300/5",
                      !cell.inMonth && "opacity-45",
                      active && "border-cyan-300/60 bg-cyan-300/10",
                    )}
                    onClick={() => setSelectedDate(cell.dateKey)}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-slate-200",
                        today && "bg-cyan-300 text-[#06111f]",
                      )}
                    >
                      {new Intl.DateTimeFormat(localeFor(language), { day: "numeric" }).format(cell.date)}
                    </span>
                    <div className="mt-2 min-h-8 space-y-1">
                      {trainings > 0 && (
                        <span className="flex items-center gap-1 truncate rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                          <Dumbbell className="h-3 w-3 shrink-0" />
                          {trainings}
                        </span>
                      )}
                      {matches > 0 && (
                        <span className="flex items-center gap-1 truncate rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
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
                <h3 className="text-sm font-semibold text-white">{copy.selectedDate}</h3>
                <p className="text-xs text-slate-400">{formatCalendarDate(selectedDate, language)}</p>
              </div>
              <Badge variant="outline">{selectedItems.length}</Badge>
            </div>
            {selectedItems.length ? (
              <div className="space-y-3">
                {selectedItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.kind === "match" ? "warning" : "info"}>
                            {titleCase(item.kind, language, copy.notSet)}
                          </Badge>
                          <Badge variant={statusVariant(item.status)}>
                            {titleCase(item.status, language, copy.notSet)}
                          </Badge>
                        </div>
                        <p className="mt-2 font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatTime12(item.start)}
                          {item.location ? ` | ${item.location}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text={copy.noItemsOnDate} />
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCard({
  event,
  language,
  copy,
}: {
  event: CalendarEvent;
  language: DashboardLanguage;
  copy: CalendarCopy;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <EventIcon type={event.event_type} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">{event.title}</h3>
              <Badge variant="outline">
                {titleCase(event.event_type, language, copy.notSet)}
              </Badge>
              <Badge variant={statusVariant(event.status)}>
                {titleCase(event.status, language, copy.notSet)}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <CalendarClock className="h-4 w-4" />
                {formatCalendarDate(event.start_datetime, language)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTime12(event.start_datetime)}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {event.training && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-white/[0.035] p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <Target className="h-4 w-4" />
              {copy.focus}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {event.training.training_focus || copy.notSet}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.035] p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              {copy.intensity}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {titleCase(event.training.intensity_level, language, copy.notSet)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchReminder({
  match,
  language,
  copy,
}: {
  match: Match;
  language: DashboardLanguage;
  copy: CalendarCopy;
}) {
  const squad = match.squad?.[0];
  const hasPlan = Boolean(match.tactics || squad);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{match.opponent_name}</h3>
            <Badge variant={statusVariant(match.status)}>
              {titleCase(match.status, language, copy.notSet)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {formatCalendarDate(match.match_date, language)} | {formatTime12(match.match_time)}
            {match.location ? ` | ${match.location}` : ""}
          </p>
        </div>
        <Badge variant={squad ? statusVariant(squad.squad_role) : "secondary"}>
          {squad
            ? titleCase(squad.squad_role, language, copy.notSet)
            : copy.notSelected}
        </Badge>
      </div>

      {hasPlan ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-cyan-400/10 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-200">
                <UserCheck className="h-4 w-4" />
                {copy.yourPosition}
              </p>
              <p className="mt-2 font-semibold text-white">
                {squad?.position || copy.notAssigned}
              </p>
            </div>
            <div className="rounded-lg bg-lime-400/10 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-lime-200">
                <ShieldCheck className="h-4 w-4" />
                {copy.formation}
              </p>
              <p className="mt-2 font-semibold text-white">
                {match.tactics?.formation || copy.notSet}
              </p>
            </div>
          </div>
          {(squad?.player_instruction || match.tactics?.tactical_notes) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {squad?.player_instruction && (
                <div className="rounded-lg bg-cyan-400/10 p-3">
                  <p className="text-xs font-semibold uppercase text-cyan-200">
                    {copy.yourInstructions}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {squad.player_instruction}
                  </p>
                </div>
              )}
              {match.tactics?.tactical_notes && (
                <div className="rounded-lg bg-lime-400/10 p-3">
                  <p className="text-xs font-semibold uppercase text-lime-200">
                    {copy.tacticalNotes}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {match.tactics.tactical_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-white/[0.035] p-3 text-sm text-slate-400">
          {copy.unpublishedPlan}
        </p>
      )}
    </div>
  );
}

export default function PlayerCalendarPage() {
  const language = useDashboardLanguage();
  const t = calendarCopy[language];
  const eventsQuery = useGetPlayerCalendarEventsQuery();
  const matchesQuery = useGetPlayerMatchesQuery();
  const events = (eventsQuery.data?.data ?? [])
    .slice()
    .sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  const matches = (matchesQuery.data?.data ?? [])
    .slice()
    .sort((a, b) => matchTimestamp(a) - matchTimestamp(b));
  const isLoading = eventsQuery.isLoading || matchesQuery.isLoading;
  const monthItems: MonthItem[] = [
    ...events
      .filter((event) => event.event_type === "training" || event.event_type === "match")
      .map((event) => ({
        id: `event:${event.id}`,
        kind: event.event_type === "match" ? "match" as const : "training" as const,
        title: event.title,
        dateKey: localDatePart(event.start_datetime),
        start: event.start_datetime,
        location: event.location,
        status: event.status,
      })),
    ...matches.map((match) => {
      const timestamp = matchTimestamp(match);
      const start = timestamp ? new Date(timestamp).toISOString() : `${match.match_date}T00:00:00`;
      return {
        id: `match:${match.id}`,
        kind: "match" as const,
        title: match.opponent_name,
        dateKey: localDatePart(match.match_date),
        start,
        location: match.location,
        status: match.status,
      };
    }),
  ];

  const upcomingEvents = events.filter(
    (event) => !["completed", "finished", "cancelled"].includes(event.status),
  );
  const pastEvents = events
    .filter((event) => ["completed", "finished"].includes(event.status))
    .slice()
    .reverse()
    .slice(0, 8);
  const matchReminders = matches
    .filter((match) => !["completed", "finished", "cancelled"].includes(match.status))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.calendar },
        ]}
      />

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <MonthOverview items={monthItems} language={language} copy={t} />

          <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.upcomingAgenda}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.length ? (
                  upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      language={language}
                      copy={t}
                    />
                  ))
                ) : (
                  <EmptyState text={t.noUpcoming} />
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-white/10 bg-white/[0.045] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t.matchReminders}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {matchReminders.length ? (
                    matchReminders.map((match) => (
                      <MatchReminder
                        key={match.id}
                        match={match}
                        language={language}
                        copy={t}
                      />
                    ))
                  ) : (
                    <EmptyState text={t.noReminders} />
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.045] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t.recentEvents}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pastEvents.length ? (
                    pastEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] p-3"
                      >
                        <div>
                          <p className="font-medium text-white">{event.title}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {formatCalendarDate(event.start_datetime, language)}
                          </p>
                        </div>
                        <Badge variant={statusVariant(event.status)}>
                          {titleCase(event.status, language, t.notSet)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <EmptyState text={t.noRecent} />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
