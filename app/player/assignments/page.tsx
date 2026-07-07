"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ClipboardCheck, FileUp, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useGetPlayerAssignmentsQuery,
  useSubmitDailyAiInputMutation,
  useSubmitPlayerAssignmentMutation,
  useUploadPlayerAssignmentFileMutation,
  type PlayerAssignment,
  type PlayerAssignmentUpload,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDateTime } from "@/lib/utils";

const fileAccept =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp";

const sleepOptions = Array.from({ length: 13 }, (_, value) => value);
const mealsOptions = Array.from({ length: 9 }, (_, value) => value);

const formatAssignmentDateTime = (
  value: string | null | undefined,
  fallback: string,
) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : formatDateTime(parsed);
};

const playerAssignmentsCopy = {
  en: {
    statuses: {
      pending: "pending",
      accepted: "accepted",
      needsRedo: "needs redo",
      submitted: "submitted",
    },
    pageTitle: "Assignments",
    pageDescription: "Submit coach assignments and your daily assignment.",
    home: "Home",
    assignments: "Assignments",
    refresh: "Refresh",
    loadError: "Could not load assignments.",
    retry: "Retry",
    dailyAssignment: "Daily Assignment",
    daily: "daily",
    sleepQuestion: "How many hours did you sleep today?",
    trainedQuestion: "Did you train today?",
    mealsQuestion: "How many meals did you eat today?",
    yes: "Yes",
    no: "No",
    submit: "Submit",
    submittedToday: "Submitted today's answer.",
    notSubmittedToday: "You have not submitted today's answer yet.",
    coachAssignments: "Coach Assignments",
    noDescription: "No description",
    coachComment: "Coach comment",
    coach: "Coach",
    opens: "Opens",
    due: "Due",
    now: "now",
    noDeadline: "no deadline",
    accepted: "Accepted",
    resubmit: "Resubmit",
    noCoachAssignments: "No coach assignments are open right now.",
    submitAssignment: "Submit Assignment",
    uploadLabel: "Upload PDF, Word, or Image",
    uploading: "Uploading file...",
    uploaded: "Uploaded {fileName} ({fileType})",
    uploadFailed:
      "Upload failed. Accepted files: PDF, DOC, DOCX, PNG, JPG, JPEG, WEBP.",
    notes: "Notes",
    submitError: "Could not submit this assignment.",
    cancel: "Cancel",
  },
  ar: {
    statuses: {
      pending: "قيد الانتظار",
      accepted: "مقبول",
      needsRedo: "يحتاج إعادة",
      submitted: "تم الإرسال",
    },
    pageTitle: "التكليفات",
    pageDescription: "سلّم تكليفات المدرب والتكليف اليومي.",
    home: "الرئيسية",
    assignments: "التكليفات",
    refresh: "تحديث",
    loadError: "تعذر تحميل التكليفات.",
    retry: "إعادة المحاولة",
    dailyAssignment: "التكليف اليومي",
    daily: "يومي",
    sleepQuestion: "كم ساعة نمت اليوم؟",
    trainedQuestion: "هل تدربت اليوم؟",
    mealsQuestion: "كم وجبة تناولت اليوم؟",
    yes: "نعم",
    no: "لا",
    submit: "إرسال",
    submittedToday: "تم إرسال إجابة اليوم.",
    notSubmittedToday: "لم ترسل إجابة اليوم بعد.",
    coachAssignments: "تكليفات المدرب",
    noDescription: "لا يوجد وصف",
    coachComment: "تعليق المدرب",
    coach: "المدرب",
    opens: "يفتح",
    due: "الموعد",
    now: "الآن",
    noDeadline: "بدون موعد نهائي",
    accepted: "مقبول",
    resubmit: "إعادة الإرسال",
    noCoachAssignments: "لا توجد تكليفات مدرب مفتوحة حاليًا.",
    submitAssignment: "تسليم التكليف",
    uploadLabel: "ارفع PDF أو Word أو صورة",
    uploading: "جاري رفع الملف...",
    uploaded: "تم رفع {fileName} ({fileType})",
    uploadFailed:
      "فشل الرفع. الملفات المقبولة: PDF وDOC وDOCX وPNG وJPG وJPEG وWEBP.",
    notes: "ملاحظات",
    submitError: "تعذر تسليم هذا التكليف.",
    cancel: "إلغاء",
  },
} as const;

type PlayerAssignmentsCopy =
  (typeof playerAssignmentsCopy)[keyof typeof playerAssignmentsCopy];

const assignmentReviewBadge = (
  assignment: PlayerAssignment,
  t: PlayerAssignmentsCopy,
) => {
  if (!assignment.submission)
    return { label: t.statuses.pending, variant: "warning" as const };
  if (assignment.submission.reviewStatus === "approved")
    return { label: t.statuses.accepted, variant: "success" as const };
  if (assignment.submission.reviewStatus === "rejected")
    return { label: t.statuses.needsRedo, variant: "destructive" as const };
  return { label: t.statuses.submitted, variant: "info" as const };
};

export default function PlayerAssignmentsPage() {
  const language = useDashboardLanguage();
  const t = playerAssignmentsCopy[language];
  const assignmentsQuery = useGetPlayerAssignmentsQuery({ limit: 100 });
  const [submitDaily, { isLoading: isSubmittingDaily }] =
    useSubmitDailyAiInputMutation();
  const [uploadFile, { isLoading: isUploading, error: uploadError }] =
    useUploadPlayerAssignmentFileMutation();
  const [
    submitAssignment,
    { isLoading: isSubmittingAssignment, error: submitError },
  ] = useSubmitPlayerAssignmentMutation();
  const [dailyForm, setDailyForm] = useState({
    sleepHours: "8",
    trainedToday: "1",
    mealsCount: "4",
  });
  const [selected, setSelected] = useState<PlayerAssignment | null>(null);
  const [uploaded, setUploaded] = useState<PlayerAssignmentUpload | null>(null);
  const [notes, setNotes] = useState("");

  const assignments = useMemo(
    () => assignmentsQuery.data?.data ?? [],
    [assignmentsQuery.data],
  );
  const dailyAssignment = assignments.find(
    (assignment) => assignment.isSystemDaily,
  );
  const coachTasks = assignments.filter(
    (assignment) => !assignment.isSystemDaily,
  );

  const handleDailySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitDaily({
      sleepHours: Number(dailyForm.sleepHours),
      trainedToday: Number(dailyForm.trainedToday) as 0 | 1,
      mealsCount: Number(dailyForm.mealsCount),
    }).unwrap();
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const result = await uploadFile(file).unwrap();
    setUploaded(result);
  };

  const handleAssignmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !uploaded) return;

    await submitAssignment({
      assignmentId: selected.id,
      notes: notes.trim() || undefined,
      files: [uploaded],
    }).unwrap();

    setSelected(null);
    setUploaded(null);
    setNotes("");
  };

  if (assignmentsQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.assignments },
        ]}
        actions={
          <RefreshButton
            onRefresh={assignmentsQuery.refetch}
            isRefreshing={assignmentsQuery.isFetching}
            label={t.refresh}
          />
        }
      />

      {assignmentsQuery.isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-destructive">
            <span>{t.loadError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => assignmentsQuery.refetch()}
            >
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              {t.dailyAssignment}
            </CardTitle>
            <Badge variant="secondary">{t.daily}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-4 sm:grid-cols-4"
            onSubmit={handleDailySubmit}
          >
            <div className="space-y-2">
              <Label>{t.sleepQuestion}</Label>
              <Select
                value={dailyForm.sleepHours}
                onValueChange={(value) =>
                  setDailyForm((current) => ({ ...current, sleepHours: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sleepOptions.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.trainedQuestion}</Label>
              <Select
                value={dailyForm.trainedToday}
                onValueChange={(value) =>
                  setDailyForm((current) => ({
                    ...current,
                    trainedToday: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t.yes}</SelectItem>
                  <SelectItem value="0">{t.no}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.mealsQuestion}</Label>
              <Select
                value={dailyForm.mealsCount}
                onValueChange={(value) =>
                  setDailyForm((current) => ({ ...current, mealsCount: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mealsOptions.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isSubmittingDaily}
              >
                {isSubmittingDaily && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t.submit}
              </Button>
            </div>
          </form>
          <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
            {dailyAssignment?.submission ? (
              <p>{t.submittedToday}</p>
            ) : (
              <p>{t.notSubmittedToday}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t.coachAssignments}</h2>
          <Badge variant="secondary">{coachTasks.length}</Badge>
        </div>
        <div className="grid gap-3">
          {coachTasks.map((assignment) => (
            <Card key={assignment.id} className="border-border/50 bg-card">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{assignment.title}</h3>
                    <Badge
                      variant={assignmentReviewBadge(assignment, t).variant}
                    >
                      {assignmentReviewBadge(assignment, t).label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {assignment.description || t.noDescription}
                  </p>
                  {assignment.submission?.coachComment && (
                    <div className="mt-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm">
                      <p className="font-medium text-cyan-100">
                        {t.coachComment}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {assignment.submission.coachComment}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {assignment.coachName && (
                      <span>
                        {t.coach} {assignment.coachName}
                      </span>
                    )}
                    <span>
                      {t.opens}{" "}
                      {formatAssignmentDateTime(assignment.openAt, t.now)}
                    </span>
                    <span>
                      {t.due}{" "}
                      {formatAssignmentDateTime(assignment.dueAt, t.noDeadline)}
                    </span>
                    <span>{assignment.acceptedFileTypes.join(", ")}</span>
                  </div>
                </div>
                <Button
                  className="gap-2"
                  variant={assignment.submission ? "outline" : "default"}
                  disabled={assignment.submission?.reviewStatus === "approved"}
                  onClick={() => {
                    setSelected(assignment);
                    setUploaded(null);
                    setNotes("");
                  }}
                >
                  <FileUp className="h-4 w-4" />
                  {assignment.submission?.reviewStatus === "approved"
                    ? t.accepted
                    : assignment.submission
                      ? t.resubmit
                      : t.submit}
                </Button>
              </CardContent>
            </Card>
          ))}
          {!coachTasks.length && (
            <Card className="border-border/50 bg-card">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {t.noCoachAssignments}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setUploaded(null);
            setNotes("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.submitAssignment}</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAssignmentSubmit}>
            {selected?.submission?.coachComment && (
              <div className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm">
                <p className="font-medium text-cyan-100">{t.coachComment}</p>
                <p className="mt-1 text-muted-foreground">
                  {selected.submission.coachComment}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="assignment-file">{t.uploadLabel}</Label>
              <Input
                id="assignment-file"
                type="file"
                accept={fileAccept}
                onChange={(event) => handleUpload(event.target.files?.[0])}
                disabled={isUploading}
                required
              />
              {isUploading && (
                <p className="text-xs text-muted-foreground">{t.uploading}</p>
              )}
              {uploaded && (
                <p className="text-xs text-emerald-400">
                  {t.uploaded
                    .replace("{fileName}", uploaded.fileName)
                    .replace("{fileType}", uploaded.fileType)}
                </p>
              )}
              {uploadError && (
                <p className="text-xs text-red-400">{t.uploadFailed}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-notes">{t.notes}</Label>
              <Textarea
                id="assignment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            {submitError && (
              <p className="text-sm text-red-400">{t.submitError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelected(null)}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={isSubmittingAssignment || isUploading || !uploaded}
              >
                {isSubmittingAssignment && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
