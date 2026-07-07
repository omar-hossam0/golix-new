"use client";

import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Loader2,
  Star,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import {
  useGetPlayerAttendanceQuery,
  useGetPlayerEvaluationsQuery,
  useGetPlayerTrainingsQuery,
} from "@/lib/store/api/calendarApi";
import type { CalendarEvent } from "@/lib/store/api/calendarApi";
import { formatDate, formatTime12 } from "@/lib/utils";

const eventTimestamp = (event: CalendarEvent) => {
  const timestamp = Date.parse(event.start_datetime ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const titleCase = (value: string | null | undefined) =>
  (value || "Not set")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const statusVariant = (status: string) => {
  if (["present", "completed", "finished"].includes(status)) return "success" as const;
  if (["scheduled"].includes(status)) return "info" as const;
  if (["late", "excused", "postponed"].includes(status)) return "warning" as const;
  if (["absent", "injured", "cancelled"].includes(status)) return "destructive" as const;
  return "secondary" as const;
};

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatRating = (value: unknown, fallback = "N/A") => {
  const rating = numberValue(value);
  if (rating === null) return fallback;
  return `${Number.isInteger(rating) ? rating : rating.toFixed(1)}/10`;
};

const trainingHistoryCopy = {
  en: {
    title: "Training History",
    description: "Past and upcoming sessions visible for you, with attendance and published evaluations.",
    home: "Home",
    training: "Training",
    history: "History",
    loading: "Loading training history...",
    focus: "Focus",
    attendance: "Attendance",
    evaluation: "Evaluation",
    notRecorded: "Not recorded",
    notPublished: "Not published",
    viewDetails: "View details",
    empty: "No training sessions are visible for you yet.",
    noValue: "N/A",
    statuses: {
      present: "Present",
      completed: "Completed",
      finished: "Finished",
      scheduled: "Scheduled",
      late: "Late",
      excused: "Excused",
      postponed: "Postponed",
      absent: "Absent",
      injured: "Injured",
      cancelled: "Cancelled",
    },
  },
  ar: {
    title: "سجل التدريب",
    description: "الحصص السابقة والقادمة الظاهرة لك مع الحضور والتقييمات المنشورة.",
    home: "الرئيسية",
    training: "التدريب",
    history: "السجل",
    loading: "جاري تحميل سجل التدريب...",
    focus: "التركيز",
    attendance: "الحضور",
    evaluation: "التقييم",
    notRecorded: "غير مسجل",
    notPublished: "غير منشور",
    viewDetails: "عرض التفاصيل",
    empty: "لا توجد حصص تدريب ظاهرة لك حتى الآن.",
    noValue: "غير متاح",
    statuses: {
      present: "حاضر",
      completed: "مكتمل",
      finished: "منتهي",
      scheduled: "مجدول",
      late: "متأخر",
      excused: "بعذر",
      postponed: "مؤجل",
      absent: "غائب",
      injured: "مصاب",
      cancelled: "ملغي",
    },
  },
} as const;

export default function PlayerTrainingHistoryPage() {
  const language = useDashboardLanguage();
  const t = trainingHistoryCopy[language];
  const statusLabel = (status: string) =>
    t.statuses[status as keyof typeof t.statuses] ?? titleCase(status);
  const trainingsQuery = useGetPlayerTrainingsQuery();
  const attendanceQuery = useGetPlayerAttendanceQuery();
  const evaluationsQuery = useGetPlayerEvaluationsQuery();
  const trainings = (trainingsQuery.data?.data ?? [])
    .slice()
    .sort((a, b) => eventTimestamp(b) - eventTimestamp(a));
  const attendanceByEvent = new Map(
    (attendanceQuery.data?.data ?? []).map((record) => [record.event_id, record]),
  );
  const evaluationByEvent = new Map(
    (evaluationsQuery.data?.data ?? []).map((record) => [record.event_id, record]),
  );
  const isLoading =
    trainingsQuery.isLoading ||
    attendanceQuery.isLoading ||
    evaluationsQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.training, href: "/player/training" },
          { label: t.history },
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
        <div className="space-y-3">
          {trainings.map((session) => {
            const attendance = attendanceByEvent.get(session.id);
            const evaluation = evaluationByEvent.get(session.id);
            return (
              <Card
                key={session.id}
                className="border-white/10 bg-white/[0.045] shadow-none"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-lime-400/10 text-lime-200">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">
                            {session.title}
                          </h3>
                          <Badge variant={statusVariant(session.status)}>
                            {statusLabel(session.status)}
                          </Badge>
                          {attendance && (
                            <Badge variant={statusVariant(attendance.status)}>
                              {titleCase(attendance.status)}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(session.start_datetime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime12(session.start_datetime)} -{" "}
                            {formatTime12(session.end_datetime)}
                          </span>
                        </div>
                        {session.training?.training_focus && (
                          <p className="mt-2 text-sm text-slate-300">
                            {t.focus}: {session.training.training_focus}
                          </p>
                        )}
                        {(attendance?.notes || attendance?.reason) && (
                          <p className="mt-1 text-sm text-slate-400">
                            {attendance.notes || attendance.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        {t.attendance} {attendance ? statusLabel(attendance.status) : t.notRecorded}
                      </Badge>
                      <Badge variant={evaluation ? "info" : "secondary"}>
                        <Star className="mr-1 h-3.5 w-3.5" />
                        {t.evaluation} {evaluation ? formatRating(evaluation.overall_rating, t.noValue) : t.notPublished}
                      </Badge>
                      <Link
                        href={`/player/training/${session.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                      >
                        {t.viewDetails}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!trainings.length && (
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-8 text-center text-slate-400">
                {t.empty}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
