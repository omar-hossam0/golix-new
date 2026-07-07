"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MonthCalendar } from "@/components/shared/MonthCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useGetGroupsQuery } from "@/lib/store/api/adminApi";
import {
  type CalendarEvent,
  type Match,
  useCreateAdminCalendarEventMutation,
  useGetAdminCalendarEventsQuery,
  useGetAdminMatchesQuery,
  useHardDeleteAdminMatchMutation,
  useHardDeleteAdminTrainingEventMutation,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12 } from "@/lib/utils";

const eventTypes = [
  "training",
  "match",
  "fitness_test",
  "meeting",
  "rest_day",
  "tournament",
  "medical_check",
  "assessment_day",
] as const;

const getApiMessage = (error: unknown, fallback: string) => {
  const apiError = error as {
    data?: {
      message?: string;
      errors?: Array<{ message?: string }>;
      error?: { message?: string; details?: Array<{ message?: string }> };
    };
  };
  return (
    apiError.data?.error?.details?.[0]?.message ??
    apiError.data?.errors?.[0]?.message ??
    apiError.data?.error?.message ??
    apiError.data?.message ??
    fallback
  );
};

const calendarCopy = {
  en: {
    eventTypes: {
      training: "Training",
      match: "Match",
      fitness_test: "Fitness test",
      meeting: "Meeting",
      rest_day: "Rest day",
      tournament: "Tournament",
      medical_check: "Medical check",
      assessment_day: "Assessment day",
    } satisfies Record<(typeof eventTypes)[number], string>,
    statuses: {
      scheduled: "Scheduled",
      completed: "Completed",
      cancelled: "Cancelled",
      finished: "Finished",
    },
    pageTitle: "Main Calendar",
    pageDescription: "Academy-wide calendar events across groups.",
    dashboard: "Dashboard",
    calendar: "Calendar",
    addEvent: "Add Event",
    createCalendarEvent: "Create Calendar Event",
    title: "Title",
    type: "Type",
    starts: "Starts",
    ends: "Ends",
    group: "Group",
    coachesOnlyOrGroup: "Coaches only or select group",
    coachesOnly: "Coaches only",
    location: "Location",
    notes: "Notes",
    create: "Create",
    deleteTrainingTitle: "Delete Training Forever",
    deleteTrainingDescription: "This permanently removes the training event, targets, attendance, evaluations, notifications, and affected injury-risk outputs. Type {phrase} to confirm.",
    deleteMatchTitle: "Delete Match Forever",
    deleteMatchDescription: "This permanently removes the match, calendar event, squad, tactics, attendance, incidents, goals, substitutions, and player stats. Type {phrase} to confirm.",
    confirmation: "Confirmation",
    cancel: "Cancel",
    deleteForever: "Delete Forever",
    deleteForeverLower: "Delete forever",
    academyCalendar: "Academy Calendar",
    loadingEvents: "Loading events...",
    noGroup: "No group",
    noEvents: "No events yet.",
    trainingPhrase: "delete training forever {title}",
    matchPhrase: "delete match forever {title}",
    confirmPhrase: "Type \"{phrase}\" to confirm permanent deletion.",
    trainingDeleteError: "Could not permanently delete training.",
    matchDeleteError: "Could not permanently delete this match.",
    matchDeleteSolution: "{message}\nSolution: remove or detach any remaining linked records, then try Delete Forever again.",
  },
  ar: {
    eventTypes: {
      training: "تدريب",
      match: "مباراة",
      fitness_test: "اختبار لياقة",
      meeting: "اجتماع",
      rest_day: "يوم راحة",
      tournament: "بطولة",
      medical_check: "فحص طبي",
      assessment_day: "يوم تقييم",
    } satisfies Record<(typeof eventTypes)[number], string>,
    statuses: {
      scheduled: "مجدول",
      completed: "مكتمل",
      cancelled: "ملغي",
      finished: "منتهي",
    },
    pageTitle: "التقويم الرئيسي",
    pageDescription: "أحداث تقويم الأكاديمية عبر كل المجموعات.",
    dashboard: "لوحة التحكم",
    calendar: "التقويم",
    addEvent: "إضافة حدث",
    createCalendarEvent: "إنشاء حدث في التقويم",
    title: "العنوان",
    type: "النوع",
    starts: "البداية",
    ends: "النهاية",
    group: "المجموعة",
    coachesOnlyOrGroup: "للمدربين فقط أو اختر مجموعة",
    coachesOnly: "للمدربين فقط",
    location: "المكان",
    notes: "ملاحظات",
    create: "إنشاء",
    deleteTrainingTitle: "حذف التدريب نهائيًا",
    deleteTrainingDescription: "هذا يحذف حدث التدريب والأهداف والحضور والتقييمات والإشعارات ونتائج مخاطر الإصابة المتأثرة نهائيًا. اكتب {phrase} للتأكيد.",
    deleteMatchTitle: "حذف المباراة نهائيًا",
    deleteMatchDescription: "هذا يحذف المباراة وحدث التقويم والقائمة والتكتيك والحضور والأحداث والأهداف والتبديلات وإحصائيات اللاعبين نهائيًا. اكتب {phrase} للتأكيد.",
    confirmation: "التأكيد",
    cancel: "إلغاء",
    deleteForever: "حذف نهائي",
    deleteForeverLower: "حذف نهائي",
    academyCalendar: "تقويم الأكاديمية",
    loadingEvents: "جاري تحميل الأحداث...",
    noGroup: "لا توجد مجموعة",
    noEvents: "لا توجد أحداث حتى الآن.",
    trainingPhrase: "حذف التدريب نهائيًا {title}",
    matchPhrase: "حذف المباراة نهائيًا {title}",
    confirmPhrase: "اكتب \"{phrase}\" لتأكيد الحذف النهائي.",
    trainingDeleteError: "تعذر حذف التدريب نهائيًا.",
    matchDeleteError: "تعذر حذف هذه المباراة نهائيًا.",
    matchDeleteSolution: "{message}\nالحل: احذف أو افصل أي سجلات مرتبطة متبقية، ثم حاول الحذف النهائي مرة أخرى.",
  },
} as const;

type CalendarCopy = (typeof calendarCopy)[keyof typeof calendarCopy];

const eventTypeLabel = (type: string, t: CalendarCopy) =>
  type in t.eventTypes ? t.eventTypes[type as keyof typeof t.eventTypes] : type.replaceAll("_", " ");

const statusLabel = (status: string, t: CalendarCopy) =>
  status in t.statuses ? t.statuses[status as keyof typeof t.statuses] : status;

export default function AdminCalendarPage() {
  const language = useDashboardLanguage();
  const t = calendarCopy[language];
  const { data, isLoading } = useGetAdminCalendarEventsQuery({ limit: 100 });
  const { data: matchesRes, isLoading: loadingMatches } =
    useGetAdminMatchesQuery({ limit: 100 });
  const { data: groups = [] } = useGetGroupsQuery({});
  const [open, setOpen] = useState(false);
  const [deleteTrainingRow, setDeleteTrainingRow] =
    useState<CalendarEvent | null>(null);
  const [deleteMatchRow, setDeleteMatchRow] = useState<Match | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [form, setForm] = useState({
    title: "",
    eventType: "meeting",
    startDatetime: "",
    endDatetime: "",
    location: "",
    status: "scheduled",
    groupId: "",
    notes: "",
  });
  const [createEvent, { isLoading: isCreating }] =
    useCreateAdminCalendarEventMutation();
  const [hardDeleteTraining, { isLoading: deletingTraining }] =
    useHardDeleteAdminTrainingEventMutation();
  const [hardDeleteMatch, { isLoading: deletingMatch }] =
    useHardDeleteAdminMatchMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createEvent({
      title: form.title,
      eventType: form.eventType,
      startDatetime: new Date(form.startDatetime).toISOString(),
      endDatetime: new Date(form.endDatetime).toISOString(),
      location: form.location,
      status: form.status,
      visibility: form.groupId ? "selected_groups" : "coaches_only",
      groupIds: form.groupId ? [form.groupId] : undefined,
      notes: form.notes,
    }).unwrap();
    setOpen(false);
    setForm({
      title: "",
      eventType: "meeting",
      startDatetime: "",
      endDatetime: "",
      location: "",
      status: "scheduled",
      groupId: "",
      notes: "",
    });
  };

  const handleHardDeleteTraining = async () => {
    if (!deleteTrainingRow) return;
    const expected = t.trainingPhrase.replace("{title}", deleteTrainingRow.title);
    setDeleteError("");

    if (deleteConfirm.trim() !== expected) {
      setDeleteError(t.confirmPhrase.replace("{phrase}", expected));
      return;
    }

    try {
      await hardDeleteTraining(deleteTrainingRow.id).unwrap();
      setDeleteTrainingRow(null);
      setDeleteConfirm("");
    } catch (error) {
      setDeleteError(
        getApiMessage(error, t.trainingDeleteError),
      );
    }
  };

  const handleHardDeleteMatch = async () => {
    if (!deleteMatchRow) return;
    const expected = t.matchPhrase.replace("{title}", deleteMatchRow.opponent_name);
    setDeleteError("");

    if (deleteConfirm.trim() !== expected) {
      setDeleteError(t.confirmPhrase.replace("{phrase}", expected));
      return;
    }

    try {
      await hardDeleteMatch(deleteMatchRow.id).unwrap();
      setDeleteMatchRow(null);
      setDeleteConfirm("");
    } catch (error) {
      const message = getApiMessage(
        error,
        t.matchDeleteError,
      );
      setDeleteError(
        t.matchDeleteSolution.replace("{message}", message),
      );
    }
  };

  const events = useMemo(() => data?.data ?? [], [data?.data]);
  const matches = useMemo(() => matchesRes?.data ?? [], [matchesRes?.data]);
  const deleteExpected = t.trainingPhrase.replace("{title}", deleteTrainingRow?.title ?? "");
  const deleteMatchExpected = t.matchPhrase.replace("{title}", deleteMatchRow?.opponent_name ?? "");
  const matchByEventId = useMemo(
    () =>
      new Map(
        matches
          .filter((match) => Boolean(match.event_id))
          .map((match) => [match.event_id as string, match]),
      ),
    [matches],
  );
  const calendarItems = useMemo(
    () => [
      ...events.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.start_datetime,
        type: event.event_type,
        status: event.status,
        subtitle: `${eventTypeLabel(event.event_type, t)}${event.location ? ` - ${event.location}` : ""}`,
      })),
      ...matches.map((match) => ({
        id: match.id,
        title: match.opponent_name,
        date: match.match_date,
        type: "match",
        status: match.status,
        subtitle: `${formatTime12(match.match_time)} - ${match.groups?.map((group) => group.name).join(", ") || match.team_name || t.noGroup}`,
      })),
    ],
    [events, matches, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.calendar },
        ]}
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.addEvent}
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.createCalendarEvent}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.title}</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.type}</Label>
                <Select
                  value={form.eventType}
                  onValueChange={(value) =>
                    setForm((p) => ({ ...p, eventType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {eventTypeLabel(type, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.starts}</Label>
                <Input
                  type="datetime-local"
                  value={form.startDatetime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startDatetime: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.ends}</Label>
                <Input
                  type="datetime-local"
                  value={form.endDatetime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endDatetime: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.group}</Label>
                <Select
                  value={form.groupId}
                  onValueChange={(value) =>
                    setForm((p) => ({ ...p, groupId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.coachesOnlyOrGroup} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.location}</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, location: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.notes}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCreating} className="gap-2">
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTrainingRow)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTrainingRow(null);
            setDeleteConfirm("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t.deleteTrainingTitle}</DialogTitle>
            <DialogDescription>
              {t.deleteTrainingDescription.split("{phrase}")[0]}
              <span className="font-semibold text-foreground">
                {deleteExpected}
              </span>{" "}
              {t.deleteTrainingDescription.split("{phrase}")[1]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-training-confirm">{t.confirmation}</Label>
            <Input
              id="delete-training-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={deleteExpected}
            />
          </div>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteTrainingRow(null);
                setDeleteConfirm("");
                setDeleteError("");
              }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deletingTraining || deleteConfirm.trim() !== deleteExpected
              }
              onClick={handleHardDeleteTraining}
              className="gap-2"
            >
              {deletingTraining && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.deleteForever}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteMatchRow)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletingMatch) {
            setDeleteMatchRow(null);
            setDeleteConfirm("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t.deleteMatchTitle}</DialogTitle>
            <DialogDescription>
              {t.deleteMatchDescription.split("{phrase}")[0]}
              <span className="font-semibold text-foreground">
                {deleteMatchExpected}
              </span>{" "}
              {t.deleteMatchDescription.split("{phrase}")[1]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="calendar-delete-match-confirm">{t.confirmation}</Label>
            <Input
              id="calendar-delete-match-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={deleteMatchExpected}
              autoComplete="off"
            />
          </div>
          {deleteError && (
            <p className="whitespace-pre-line rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingMatch}
              onClick={() => {
                setDeleteMatchRow(null);
                setDeleteConfirm("");
                setDeleteError("");
              }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deletingMatch ||
                deleteConfirm.trim() !== deleteMatchExpected
              }
              onClick={handleHardDeleteMatch}
              className="gap-2"
            >
              {deletingMatch && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.deleteForever}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MonthCalendar title={t.academyCalendar} items={calendarItems} />

      {isLoading || loadingMatches ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingEvents}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const linkedMatch =
              event.event_type === "match"
                ? matchByEventId.get(event.id)
                : undefined;

            return (
            <Card key={event.id} className="border-border/50 bg-card">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <Badge variant="outline">
                        {eventTypeLabel(event.event_type, t)}
                      </Badge>
                      <Badge
                        variant={
                          event.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {statusLabel(event.status, t)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(event.start_datetime)} ·{" "}
                      {formatTime12(event.start_datetime)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.groups?.length
                        ? event.groups.map((group) => group.name).join(", ")
                        : t.coachesOnly}
                    </p>
                  </div>
                </div>
                {event.event_type === "training" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 self-start sm:self-center"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteConfirm("");
                      setDeleteTrainingRow(event);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.deleteForeverLower}
                  </Button>
                )}
                {linkedMatch && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 self-start sm:self-center"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteConfirm("");
                      setDeleteMatchRow(linkedMatch);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.deleteForeverLower}
                  </Button>
                )}
              </CardContent>
            </Card>
            );
          })}
          {!events.length && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t.noEvents}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
