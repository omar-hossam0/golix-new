"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MonthCalendar } from "@/components/shared/MonthCalendar";
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
import { Textarea } from "@/components/ui/textarea";
import { useGetCoachesQuery } from "@/lib/store/api/adminApi";
import {
  useCreateAdminMatchMutation,
  useGetAdminMatchQuery,
  useGetAdminMatchesQuery,
  useHardDeleteAdminMatchMutation,
  usePostponeAdminMatchMutation,
  useUpdateAdminMatchStatusMutation,
  type Match,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12 } from "@/lib/utils";

const copy = {
  en: {
    title: "Matches Management",
    description: "Create, schedule, update, and control official match information.",
    dashboard: "Dashboard",
    matches: "Matches",
    addMatch: "Add Match",
    createMatch: "Create Match",
    createDescription:
      "Add the match details now. Target groups or birthdays can be configured later from match configuration.",
    coach: "Coach",
    selectCoach: "Select coach for this match",
    opponent: "Opponent",
    friendlyQuestion: "Friendly?",
    friendly: "Friendly",
    notFriendly: "Not friendly",
    notFriendlyOfficial: "Not Friendly (Official)",
    trainingMatch: "Training Match",
    venueType: "Venue Type",
    home: "Home",
    away: "Away",
    neutral: "Neutral",
    date: "Date",
    time: "Time",
    locationStadium: "Location / Stadium",
    location: "Location",
    referee: "Referee",
    organizerNotes: "Organizer Notes",
    selectCoachError: "Select the coach who will manage this match.",
    invalidKickoff: "Choose a valid match date and time.",
    pastKickoff:
      "Choose a future match date and time. Past matches cannot be created here.",
    createError: "Could not create match. Please check the fields and try again.",
    deleteMatchForever: "Delete Match Forever",
    deleteDescriptionStart:
      "This permanently removes the match, calendar event, squads, tactics, attendance, and match stats. Type",
    toConfirm: "to confirm.",
    confirmation: "Confirmation",
    typeToConfirm: "Type",
    confirmPermanentDeletion: "to confirm permanent deletion.",
    deleteError: "Could not permanently delete match.",
    cancel: "Cancel",
    deleteForever: "Delete Forever",
    postponeMatch: "Postpone Match",
    postponeDescription:
      "Choose the new kick-off. The match, calendar, coach view, player view, and notifications will all use this new time.",
    newDate: "New date",
    newTime: "New time",
    leaveEmptyLocation: "Leave empty if not confirmed",
    reason: "Reason",
    reasonPlaceholder: "Weather, opponent request, pitch availability...",
    chooseNewDateTime: "Choose the new date and time.",
    postponeError: "Could not postpone match.",
    savePostponement: "Save Postponement",
    matchesCalendar: "Matches Calendar",
    finishedArchive: "Finished Matches Archive",
    finished: "finished",
    played: "played",
    toBeConfirmed: "To be confirmed",
    noFinishedMatches: "No finished matches yet.",
    loadingFinishedMatches: "Loading finished matches...",
    loadingMatchDetails: "Loading match details...",
    score: "Score",
    groups: "Groups",
    noGroup: "No group",
    venue: "Venue",
    notRecorded: "Not recorded",
    finishedAt: "Finished at",
    autoFinished: "Auto finished",
    planTactics: "Plan & Tactics",
    formation: "Formation",
    notSaved: "Not saved",
    noTacticalNotes: "No tactical notes recorded.",
    matchNotes: "Match Notes",
    noOrganizerNotes: "No organizer notes.",
    noPostMatchNotes: "No post-match notes.",
    squadInstructions: "Squad & Instructions",
    noInstruction: "No instruction",
    noSquad: "No squad saved.",
    attendance: "Attendance",
    noAttendance: "No attendance recorded.",
    player: "Player",
    minutes: "Min",
    goalsShort: "G",
    assistsShort: "A",
    cards: "Cards",
    rating: "Rating",
    notes: "Notes",
    yellowShort: "Y",
    redShort: "R",
    noPlayerStats: "No player stats recorded.",
    incidents: "Incidents",
    noNotes: "No notes",
    noIncidents: "No incidents recorded.",
    selectFinishedPrompt: "Select a finished match to view its saved details.",
    finishedInfo:
      "Finished matches will appear here after the match ends or three hours pass from kick-off.",
    calendarTable: "Matches Calendar Table",
    match: "Match",
    status: "Status",
    actions: "Actions",
    noLocation: "No location",
    noMatches: "No matches scheduled.",
    loadingMatches: "Loading matches...",
    allMatches: "All Matches",
    postponedTo: "Postponed to",
    at: "at",
    finishedLocked: "Finished match. Postpone and cancel are locked.",
    cancelledLocked: "Cancelled match. Only permanent deletion is available.",
    postponeToNewDate: "Postpone to new date",
    finishNow: "Finish now",
    cancelMatch: "Cancel match",
    statusLabels: {
      scheduled: "Scheduled",
      postponed: "Postponed",
      cancelled: "Cancelled",
      finished: "Finished",
      completed: "Completed",
      in_progress: "In progress",
    },
  },
  ar: {
    title: "إدارة المباريات",
    description: "أنشئ وجدول وحدّث وتحكم في بيانات المباريات الرسمية.",
    dashboard: "لوحة التحكم",
    matches: "المباريات",
    addMatch: "إضافة مباراة",
    createMatch: "إنشاء مباراة",
    createDescription:
      "أضف تفاصيل المباراة الآن. يمكن ضبط المجموعات أو سنوات الميلاد لاحقًا من إعدادات المباراة.",
    coach: "المدرب",
    selectCoach: "اختر المدرب المسؤول عن المباراة",
    opponent: "المنافس",
    friendlyQuestion: "ودية؟",
    friendly: "ودية",
    notFriendly: "غير ودية",
    notFriendlyOfficial: "غير ودية (رسمية)",
    trainingMatch: "مباراة تدريبية",
    venueType: "نوع الملعب",
    home: "على أرضنا",
    away: "خارج الأرض",
    neutral: "ملعب محايد",
    date: "التاريخ",
    time: "الوقت",
    locationStadium: "الموقع / الملعب",
    location: "الموقع",
    referee: "الحكم",
    organizerNotes: "ملاحظات المنظم",
    selectCoachError: "اختر المدرب الذي سيدير هذه المباراة.",
    invalidKickoff: "اختر تاريخ ووقت مباراة صحيحين.",
    pastKickoff: "اختر تاريخ ووقت مستقبليين. لا يمكن إنشاء مباريات ماضية هنا.",
    createError: "تعذر إنشاء المباراة. راجع الحقول وحاول مرة أخرى.",
    deleteMatchForever: "حذف المباراة نهائيًا",
    deleteDescriptionStart:
      "سيؤدي هذا إلى حذف المباراة وحدث التقويم والتشكيلات والخطط والحضور وإحصائيات المباراة نهائيًا. اكتب",
    toConfirm: "للتأكيد.",
    confirmation: "التأكيد",
    typeToConfirm: "اكتب",
    confirmPermanentDeletion: "لتأكيد الحذف النهائي.",
    deleteError: "تعذر حذف المباراة نهائيًا.",
    cancel: "إلغاء",
    deleteForever: "حذف نهائي",
    postponeMatch: "تأجيل المباراة",
    postponeDescription:
      "اختر موعد الانطلاق الجديد. ستستخدم المباراة والتقويم ولوحة المدرب ولوحة اللاعب والإشعارات هذا الموعد الجديد.",
    newDate: "التاريخ الجديد",
    newTime: "الوقت الجديد",
    leaveEmptyLocation: "اتركه فارغًا إذا لم يتم التأكيد",
    reason: "السبب",
    reasonPlaceholder: "الطقس، طلب المنافس، توفر الملعب...",
    chooseNewDateTime: "اختر التاريخ والوقت الجديدين.",
    postponeError: "تعذر تأجيل المباراة.",
    savePostponement: "حفظ التأجيل",
    matchesCalendar: "تقويم المباريات",
    finishedArchive: "أرشيف المباريات المنتهية",
    finished: "منتهية",
    played: "لُعبت",
    toBeConfirmed: "سيتم التأكيد",
    noFinishedMatches: "لا توجد مباريات منتهية بعد.",
    loadingFinishedMatches: "جاري تحميل المباريات المنتهية...",
    loadingMatchDetails: "جاري تحميل تفاصيل المباراة...",
    score: "النتيجة",
    groups: "المجموعات",
    noGroup: "لا توجد مجموعة",
    venue: "الملعب",
    notRecorded: "غير مسجل",
    finishedAt: "انتهت في",
    autoFinished: "انتهت تلقائيًا",
    planTactics: "الخطة والتكتيك",
    formation: "التشكيل",
    notSaved: "غير محفوظ",
    noTacticalNotes: "لا توجد ملاحظات تكتيكية مسجلة.",
    matchNotes: "ملاحظات المباراة",
    noOrganizerNotes: "لا توجد ملاحظات من المنظم.",
    noPostMatchNotes: "لا توجد ملاحظات بعد المباراة.",
    squadInstructions: "القائمة والتعليمات",
    noInstruction: "لا توجد تعليمات",
    noSquad: "لا توجد قائمة محفوظة.",
    attendance: "الحضور",
    noAttendance: "لا يوجد حضور مسجل.",
    player: "اللاعب",
    minutes: "الدقائق",
    goalsShort: "أهداف",
    assistsShort: "تمريرات",
    cards: "البطاقات",
    rating: "التقييم",
    notes: "الملاحظات",
    yellowShort: "صفراء",
    redShort: "حمراء",
    noPlayerStats: "لا توجد إحصائيات لاعبين مسجلة.",
    incidents: "الأحداث",
    noNotes: "لا توجد ملاحظات",
    noIncidents: "لا توجد أحداث مسجلة.",
    selectFinishedPrompt: "اختر مباراة منتهية لعرض تفاصيلها المحفوظة.",
    finishedInfo:
      "ستظهر المباريات المنتهية هنا بعد انتهاء المباراة أو مرور ثلاث ساعات من موعد الانطلاق.",
    calendarTable: "جدول تقويم المباريات",
    match: "المباراة",
    status: "الحالة",
    actions: "الإجراءات",
    noLocation: "لا يوجد موقع",
    noMatches: "لا توجد مباريات مجدولة.",
    loadingMatches: "جاري تحميل المباريات...",
    allMatches: "كل المباريات",
    postponedTo: "مؤجلة إلى",
    at: "في",
    finishedLocked: "المباراة منتهية. التأجيل والإلغاء مغلقان.",
    cancelledLocked: "المباراة ملغاة. المتاح فقط هو الحذف النهائي.",
    postponeToNewDate: "تأجيل إلى موعد جديد",
    finishNow: "إنهاء الآن",
    cancelMatch: "إلغاء المباراة",
    statusLabels: {
      scheduled: "مجدولة",
      postponed: "مؤجلة",
      cancelled: "ملغاة",
      finished: "منتهية",
      completed: "مكتملة",
      in_progress: "قيد اللعب",
    },
  },
} as const;

type AdminMatchesCopy = (typeof copy)[keyof typeof copy];

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

const isFinishedMatch = (match: Match) =>
  match.status === "finished" ||
  match.status === "completed" ||
  match.match_status === "finished";

const matchFriendlyLabel = (
  matchType: Match["match_type"],
  t: AdminMatchesCopy,
) => (matchType === "friendly" ? t.friendly : t.notFriendly);

const inputDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const selectedKickoff = (date: string, time: string) => {
  if (!date || !time) return null;
  const kickoff = new Date(`${date}T${time}:00`);
  return Number.isFinite(kickoff.getTime()) ? kickoff : null;
};

const validateFutureKickoff = (
  date: string,
  time: string,
  t: AdminMatchesCopy,
) => {
  const kickoff = selectedKickoff(date, time);
  if (!kickoff) return t.invalidKickoff;
  if (kickoff <= new Date()) {
    return t.pastKickoff;
  }
  return "";
};

export default function AdminMatchesPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { data: matchesRes, isLoading, refetch: refetchMatches } = useGetAdminMatchesQuery(
    {
      limit: 100,
    },
  );
  const { data: coachesRes } = useGetCoachesQuery({ limit: 100 });
  const coaches = useMemo(() => coachesRes?.data ?? [], [coachesRes?.data]);
  const [open, setOpen] = useState(false);
  const [deleteMatchRow, setDeleteMatchRow] = useState<Match | null>(null);
  const [postponeMatchRow, setPostponeMatchRow] = useState<Match | null>(null);
  const [selectedFinishedMatchId, setSelectedFinishedMatchId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [postponeError, setPostponeError] = useState("");
  const [postponeForm, setPostponeForm] = useState({
    matchDate: "",
    matchTime: "",
    location: "",
    reason: "",
  });
  const [form, setForm] = useState({
    coachId: "",
    opponentName: "",
    matchType: "official",
    matchDate: "",
    matchTime: "",
    location: "",
    venueType: "home",
    refereeName: "",
    organizerNotes: "",
  });
  const selectedCoachId =
    form.coachId || (coaches.length === 1 ? coaches[0].id : "");
  const [formError, setFormError] = useState("");
  const [createMatch, { isLoading: creating }] = useCreateAdminMatchMutation();
  const [updateStatus] = useUpdateAdminMatchStatusMutation();
  const [postponeAdminMatch, { isLoading: postponingMatch }] =
    usePostponeAdminMatchMutation();
  const [hardDeleteMatch, { isLoading: deletingMatch }] =
    useHardDeleteAdminMatchMutation();
  const submitMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const payload: Record<string, unknown> = {
      coachId: selectedCoachId,
      opponentName: form.opponentName.trim(),
      matchType: form.matchType,
      matchDate: form.matchDate,
      matchTime: form.matchTime,
      location: form.location.trim(),
      venueType: form.venueType,
      status: "scheduled",
    };

    if (!selectedCoachId) {
      setFormError(t.selectCoachError);
      return;
    }
    const kickoffError = validateFutureKickoff(form.matchDate, form.matchTime, t);
    if (kickoffError) {
      setFormError(kickoffError);
      return;
    }

    if (form.refereeName.trim()) payload.refereeName = form.refereeName.trim();
    if (form.organizerNotes.trim())
      payload.organizerNotes = form.organizerNotes.trim();

    try {
      await createMatch(payload).unwrap();
      setOpen(false);
      setForm({
        coachId: "",
        opponentName: "",
        matchType: "official",
        matchDate: "",
        matchTime: "",
        location: "",
        venueType: "home",
        refereeName: "",
        organizerNotes: "",
      });
    } catch (error) {
      setFormError(
        getApiMessage(
          error,
          t.createError,
        ),
      );
    }
  };

  const handleHardDeleteMatch = async () => {
    if (!deleteMatchRow) return;
    const expected = `delete match forever ${deleteMatchRow.opponent_name}`;
    setDeleteError("");

    if (deleteConfirm.trim() !== expected) {
      setDeleteError(`${t.typeToConfirm} "${expected}" ${t.confirmPermanentDeletion}`);
      return;
    }

    try {
      await hardDeleteMatch(deleteMatchRow.id).unwrap();
      setDeleteMatchRow(null);
      setDeleteConfirm("");
    } catch (error) {
      setDeleteError(
        getApiMessage(error, t.deleteError),
      );
    }
  };

  const openPostponeDialog = (match: Match) => {
    setPostponeError("");
    setPostponeMatchRow(match);
    setPostponeForm({
      matchDate: String(match.match_date).slice(0, 10),
      matchTime: String(match.match_time).slice(0, 5),
      location: match.location || "",
      reason: "",
    });
  };

  const handlePostponeMatch = async () => {
    if (!postponeMatchRow) return;
    setPostponeError("");
    if (!postponeForm.matchDate || !postponeForm.matchTime) {
      setPostponeError(t.chooseNewDateTime);
      return;
    }
    const kickoffError = validateFutureKickoff(
      postponeForm.matchDate,
      postponeForm.matchTime,
      t,
    );
    if (kickoffError) {
      setPostponeError(kickoffError);
      return;
    }
    try {
      await postponeAdminMatch({
        id: postponeMatchRow.id,
        body: {
          matchDate: postponeForm.matchDate,
          matchTime: postponeForm.matchTime,
          location: postponeForm.location.trim() || null,
          reason: postponeForm.reason.trim() || undefined,
        },
      }).unwrap();
      setPostponeMatchRow(null);
      setPostponeForm({
        matchDate: "",
        matchTime: "",
        location: "",
        reason: "",
      });
    } catch (error) {
      setPostponeError(getApiMessage(error, t.postponeError));
    }
  };

  const matches = useMemo(() => matchesRes?.data ?? [], [matchesRes?.data]);
  const finishedMatches = useMemo(
    () => matches.filter((match) => isFinishedMatch(match)),
    [matches],
  );
  const activeFinishedMatchId = finishedMatches.some(
    (match) => match.id === selectedFinishedMatchId,
  )
    ? selectedFinishedMatchId
    : "";
  const {
    data: selectedFinishedMatch,
    isLoading: loadingFinishedMatch,
    isError: selectedFinishedMatchError,
  } =
    useGetAdminMatchQuery(activeFinishedMatchId, {
      skip: !activeFinishedMatchId,
    });
  useEffect(() => {
    if (!selectedFinishedMatchError) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFinishedMatchId("");
    refetchMatches();
  }, [refetchMatches, selectedFinishedMatchError]);

  useEffect(() => {
    if (
      selectedFinishedMatchId &&
      !finishedMatches.some((match) => match.id === selectedFinishedMatchId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedFinishedMatchId("");
    }
  }, [finishedMatches, selectedFinishedMatchId]);
  const todayInput = inputDateValue();
  const calendarItems = useMemo(
    () =>
      matches.map((match) => ({
        id: match.id,
        title: match.opponent_name,
        date: match.match_date,
        type: "match",
        status: match.status,
        subtitle: `${formatTime12(match.match_time)} - ${match.groups?.map((group) => group.name).join(", ") || match.team_name || t.noGroup}`,
      })),
    [matches, t.noGroup],
  );
  const deleteExpected = `delete match forever ${deleteMatchRow?.opponent_name ?? ""}`;
  const statusLabel = (status: string) =>
    t.statusLabels[status as keyof typeof t.statusLabels] ?? status.replace(/_/g, " ");
  const venueLabel = (venue: string | null | undefined) => {
    if (venue === "home") return t.home;
    if (venue === "away") return t.away;
    if (venue === "neutral") return t.neutral;
    return venue || t.notRecorded;
  };

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.matches },
        ]}
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.addMatch}
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.createMatch}</DialogTitle>
            <DialogDescription>
              {t.createDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitMatch}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.coach}</Label>
                <Select
                  value={selectedCoachId}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      coachId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectCoach} />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.opponent}</Label>
                <Input
                  value={form.opponentName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, opponentName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.friendlyQuestion}</Label>
                <Select
                  value={form.matchType}
                  onValueChange={(value) =>
                    setForm((p) => ({ ...p, matchType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">{t.friendly}</SelectItem>
                    <SelectItem value="official">
                      {t.notFriendlyOfficial}
                    </SelectItem>
                    <SelectItem value="training_match">
                      {t.trainingMatch}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.venueType}</Label>
                <Select
                  value={form.venueType}
                  onValueChange={(value) =>
                    setForm((p) => ({ ...p, venueType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">{t.home}</SelectItem>
                    <SelectItem value="away">{t.away}</SelectItem>
                    <SelectItem value="neutral">{t.neutral}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.date}</Label>
                <Input
                  type="date"
                  min={todayInput}
                  value={form.matchDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, matchDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.time}</Label>
                <Input
                  type="time"
                  value={form.matchTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, matchTime: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.locationStadium}</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, location: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.referee}</Label>
                <Input
                  value={form.refereeName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, refereeName: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.organizerNotes}</Label>
              <Textarea
                value={form.organizerNotes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, organizerNotes: e.target.value }))
                }
              />
            </div>
            {formError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  creating ||
                  !selectedCoachId ||
                  !form.opponentName.trim() ||
                  !form.matchDate ||
                  !form.matchTime ||
                  !form.location.trim()
                }
                className="gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.createMatch}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteMatchRow)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteMatchRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t.deleteMatchForever}</DialogTitle>
            <DialogDescription>
              {t.deleteDescriptionStart}{" "}
              <span className="font-semibold text-foreground">
                {deleteExpected}
              </span>{" "}
              {t.toConfirm}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-match-confirm">{t.confirmation}</Label>
            <Input
              id="delete-match-confirm"
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
              onClick={() => setDeleteMatchRow(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deletingMatch || deleteConfirm.trim() !== deleteExpected
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

      <Dialog
        open={Boolean(postponeMatchRow)}
        onOpenChange={(nextOpen) => !nextOpen && setPostponeMatchRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.postponeMatch}</DialogTitle>
            <DialogDescription>
              {t.postponeDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.newDate}</Label>
              <Input
                type="date"
                min={todayInput}
                value={postponeForm.matchDate}
                onChange={(event) =>
                  setPostponeForm((prev) => ({
                    ...prev,
                    matchDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t.newTime}</Label>
              <Input
                type="time"
                value={postponeForm.matchTime}
                onChange={(event) =>
                  setPostponeForm((prev) => ({
                    ...prev,
                    matchTime: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.location}</Label>
              <Input
                value={postponeForm.location}
                onChange={(event) =>
                  setPostponeForm((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                placeholder={t.leaveEmptyLocation}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.reason}</Label>
              <Textarea
                value={postponeForm.reason}
                onChange={(event) =>
                  setPostponeForm((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
                placeholder={t.reasonPlaceholder}
              />
            </div>
          </div>
          {postponeError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {postponeError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPostponeMatchRow(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={postponingMatch}
              onClick={handlePostponeMatch}
            >
              {postponingMatch && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.savePostponement}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MonthCalendar title={t.matchesCalendar} items={calendarItems} />

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t.finishedArchive}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
            <div className="space-y-2">
              {finishedMatches.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    activeFinishedMatchId === match.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-muted/10 hover:bg-muted/30"
                  }`}
                  onClick={() => setSelectedFinishedMatchId(match.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{match.opponent_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(match.match_date)} ·{" "}
                        {formatTime12(match.match_time)}
                      </p>
                    </div>
                    <Badge variant="success">{t.finished}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {match.location || t.toBeConfirmed}
                  </p>
                </button>
              ))}
              {!finishedMatches.length && !isLoading && (
                <p className="rounded-md border border-border/50 px-3 py-8 text-center text-sm text-muted-foreground">
                  {t.noFinishedMatches}
                </p>
              )}
              {isLoading && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loadingFinishedMatches}
                </p>
              )}
            </div>

            <div className="rounded-md border border-border/50 p-4">
              {loadingFinishedMatch && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loadingMatchDetails}
                </p>
              )}
              {selectedFinishedMatch && !loadingFinishedMatch && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold">
                          {selectedFinishedMatch.opponent_name}
                        </h3>
                        <Badge variant="outline">
                          {matchFriendlyLabel(selectedFinishedMatch.match_type, t)}
                        </Badge>
                        <Badge variant="success">{t.played}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(selectedFinishedMatch.match_date)} ·{" "}
                        {formatTime12(selectedFinishedMatch.match_time)} ·{" "}
                        {selectedFinishedMatch.location || t.toBeConfirmed}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/20 px-4 py-2 text-center">
                      <p className="text-xs text-muted-foreground">{t.score}</p>
                      <p className="text-2xl font-semibold">
                        {selectedFinishedMatch.our_score ?? "-"} :{" "}
                        {selectedFinishedMatch.opponent_score ?? "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-md bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">{t.groups}</p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedFinishedMatch.groups
                          ?.map((group) => group.name)
                          .join(", ") ||
                          selectedFinishedMatch.team_name ||
                          t.noGroup}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">{t.venue}</p>
                      <p className="mt-1 text-sm font-medium">
                        {venueLabel(selectedFinishedMatch.venue_type)}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">{t.referee}</p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedFinishedMatch.referee_name || t.notRecorded}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t.finishedAt}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {selectedFinishedMatch.finished_at
                          ? `${formatDate(selectedFinishedMatch.finished_at)} · ${formatTime12(selectedFinishedMatch.finished_at)}`
                          : t.autoFinished}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-border/40 p-4">
                      <p className="font-medium">{t.planTactics}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t.formation}
                          </p>
                          <p className="font-medium">
                            {selectedFinishedMatch.tactics?.formation ||
                              t.notSaved}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t.coach}</p>
                          <p className="font-medium">
                            {selectedFinishedMatch.tactics?.coach_name ||
                              t.notRecorded}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {selectedFinishedMatch.tactics?.tactical_notes ||
                          selectedFinishedMatch.match_notes ||
                          t.noTacticalNotes}
                      </p>
                    </div>

                    <div className="rounded-md border border-border/40 p-4">
                      <p className="font-medium">{t.matchNotes}</p>
                      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                        <p className="whitespace-pre-wrap">
                          {selectedFinishedMatch.organizer_notes ||
                            t.noOrganizerNotes}
                        </p>
                        <p className="whitespace-pre-wrap">
                          {selectedFinishedMatch.match_notes ||
                            t.noPostMatchNotes}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-border/40 p-4">
                      <p className="font-medium">{t.squadInstructions}</p>
                      <div className="mt-3 space-y-2">
                        {selectedFinishedMatch.squad?.map((player) => (
                          <div
                            key={player.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/10 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                {player.player_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {player.player_instruction || t.noInstruction}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">
                                {player.squad_role}
                              </Badge>
                              {player.position && (
                                <Badge variant="secondary">
                                  {player.position}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                        {!selectedFinishedMatch.squad?.length && (
                          <p className="text-sm text-muted-foreground">
                            {t.noSquad}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-border/40 p-4">
                      <p className="font-medium">{t.attendance}</p>
                      <div className="mt-3 space-y-2">
                        {selectedFinishedMatch.attendance?.map((record) => (
                          <div
                            key={record.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/10 px-3 py-2 text-sm"
                          >
                            <span className="font-medium">
                              {record.player_name}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{record.status}</Badge>
                              {record.notes && (
                                <span className="text-xs text-muted-foreground">
                                  {record.notes}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {!selectedFinishedMatch.attendance?.length && (
                          <p className="text-sm text-muted-foreground">
                            {t.noAttendance}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-border/40">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-left text-xs uppercase text-muted-foreground">
                          <th className="px-3 py-3 font-medium">{t.player}</th>
                          <th className="px-3 py-3 font-medium">{t.minutes}</th>
                          <th className="px-3 py-3 font-medium">{t.goalsShort}</th>
                          <th className="px-3 py-3 font-medium">{t.assistsShort}</th>
                          <th className="px-3 py-3 font-medium">{t.cards}</th>
                          <th className="px-3 py-3 font-medium">{t.rating}</th>
                          <th className="px-3 py-3 font-medium">{t.notes}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFinishedMatch.stats?.map((stat) => (
                          <tr
                            key={stat.id}
                            className="border-b border-border/30 last:border-0"
                          >
                            <td className="px-3 py-3 font-medium">
                              {stat.player_name}
                            </td>
                            <td className="px-3 py-3">
                              {stat.minutes_played}
                            </td>
                            <td className="px-3 py-3">{stat.goals}</td>
                            <td className="px-3 py-3">{stat.assists}</td>
                            <td className="px-3 py-3">
                              {stat.yellow_cards} {t.yellowShort} / {stat.red_cards} {t.redShort}
                            </td>
                            <td className="px-3 py-3">
                              {stat.performance_rating ?? "-"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {stat.coach_notes || stat.injuries || "-"}
                            </td>
                          </tr>
                        ))}
                        {!selectedFinishedMatch.stats?.length && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-6 text-center text-muted-foreground"
                            >
                              {t.noPlayerStats}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-md border border-border/40 p-4">
                    <p className="font-medium">{t.incidents}</p>
                    <div className="mt-3 space-y-2">
                      {selectedFinishedMatch.incidents?.map((incident) => (
                        <div
                          key={incident.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/10 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {incident.player_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {incident.incident_type.replace("_", " ")}
                              {incident.body_part
                                ? ` · ${incident.body_part}`
                                : ""}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {incident.notes || t.noNotes}
                          </p>
                        </div>
                      ))}
                      {!selectedFinishedMatch.incidents?.length && (
                        <p className="text-sm text-muted-foreground">
                          {t.noIncidents}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!selectedFinishedMatch &&
                !loadingFinishedMatch &&
                Boolean(finishedMatches.length) && (
                  <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    {t.selectFinishedPrompt}
                  </p>
                )}
              {!finishedMatches.length && !isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t.finishedInfo}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t.calendarTable}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-3 font-medium">{t.date}</th>
                  <th className="px-3 py-3 font-medium">{t.time}</th>
                  <th className="px-3 py-3 font-medium">{t.match}</th>
                  <th className="px-3 py-3 font-medium">{t.groups}</th>
                  <th className="px-3 py-3 font-medium">{t.location}</th>
                  <th className="px-3 py-3 font-medium">{t.status}</th>
                  <th className="px-3 py-3 font-medium">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr
                    key={match.id}
                    className="border-b border-border/30 last:border-0"
                  >
                    <td className="px-3 py-3 text-muted-foreground">
                      {formatDate(match.match_date)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {formatTime12(match.match_time)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">
                        {match.opponent_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {matchFriendlyLabel(match.match_type, t)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {match.groups?.map((g) => g.name).join(", ") ||
                        match.team_name ||
                        t.noGroup}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {match.location || t.noLocation}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          match.status === "cancelled"
                            ? "destructive"
                            : isFinishedMatch(match)
                              ? "success"
                              : "secondary"
                        }
                      >
                        {isFinishedMatch(match) ? t.finished : statusLabel(match.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteConfirm("");
                          setDeleteMatchRow(match);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.deleteForever}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!matches.length && !isLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      {t.noMatches}
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      {t.loadingMatches}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.allMatches}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <p className="text-sm text-muted-foreground">
                {t.loadingMatches}
              </p>
            )}
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex flex-col gap-3 rounded-md border border-border/50 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{match.opponent_name}</h3>
                      <Badge variant="outline">
                        {matchFriendlyLabel(match.match_type, t)}
                      </Badge>
                      <Badge
                        variant={
                          match.status === "cancelled"
                            ? "destructive"
                            : isFinishedMatch(match)
                              ? "success"
                              : "secondary"
                        }
                      >
                        {isFinishedMatch(match) ? t.finished : statusLabel(match.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(match.match_date)} ·{" "}
                      {formatTime12(match.match_time)} · {match.location}
                    </p>
                    {match.status === "postponed" && (
                      <p className="mt-1 text-xs font-medium text-amber-200">
                        {t.postponedTo} {formatDate(match.match_date)} {t.at}{" "}
                        {formatTime12(match.match_time)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {match.groups?.map((g) => g.name).join(", ") ||
                        match.team_name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isFinishedMatch(match) ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      {t.finishedLocked}
                    </div>
                  ) : match.status === "cancelled" ? (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                      {t.cancelledLocked}
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPostponeDialog(match)}
                      >
                        {t.postponeToNewDate}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStatus({ id: match.id, status: "finished" })
                        }
                      >
                        {t.finishNow}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateStatus({ id: match.id, status: "cancelled" })
                        }
                      >
                        {t.cancelMatch}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteConfirm("");
                      setDeleteMatchRow(match);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.deleteForever}
                  </Button>
                </div>
              </div>
            ))}
            {!matches.length && !isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.noMatches}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
