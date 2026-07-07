"use client";

import { useParams } from "next/navigation";
import type { ComponentType } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  Loader2,
  MapPin,
  Star,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useGetPlayerAttendanceQuery,
  useGetPlayerEvaluationsQuery,
  useGetPlayerTrainingsQuery,
} from "@/lib/store/api/calendarApi";
import type { PlayerEvaluationRecord } from "@/lib/store/api/calendarApi";
import { formatDate, formatTime12 } from "@/lib/utils";

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatRating = (value: unknown) => {
  const rating = numberValue(value);
  if (rating === null) return "N/A";
  return `${Number.isInteger(rating) ? rating : rating.toFixed(1)}/10`;
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

function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function TextBlock({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value || "Not set"}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

export default function PlayerTrainingDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const trainingsQuery = useGetPlayerTrainingsQuery();
  const attendanceQuery = useGetPlayerAttendanceQuery();
  const evaluationsQuery = useGetPlayerEvaluationsQuery();

  const training = (trainingsQuery.data?.data ?? []).find(
    (event) => event.id === eventId,
  );
  const attendance = (attendanceQuery.data?.data ?? []).find(
    (record) => record.record_type !== "match" && record.event_id === eventId,
  );
  const evaluation = (evaluationsQuery.data?.data ?? []).find(
    (record) => record.event_id === eventId,
  );
  const isLoading =
    trainingsQuery.isLoading ||
    attendanceQuery.isLoading ||
    evaluationsQuery.isLoading;
  const hasError =
    trainingsQuery.isError ||
    attendanceQuery.isError ||
    evaluationsQuery.isError;
  const publishedRatings = evaluationFields.filter(
    (field) =>
      evaluation?.[field.key] !== null && evaluation?.[field.key] !== undefined,
  );
  const notes = evaluation
    ? [
        { label: "Strengths", value: evaluation.strengths, icon: Star },
        { label: "Weaknesses", value: evaluation.weaknesses, icon: Target },
        {
          label: "Improvement Plan",
          value: evaluation.improvement_plan,
          icon: ClipboardList,
        },
        { label: "Coach Notes", value: evaluation.coach_notes, icon: CheckCircle2 },
        {
          label: "Development Notes",
          value: evaluation.development_notes,
          icon: CheckCircle2,
        },
      ].filter((note) => note.value)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={training?.title || "Training Details"}
        description="Training attendance, timing, plan, and published coach evaluation."
        breadcrumbs={[
          { label: "Home", href: "/player/home" },
          { label: "Training", href: "/player/training" },
          { label: "Details" },
        ]}
      />

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading training details...
          </CardContent>
        </Card>
      ) : hasError ? (
        <Card className="border-red-400/30 bg-red-500/10 shadow-none">
          <CardContent className="p-5 text-sm text-red-100">
            Could not load this training detail. Refresh after the backend is available.
          </CardContent>
        </Card>
      ) : training ? (
        <>
          <Card className="border-white/10 bg-white/[0.045] shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {training.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {formatDate(training.start_datetime)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(training.status)}>
                    {titleCase(training.status)}
                  </Badge>
                  {attendance && (
                    <Badge variant={statusVariant(attendance.status)}>
                      Attendance {titleCase(attendance.status)}
                    </Badge>
                  )}
                  <Badge variant={evaluation ? "success" : "secondary"}>
                    {evaluation ? "Evaluation published" : "Evaluation not published"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoTile
                  label="Start Time"
                  value={formatTime12(training.start_datetime)}
                  icon={Clock}
                />
                <InfoTile
                  label="Finish Time"
                  value={formatTime12(training.end_datetime)}
                  icon={Clock}
                />
                <InfoTile
                  label="Arrival Time"
                  value={formatTime12(attendance?.arrival_time)}
                  icon={CheckCircle2}
                />
                <InfoTile
                  label="Location"
                  value={training.location || "Not set"}
                  icon={MapPin}
                />
              </div>

              {training.training?.original_end_datetime && (
                <p className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                  Original finish: {formatTime12(training.training.original_end_datetime)}
                  {training.training.extended_minutes
                    ? ` - Extended ${training.training.extended_minutes} minutes`
                    : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Dumbbell className="h-4 w-4 text-lime-300" />
                  Training Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <TextBlock
                  label="Focus"
                  value={training.training?.training_focus}
                  icon={Target}
                />
                <TextBlock
                  label="Objectives"
                  value={training.training?.objectives}
                  icon={CheckCircle2}
                />
                <TextBlock
                  label="Session Plan"
                  value={training.training?.session_plan}
                  icon={ClipboardList}
                />
                <TextBlock
                  label="Equipment"
                  value={training.training?.equipment_needed}
                  icon={Dumbbell}
                />
                <TextBlock
                  label="Coach Notes"
                  value={training.training?.coach_notes}
                  icon={Star}
                />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-cyan-300" />
                  Published Evaluation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluation ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-4">
                      <p className="text-xs font-semibold uppercase text-cyan-100/70">
                        Overall
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-cyan-100">
                        {formatRating(evaluation.overall_rating)}
                      </p>
                      <Progress
                        value={ratingProgress(evaluation.overall_rating)}
                        className="mt-3 h-1.5 bg-slate-800"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {publishedRatings.map((field) => (
                        <div
                          key={field.key}
                          className="rounded-lg bg-white/[0.035] p-3"
                        >
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

                    {notes.length > 0 && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {notes.map((note) => (
                          <TextBlock
                            key={note.label}
                            label={note.label}
                            value={note.value}
                            icon={note.icon}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState text="The coach has not published this training evaluation yet." />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/10 bg-white/[0.045] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-amber-300" />
                Attendance Detail
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <InfoTile
                label="Status"
                value={attendance ? titleCase(attendance.status) : "Not recorded"}
                icon={CheckCircle2}
              />
              <InfoTile
                label="Checked In"
                value={formatTime12(attendance?.arrival_time)}
                icon={Clock}
              />
              <InfoTile
                label="Session Finished"
                value={formatTime12(training.end_datetime)}
                icon={Clock}
              />
              {(attendance?.notes || attendance?.reason) && (
                <div className="md:col-span-3">
                  <TextBlock
                    label="Attendance Notes"
                    value={attendance.notes || attendance.reason}
                    icon={ClipboardList}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState text="This training is not visible for your account." />
      )}
    </div>
  );
}
