"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetCoachCalendarEventsQuery } from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12 } from "@/lib/utils";

let trainingClockSnapshot = 0;
const subscribeTrainingClock = (onStoreChange: () => void) => {
  trainingClockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    trainingClockSnapshot = Date.now();
    onStoreChange();
  }, 1000);
  return () => window.clearInterval(intervalId);
};
const getTrainingClockSnapshot = () => trainingClockSnapshot;
const getServerTrainingClockSnapshot = () => 0;

const trainingCopy = {
  en: {
    title: "Training",
    description: "All scheduled and completed training sessions.",
    home: "Home",
    refresh: "Refresh",
    create: "Create Training",
    sessions: "Training Sessions",
    loading: "Loading trainings...",
    loadError:
      "Could not load backend training data. Make sure the backend is running and your coach session is valid.",
    completed: "completed",
    open: "open",
    group: (count: number) => `${count} group${count === 1 ? "" : "s"}`,
    birthYear: (count: number) =>
      `${count} birth year${count === 1 ? "" : "s"}`,
    player: (count: number) => `${count} player${count === 1 ? "" : "s"}`,
    noTarget: "No target snapshot",
    opens: (time: string) => `Opens ${time}`,
    openTraining: "Open Training",
    viewDetails: "View Details",
    empty:
      "No backend training sessions are visible for this coach yet. Create a training event and target one of this coach's assigned groups, birth years, or players.",
  },
  ar: {
    title: "التدريب",
    description: "كل الحصص التدريبية المجدولة والمكتملة.",
    home: "الرئيسية",
    refresh: "تحديث",
    create: "إنشاء تدريب",
    sessions: "حصص التدريب",
    loading: "جاري تحميل التدريبات...",
    loadError:
      "تعذر تحميل بيانات التدريب من الباك إند. تأكد أن الباك إند يعمل وأن جلسة المدرب صالحة.",
    completed: "مكتمل",
    open: "مفتوح",
    group: (count: number) => `${count} مجموعة`,
    birthYear: (count: number) => `${count} سنة ميلاد`,
    player: (count: number) => `${count} لاعب`,
    noTarget: "لا توجد أهداف محددة",
    opens: (time: string) => `يفتح ${time}`,
    openTraining: "فتح التدريب",
    viewDetails: "عرض التفاصيل",
    empty:
      "لا توجد حصص تدريب ظاهرة لهذا المدرب حتى الآن. أنشئ حدث تدريب واستهدف مجموعة أو سنة ميلاد أو لاعبين من نطاق المدرب.",
  },
} as const;

export default function CoachTrainingListPage() {
  const language = useDashboardLanguage();
  const t = trainingCopy[language];
  const { data, isLoading, isError, isFetching, refetch } =
    useGetCoachCalendarEventsQuery();
  const nowMs = useSyncExternalStore(
    subscribeTrainingClock,
    getTrainingClockSnapshot,
    getServerTrainingClockSnapshot,
  );
  const trainings = useMemo(
    () =>
      (data?.data ?? [])
        .filter((event) => event.event_type === "training")
        .sort(
          (a, b) =>
            new Date(b.start_datetime).getTime() -
            new Date(a.start_datetime).getTime(),
        ),
    [data?.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.title },
        ]}
      />

      <div className="flex justify-end">
        <div className="flex flex-wrap gap-2">
          <RefreshButton
            onRefresh={refetch}
            isRefreshing={isFetching}
            label={t.refresh}
          />
          <Button asChild className="gap-2">
            <Link href="/coach/training/create">
              <Plus className="h-4 w-4" />
              {t.create}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t.sessions}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          )}

          {isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {t.loadError}
            </div>
          )}

          {trainings.map((event) => {
            const startMs = Date.parse(event.start_datetime);
            const endMs = Date.parse(event.end_datetime);
            const isOpen =
              event.status === "scheduled" && nowMs >= startMs && nowMs < endMs;
            const isCompleted =
              event.status === "completed" ||
              event.status === "finished" ||
              nowMs >= endMs;
            const isCancelled = event.status === "cancelled";
            const isUpcoming = event.status === "scheduled" && nowMs < startMs;
            const focus = event.training?.training_focus?.replaceAll("_", " ");
            const targetText = [
              event.groups?.length ? t.group(event.groups.length) : "",
              event.birth_years?.length
                ? t.birthYear(event.birth_years.length)
                : "",
              event.players?.length ? t.player(event.players.length) : "",
            ]
              .filter(Boolean)
              .join(" - ");

            return (
              <div
                key={event.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border/50 p-4"
              >
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge
                      variant={
                        isCancelled
                          ? "destructive"
                          : isCompleted
                            ? "success"
                            : isOpen
                              ? "info"
                              : "secondary"
                      }
                    >
                      {isCompleted
                        ? t.completed
                        : isOpen
                          ? t.open
                          : event.status}
                    </Badge>
                    {focus && <Badge variant="outline">{focus}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(event.start_datetime)} -{" "}
                    {formatTime12(event.start_datetime)}
                    {event.location ? ` - ${event.location}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {targetText || t.noTarget}
                  </p>
                </div>
                {isUpcoming ? (
                  <Button size="sm" variant="outline" disabled>
                    {t.opens(formatTime12(event.start_datetime))}
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    variant={isOpen ? "default" : "outline"}
                  >
                    <Link href={`/coach/training/${event.id}`}>
                      {isOpen ? t.openTraining : t.viewDetails}
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}

          {!trainings.length && !isLoading && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t.empty}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
