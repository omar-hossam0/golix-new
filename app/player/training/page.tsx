"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Dumbbell,
  HeartPulse,
  Loader2,
  MapPin,
  Star,
  Target,
} from "lucide-react";
import { PlayerAttendanceQrPrompt } from "@/components/attendance/PlayerAttendanceQrPrompt";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useGetPlayerAttendanceQuery,
  useGetPlayerAttendanceQrQuery,
  useGetPlayerEvaluationsQuery,
  useGetPlayerTrainingsQuery,
} from "@/lib/store/api/calendarApi";
import type {
  CalendarEvent,
  PlayerAttendanceRecord,
  PlayerEvaluationRecord,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { cn, formatDate, formatTime12 } from "@/lib/utils";

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

let playerTrainingClockSnapshot = 0;
const subscribePlayerTrainingClock = (onStoreChange: () => void) => {
  playerTrainingClockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    playerTrainingClockSnapshot = Date.now();
    onStoreChange();
  }, 1000);
  return () => window.clearInterval(intervalId);
};
const getPlayerTrainingClockSnapshot = () => playerTrainingClockSnapshot;
const getServerPlayerTrainingClockSnapshot = () => 0;

const QR_WINDOW_MS = 15 * 60 * 1000;

const formatRating = (value: unknown) => {
  const rating = numberValue(value);
  if (rating === null) return "N/A";
  return `${Number.isInteger(rating) ? rating : rating.toFixed(1)}/10`;
};

const safeDate = (value: string | null | undefined) => {
  if (!value) return "Not set";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return formatDate(value);
};

const ratingProgress = (value: unknown) => {
  const rating = numberValue(value);
  return rating === null ? 0 : Math.max(0, Math.min(100, rating * 10));
};

const titleCase = (value: string | null | undefined) =>
  (value || "Not set")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const eventTimestamp = (event: CalendarEvent | PlayerEvaluationRecord | PlayerAttendanceRecord) => {
  const raw = event.start_datetime;
  const timestamp = Date.parse(raw ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const statusVariant = (status: string) => {
  if (["present", "completed", "finished"].includes(status)) return "success" as const;
  if (["scheduled"].includes(status)) return "info" as const;
  if (["late", "excused", "postponed"].includes(status)) return "warning" as const;
  if (["absent", "injured", "cancelled"].includes(status)) return "destructive" as const;
  return "secondary" as const;
};

const evaluationFields: Array<{
  key: keyof PlayerEvaluationRecord;
  label: string;
}> = [
  { key: "overall_rating", label: "Overall" },
  { key: "technical_rating", label: "Technical" },
  { key: "tactical_rating", label: "Tactical" },
  { key: "physical_rating", label: "Physical" },
  { key: "fatigue_rating", label: "Fatigue" },
  { key: "mentality_rating", label: "Mentality" },
  { key: "discipline_rating", label: "Discipline" },
  { key: "teamwork_rating", label: "Teamwork" },
  { key: "impact_rating", label: "Impact" },
  { key: "ball_control_rating", label: "Ball Control" },
  { key: "passing_accuracy_rating", label: "Passing Accuracy" },
  { key: "shooting_rating", label: "Shooting" },
  { key: "dribbling_rating", label: "Dribbling" },
  { key: "receiving_under_pressure_rating", label: "Receiving Under Pressure" },
  { key: "speed_rating", label: "Speed" },
  { key: "endurance_rating", label: "Endurance" },
  { key: "strength_rating", label: "Strength" },
  { key: "agility_rating", label: "Agility" },
];

const playerTrainingCopy = {
  en: {
    title: "My Training",
    description:
      "Your upcoming sessions, training plans, attendance, and coach evaluations.",
    home: "Home",
    training: "Training",
    loading: "Loading your training data...",
    trainingEvaluation: "Training evaluation",
    coachEvaluation: "Coach Evaluation",
    overall: "Overall",
    noEvaluation: "No player-visible training evaluation has been published yet.",
  },
  ar: {
    title: "تدريبي",
    description: "حصصك القادمة وخطط التدريب والحضور وتقييمات المدرب.",
    home: "الرئيسية",
    training: "التدريب",
    loading: "جاري تحميل بيانات التدريب...",
    trainingEvaluation: "تقييم التدريب",
    coachEvaluation: "تقييم المدرب",
    overall: "الإجمالي",
    noEvaluation: "لا يوجد تقييم تدريب منشور للاعب حتى الآن.",
  },
} as const;

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function DetailBlock({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-200">
        {value || "Not set"}
      </p>
    </div>
  );
}

function EvaluationCard({
  evaluation,
  copy,
}: {
  evaluation: PlayerEvaluationRecord;
  copy: (typeof playerTrainingCopy)[keyof typeof playerTrainingCopy];
}) {
  const visibleRatings = evaluationFields.filter(
    (field) => evaluation[field.key] !== null && evaluation[field.key] !== undefined,
  );

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">
                {evaluation.title || copy.trainingEvaluation}
              </h3>
              <Badge variant="info">{copy.coachEvaluation}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {safeDate(evaluation.start_datetime)}
            </p>
          </div>
          <div className="rounded-lg bg-cyan-400/10 px-4 py-2 text-center text-cyan-100">
            <p className="text-xl font-semibold">
              {formatRating(evaluation.overall_rating)}
            </p>
            <p className="text-xs text-cyan-200/80">{copy.overall}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRatings.map((field) => (
            <div key={field.key} className="rounded-lg bg-white/[0.035] p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-400">{field.label}</span>
                <span className="font-semibold text-white">
                  {formatRating(evaluation[field.key])}
                </span>
              </div>
              <Progress
                value={ratingProgress(evaluation[field.key])}
                className="h-1.5 bg-slate-800"
              />
            </div>
          ))}
        </div>

        {(evaluation.strengths ||
          evaluation.weaknesses ||
          evaluation.improvement_plan ||
          evaluation.coach_notes ||
          evaluation.development_notes) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {evaluation.strengths && (
              <DetailBlock
                label="Strengths"
                value={evaluation.strengths}
                icon={Star}
              />
            )}
            {evaluation.weaknesses && (
              <DetailBlock
                label="Weaknesses"
                value={evaluation.weaknesses}
                icon={Target}
              />
            )}
            {evaluation.improvement_plan && (
              <DetailBlock
                label="Improvement Plan"
                value={evaluation.improvement_plan}
                icon={ClipboardList}
              />
            )}
            {evaluation.coach_notes && (
              <DetailBlock
                label="Coach Notes"
                value={evaluation.coach_notes}
                icon={CheckCircle2}
              />
            )}
            {evaluation.development_notes && (
              <DetailBlock
                label="Development Notes"
                value={evaluation.development_notes}
                icon={CheckCircle2}
              />
            )}
          </div>
        )}
    </div>
  );
}

export default function PlayerTrainingPage() {
  const language = useDashboardLanguage();
  const copy = playerTrainingCopy[language];
  const nowMs = useSyncExternalStore(
    subscribePlayerTrainingClock,
    getPlayerTrainingClockSnapshot,
    getServerPlayerTrainingClockSnapshot,
  );
  const attendanceQrQuery = useGetPlayerAttendanceQrQuery();
  const trainingsQuery = useGetPlayerTrainingsQuery();
  const evaluationsQuery = useGetPlayerEvaluationsQuery();
  const attendanceQuery = useGetPlayerAttendanceQuery();

  const trainings = trainingsQuery.data?.data ?? [];
  const evaluations = evaluationsQuery.data?.data ?? [];
  const attendance = (attendanceQuery.data?.data ?? []).filter(
    (record) => record.record_type !== "match",
  );
  const isLoading =
    trainingsQuery.isLoading ||
    evaluationsQuery.isLoading ||
    attendanceQuery.isLoading;

  const upcomingTrainings = trainings
    .filter((event) => !["completed", "finished", "cancelled"].includes(event.status))
    .sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  const pastTrainings = trainings
    .filter((event) => ["completed", "finished"].includes(event.status))
    .sort((a, b) => eventTimestamp(b) - eventTimestamp(a))
    .slice(0, 6);
  const latestEvaluation = evaluations[0];
  const latestAttendance = attendance[0];
  const attended = attendance.filter((record) =>
    ["present", "late"].includes(record.status),
  ).length;
  const attendanceRate = attendance.length
    ? Math.round((attended / attendance.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        breadcrumbs={[
          { label: copy.home, href: "/player/home" },
          { label: copy.training },
        ]}
      />

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Latest Overall
                </p>
                <p className="mt-2 text-3xl font-semibold text-cyan-100">
                  {formatRating(latestEvaluation?.overall_rating)}
                </p>
                <Progress
                  value={ratingProgress(latestEvaluation?.overall_rating)}
                  className="mt-3 h-1.5 bg-slate-800"
                />
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Attendance
                </p>
                <p className="mt-2 text-3xl font-semibold text-lime-100">
                  {attendanceRate}%
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {attended}/{attendance.length} sessions attended
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Latest Status
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={statusVariant(latestAttendance?.status || "")}>
                    {titleCase(latestAttendance?.status)}
                  </Badge>
                  <span className="text-sm text-slate-400">
                    {latestAttendance?.title || "No attendance yet"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Dumbbell className="h-4 w-4 text-lime-300" />
                  Upcoming Training Plans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingTrainings.length ? (
                  upcomingTrainings.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
                    >
                      {nowMs >= eventTimestamp(event) - QR_WINDOW_MS &&
                        nowMs < Date.parse(event.end_datetime) &&
                        event.status === "scheduled" && (
                          <PlayerAttendanceQrPrompt
                            kind="training"
                            title={event.title}
                            startsAt={event.start_datetime}
                            qr={attendanceQrQuery.data}
                            attendanceStatus={event.attendance?.[0]?.status}
                            className="mb-4"
                          />
                        )}

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">
                              {event.title}
                            </h3>
                            <Badge variant={statusVariant(event.status)}>
                              {titleCase(event.status)}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-4 w-4" />
                              {formatDate(event.start_datetime)}
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
                        <Badge variant="outline">
                          {titleCase(event.training?.intensity_level)}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <DetailBlock
                          label="Focus"
                          value={event.training?.training_focus}
                          icon={Target}
                        />
                        <DetailBlock
                          label="Objectives"
                          value={event.training?.objectives}
                          icon={CheckCircle2}
                        />
                        <DetailBlock
                          label="Session Plan"
                          value={event.training?.session_plan}
                          icon={ClipboardList}
                        />
                        <DetailBlock
                          label="Equipment"
                          value={event.training?.equipment_needed}
                          icon={Dumbbell}
                        />
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Link
                          href={`/player/training/${event.id}`}
                          className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                        >
                          View details
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState text="No upcoming training is visible for you yet." />
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HeartPulse className="h-4 w-4 text-cyan-300" />
                  Latest Training Evaluation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latestEvaluation ? (
                  <EvaluationCard evaluation={latestEvaluation} copy={copy} />
                ) : (
                  <EmptyState text={copy.noEvaluation} />
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-amber-300" />
                  Recent Training History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pastTrainings.length ? (
                  pastTrainings.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{event.title}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {formatDate(event.start_datetime)} |{" "}
                            {formatTime12(event.start_datetime)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge variant={statusVariant(event.status)}>
                            {titleCase(event.status)}
                          </Badge>
                          <Link
                            href={`/player/training/${event.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08]"
                          >
                            View details
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState text="No completed training sessions yet." />
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-cyan-300" />
                  All Published Evaluations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evaluations.length ? (
                  evaluations.map((evaluation) => (
                    <div
                      key={evaluation.id}
                      className={cn(
                        "rounded-lg border border-white/10 bg-white/[0.035] p-4",
                        evaluation.id === latestEvaluation?.id && "border-cyan-300/30",
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">
                            {evaluation.title || "Training evaluation"}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {safeDate(evaluation.start_datetime)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="info">
                            Overall {formatRating(evaluation.overall_rating)}
                          </Badge>
                          <Badge variant="outline">
                            Fatigue {formatRating(evaluation.fatigue_rating)}
                          </Badge>
                          <Link
                            href={`/player/training/${evaluation.event_id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                          >
                            View details
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState text="No evaluations have been published yet." />
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
