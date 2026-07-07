"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Edit,
  Eye,
  Loader2,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { DataTable, Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
  useCreateMyPlayerAssignmentMutation,
  useDeleteMyPlayerAssignmentMutation,
  useGetCoachDailyAiInputsQuery,
  useGetCoachGroupsQuery,
  useGetMyCoachAssignmentsQuery,
  useGetMyPlayerAssignmentsQuery,
  useGetPlayerAssignmentSubmissionsQuery,
  useReviewPlayerAssignmentSubmissionMutation,
  useSubmitCoachAssignmentMutation,
  useUpdateMyPlayerAssignmentMutation,
  useUploadCoachAssignmentFileMutation,
  type CoachAssignment,
  type CoachPlayerAssignment,
  type PlayerAssignmentSubmission,
  type UploadedAssignmentFile,
} from "@/lib/store/api/coachApi";
import { useGetCoachGroupsScopedQuery } from "@/lib/store/api/calendarApi";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatDateTime } from "@/lib/utils";

const fileAccept =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp";

const adminStatusVariant: Record<
  CoachAssignment["status"],
  "secondary" | "info" | "warning" | "success" | "destructive"
> = {
  assigned: "secondary",
  in_progress: "info",
  submitted: "warning",
  reviewed: "success",
  cancelled: "destructive",
};

const playerStatusVariant: Record<
  CoachPlayerAssignment["status"],
  "secondary" | "success" | "destructive"
> = {
  active: "success",
  closed: "secondary",
  cancelled: "destructive",
};

type PlayerTargetMode = "group" | "birthYear";

const emptyPlayerForm = {
  assignmentId: "",
  title: "",
  description: "",
  openAt: "",
  dueAt: "",
  targetMode: "group" as PlayerTargetMode,
  groupId: "",
  isOpenLocked: false,
  status: "active" as CoachPlayerAssignment["status"],
};

const allGroupsValue = "__all_available_groups__";
const allBirthYearsValue = "__all_available_birthdays__";

const copy = {
  en: {
    selectDateTime: "Select date and time",
    selectTime: "Select time",
    clear: "Clear",
    player: "Player",
    submitted: "Submitted",
    reviewed: "Reviewed",
    file: "file",
    files: "files",
    coachComment: "Coach Comment",
    feedbackPlaceholder: "Write feedback for the player...",
    accept: "Accept",
    needsRedo: "Needs Redo",
    noSubmissions: "No player submissions yet.",
    assignments: "Assignments",
    pageDescription:
      "Admin tasks for you, player assignments from you, and the locked daily AI input assignment.",
    home: "Home",
    refresh: "Refresh",
    adminAssignments: "Admin Assignments",
    failedAdminAssignments: "Failed to load admin assignments.",
    retry: "Retry",
    searchAdminAssignments: "Search admin assignments...",
    noAdminAssignments: "No admin assignments",
    noAdminAssignmentsDescription:
      "Admin requests for coach submissions will appear here.",
    dailyAiScoreAssignment: "Daily AI Score Assignment",
    lockedSystemDaily: "locked system daily",
    inputs: "Inputs",
    inputFieldsLabel: "sleep hours, trained today, meals count",
    output: "Output",
    outputFieldLabel: "daily AI score (0-100)",
    thisWeek: "This week",
    submissions: "submissions",
    players: "players",
    sleepHigh: "Sleep ≥ 8h = 40",
    sleepMid: "Sleep ≥ 7h = 30",
    otherwise: "Otherwise = 20",
    trainedTodayYes: "trained_today 1 = 40",
    trainedTodayNo: "trained_today 0 = 0",
    mealsHigh: "4+ meals = 20",
    mealsMid: "3 meals = 15",
    mealsLow: "less than 3 meals = 10",
    weeklySubmissions: "Weekly submissions",
    average: "avg",
    score: "score",
    noDailyInputs: "No daily AI inputs submitted this week yet.",
    playerAssignments: "Player Assignments",
    newAssignment: "New Assignment",
    failedPlayerAssignments: "Failed to load player assignments.",
    searchPlayerAssignments: "Search player assignments...",
    noPlayerAssignments: "No player assignments",
    noPlayerAssignmentsDescription:
      "Create assignments for your groups and track player submissions here.",
    submitAdminAssignment: "Submit Admin Assignment",
    submitAdminAssignmentDescription:
      "Upload PDF, Word, or image files requested by admin.",
    uploadFile: "Upload File",
    uploadingFile: "Uploading file...",
    uploaded: "Uploaded",
    uploadFailed:
      "Upload failed. Accepted files: PDF, DOC, DOCX, PNG, JPG, JPEG, WEBP.",
    notes: "Notes",
    submitError: "Could not submit this assignment.",
    cancel: "Cancel",
    submit: "Submit",
    resubmit: "Resubmit",
    deleteAssignmentQuestion: "Delete player assignment?",
    deleteDescriptionPrefix: "This will remove",
    deleteDescriptionFallback: "this assignment",
    deleteDescriptionSuffix:
      "from coach and player assignment lists. Existing submissions stay in the database for audit history.",
    deleteAssignment: "Delete Assignment",
    acceptSubmissionQuestion: "Accept submission?",
    needsRedoQuestion: "Mark as needs redo?",
    acceptSubmissionDescription:
      "This will accept the submission. The player will not need to submit it again.",
    redoSubmissionDescription:
      "This will reject the submission and let the player resubmit, even after the deadline.",
    acceptSubmission: "Accept Submission",
    markNeedsRedo: "Mark Needs Redo",
    editPlayerAssignment: "Edit Player Assignment",
    newPlayerAssignment: "New Player Assignment",
    playerAssignmentDescription:
      "Player assignments accept PDF, Word, and image submissions.",
    title: "Title",
    targetBy: "Target By",
    group: "Group",
    birthday: "Birthday",
    targetGroup: "Target Group",
    targetBirthday: "Target Birthday",
    selectGroup: "Select group",
    selectBirthday: "Select birthday",
    allAvailableGroups: "All available groups",
    allBirthdays: "All birthdays",
    description: "Description",
    openAt: "Open At",
    deadline: "Deadline",
    openLocked:
      "This assignment is already open, so the opening time is locked.",
    now: "Now",
    status: "Status",
    active: "Active",
    closed: "Closed",
    cancelled: "Cancelled",
    saveChanges: "Save Changes",
    createAssignment: "Create Assignment",
    playerSubmissions: "Player Submissions",
    loadingSubmissions: "Loading submissions...",
    noDescription: "No description",
    scope: "Scope",
    general: "General",
    due: "Due",
    noDueDate: "No due date",
    window: "Window",
    opens: "Opens",
    noDeadline: "no deadline",
    groups: "Groups",
    noGroup: "No group",
    edit: "Edit",
    delete: "Delete",
    openNowError: "Open At must be now or later.",
    deadlineNowError: "Deadline must be now or later.",
    deadlineOpenError: "Deadline must be after Open At.",
    deadlineLockedError:
      "Deadline must be now or later for an open assignment.",
    targetRequiredError: "Select at least one target group.",
    statuses: {
      assigned: "Assigned",
      in_progress: "In progress",
      submitted: "Submitted",
      reviewed: "Reviewed",
      cancelled: "Cancelled",
      active: "Active",
      closed: "Closed",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    },
    monthNames: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    weekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  ar: {
    selectDateTime: "اختر التاريخ والوقت",
    selectTime: "اختر الوقت",
    clear: "مسح",
    player: "اللاعب",
    submitted: "تم التسليم",
    reviewed: "تمت المراجعة",
    file: "ملف",
    files: "ملفات",
    coachComment: "تعليق المدرب",
    feedbackPlaceholder: "اكتب ملاحظاتك للاعب...",
    accept: "قبول",
    needsRedo: "يحتاج إعادة",
    noSubmissions: "لا توجد تسليمات من اللاعبين بعد.",
    assignments: "التكليفات",
    pageDescription:
      "مهام الإدارة الموجهة لك، وتكليفات اللاعبين التي تنشئها، وتكليف الذكاء اليومي المغلق.",
    home: "الرئيسية",
    refresh: "تحديث",
    adminAssignments: "تكليفات الإدارة",
    failedAdminAssignments: "تعذر تحميل تكليفات الإدارة.",
    retry: "إعادة المحاولة",
    searchAdminAssignments: "ابحث في تكليفات الإدارة...",
    noAdminAssignments: "لا توجد تكليفات من الإدارة",
    noAdminAssignmentsDescription:
      "ستظهر هنا طلبات الإدارة التي تحتاج تسليمًا من المدرب.",
    dailyAiScoreAssignment: "تكليف تقييم الذكاء اليومي",
    lockedSystemDaily: "نظام يومي مغلق",
    inputs: "المدخلات",
    inputFieldsLabel: "ساعات النوم، تدرب اليوم، عدد الوجبات",
    output: "المخرجات",
    outputFieldLabel: "تقييم الذكاء اليومي (0-100)",
    thisWeek: "هذا الأسبوع",
    submissions: "تسليمات",
    players: "لاعبين",
    sleepHigh: "النوم ≥ 8 ساعات = 40",
    sleepMid: "النوم ≥ 7 ساعات = 30",
    otherwise: "غير ذلك = 20",
    trainedTodayYes: "تدرب اليوم 1 = 40",
    trainedTodayNo: "تدرب اليوم 0 = 0",
    mealsHigh: "4+ وجبات = 20",
    mealsMid: "3 وجبات = 15",
    mealsLow: "أقل من 3 وجبات = 10",
    weeklySubmissions: "تسليمات الأسبوع",
    average: "متوسط",
    score: "التقييم",
    noDailyInputs: "لا توجد مدخلات ذكاء يومية هذا الأسبوع حتى الآن.",
    playerAssignments: "تكليفات اللاعبين",
    newAssignment: "تكليف جديد",
    failedPlayerAssignments: "تعذر تحميل تكليفات اللاعبين.",
    searchPlayerAssignments: "ابحث في تكليفات اللاعبين...",
    noPlayerAssignments: "لا توجد تكليفات للاعبين",
    noPlayerAssignmentsDescription:
      "أنشئ تكليفات لمجموعاتك وتابع تسليمات اللاعبين هنا.",
    submitAdminAssignment: "تسليم تكليف الإدارة",
    submitAdminAssignmentDescription:
      "ارفع ملفات PDF أو Word أو صور مطلوبة من الإدارة.",
    uploadFile: "رفع ملف",
    uploadingFile: "جاري رفع الملف...",
    uploaded: "تم رفع",
    uploadFailed:
      "فشل الرفع. الملفات المقبولة: PDF و DOC و DOCX و PNG و JPG و JPEG و WEBP.",
    notes: "الملاحظات",
    submitError: "تعذر تسليم هذا التكليف.",
    cancel: "إلغاء",
    submit: "تسليم",
    resubmit: "إعادة التسليم",
    deleteAssignmentQuestion: "حذف تكليف اللاعب؟",
    deleteDescriptionPrefix: "سيتم حذف",
    deleteDescriptionFallback: "هذا التكليف",
    deleteDescriptionSuffix:
      "من قوائم تكليفات المدرب واللاعب. ستظل التسليمات السابقة محفوظة في قاعدة البيانات لسجل المراجعة.",
    deleteAssignment: "حذف التكليف",
    acceptSubmissionQuestion: "قبول التسليم؟",
    needsRedoQuestion: "تحديده كإعادة مطلوبة؟",
    acceptSubmissionDescription:
      "سيتم قبول التسليم، ولن يحتاج اللاعب إلى تسليمه مرة أخرى.",
    redoSubmissionDescription:
      "سيتم رفض التسليم والسماح للاعب بإعادة التسليم حتى بعد الموعد النهائي.",
    acceptSubmission: "قبول التسليم",
    markNeedsRedo: "تحديد إعادة مطلوبة",
    editPlayerAssignment: "تعديل تكليف اللاعب",
    newPlayerAssignment: "تكليف لاعب جديد",
    playerAssignmentDescription:
      "تكليفات اللاعبين تقبل ملفات PDF و Word والصور.",
    title: "العنوان",
    targetBy: "الاستهداف حسب",
    group: "المجموعة",
    birthday: "سنة الميلاد",
    targetGroup: "المجموعة المستهدفة",
    targetBirthday: "سنة الميلاد المستهدفة",
    selectGroup: "اختر المجموعة",
    selectBirthday: "اختر سنة الميلاد",
    allAvailableGroups: "كل المجموعات المتاحة",
    allBirthdays: "كل سنوات الميلاد",
    description: "الوصف",
    openAt: "وقت الفتح",
    deadline: "الموعد النهائي",
    openLocked: "هذا التكليف مفتوح بالفعل، لذلك وقت الفتح مغلق.",
    now: "الآن",
    status: "الحالة",
    active: "نشط",
    closed: "مغلق",
    cancelled: "ملغي",
    saveChanges: "حفظ التغييرات",
    createAssignment: "إنشاء التكليف",
    playerSubmissions: "تسليمات اللاعبين",
    loadingSubmissions: "جاري تحميل التسليمات...",
    noDescription: "لا يوجد وصف",
    scope: "النطاق",
    general: "عام",
    due: "الاستحقاق",
    noDueDate: "لا يوجد موعد استحقاق",
    window: "النافذة الزمنية",
    opens: "يفتح",
    noDeadline: "بدون موعد نهائي",
    groups: "المجموعات",
    noGroup: "لا توجد مجموعة",
    edit: "تعديل",
    delete: "حذف",
    openNowError: "وقت الفتح يجب أن يكون الآن أو بعد ذلك.",
    deadlineNowError: "الموعد النهائي يجب أن يكون الآن أو بعد ذلك.",
    deadlineOpenError: "الموعد النهائي يجب أن يكون بعد وقت الفتح.",
    deadlineLockedError:
      "الموعد النهائي يجب أن يكون الآن أو بعد ذلك للتكليف المفتوح.",
    targetRequiredError: "اختر مجموعة مستهدفة واحدة على الأقل.",
    statuses: {
      assigned: "مُسند",
      in_progress: "قيد التنفيذ",
      submitted: "تم التسليم",
      reviewed: "تمت المراجعة",
      cancelled: "ملغي",
      active: "نشط",
      closed: "مغلق",
      pending: "قيد الانتظار",
      approved: "مقبول",
      rejected: "مرفوض",
    },
    monthNames: [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ],
    weekDays: [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ],
  },
} as const;

type AssignmentsCopy = (typeof copy)[keyof typeof copy];

const pad2 = (value: number) => String(value).padStart(2, "0");

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const roundUpToStep = (date: Date, stepMinutes = 5) => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % stepMinutes;
  if (remainder || rounded.getSeconds() || rounded.getMilliseconds()) {
    rounded.setMinutes(minutes + (stepMinutes - remainder));
  }
  rounded.setSeconds(0, 0);
  return rounded;
};

const toDateTimeLocalValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const dateTimeInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const raw = String(value).trim();
  const localValue = raw.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/,
  );
  if (localValue) return `${localValue[1]}T${localValue[2]}`;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : toDateTimeLocalValue(date);
};

const toOffsetDateTime = (value: string) => {
  const parts = parseLocalDateTimeParts(value);
  if (!parts) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${parts.dateKey}T${parts.time}:00${sign}${pad2(Math.floor(absoluteOffset / 60))}:${pad2(absoluteOffset % 60)}`;
};

const dateTimeFromNow = (hours = 0) => {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return toDateTimeLocalValue(hours ? roundUpToStep(date) : date);
};

const dateTimeFromValue = (value: string, hours: number) => {
  const base = value ? new Date(value) : new Date();
  const timestamp = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  return toDateTimeLocalValue(
    roundUpToStep(new Date(timestamp + hours * 60 * 60 * 1000)),
  );
};

const laterDateTime = (first: string, second: string) => {
  if (!first) return second;
  if (!second) return first;
  return first > second ? first : second;
};

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
  const hour = Math.floor(index / 12);
  const minute = (index % 12) * 5;
  const value = `${pad2(hour)}:${pad2(minute)}`;
  const hour12 = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";
  return { value, label: `${hour12}:${pad2(minute)} ${period}` };
});

const parseLocalDateTimeParts = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
    dateKey: `${match[1]}-${match[2]}-${match[3]}`,
    time: match[4],
  };
};

const minDateKey = (minDateTime?: string) => minDateTime?.slice(0, 10) || "";
const minTimeValue = (minDateTime?: string) => minDateTime?.slice(11, 16) || "";

const firstSelectableTime = (dateKey: string, minDateTime?: string) => {
  if (!minDateTime || dateKey !== minDateKey(minDateTime)) {
    return TIME_OPTIONS[0].value;
  }
  return (
    TIME_OPTIONS.find((option) => option.value >= minTimeValue(minDateTime))
      ?.value || null
  );
};

const isBeforeMinDateTime = (
  dateKey: string,
  time: string,
  minDateTime?: string,
) => Boolean(minDateTime && `${dateKey}T${time}` < minDateTime);

const formatDateTimeDisplay = (value: string, t: AssignmentsCopy) => {
  const parts = parseLocalDateTimeParts(value);
  if (!parts) return t.selectDateTime;
  const time =
    TIME_OPTIONS.find((option) => option.value === parts.time)?.label ||
    parts.time;
  return `${t.monthNames[parts.monthIndex]} ${parts.day}, ${parts.year} • ${time}`;
};

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

const isAssignmentOpenNow = (assignment: CoachPlayerAssignment) => {
  if (assignment.status !== "active" || !assignment.openAt) return false;
  const now = Date.now();
  const openAt = new Date(assignment.openAt).getTime();
  const dueAt = assignment.dueAt
    ? new Date(assignment.dueAt).getTime()
    : Number.POSITIVE_INFINITY;
  return Number.isFinite(openAt) && openAt <= now && now <= dueAt;
};

const uniqueIds = (ids: string[]) => [...new Set(ids)];

function AssignmentDateTimePicker({
  id,
  label,
  t,
  value,
  onChange,
  minDateTime,
  quickActions,
}: {
  id: string;
  label: string;
  t: AssignmentsCopy;
  value: string;
  onChange: (value: string) => void;
  minDateTime?: string;
  quickActions: Array<{ label: string; value: string }>;
}) {
  const fallbackDateTime = value || minDateTime || dateTimeFromNow();
  const fallbackParts =
    parseLocalDateTimeParts(dateTimeInputValue(fallbackDateTime)) ??
    parseLocalDateTimeParts(dateTimeFromNow());
  const selectedParts = value ? parseLocalDateTimeParts(value) : null;
  const selectedDateKey = selectedParts?.dateKey || "";
  const selectedTime = selectedParts?.time || "";
  const selectedYearForOptions =
    selectedParts?.year ?? new Date().getFullYear();
  const [viewMonth, setViewMonth] = useState(
    () =>
      new Date(
        fallbackParts?.year ?? new Date().getFullYear(),
        fallbackParts?.monthIndex ?? new Date().getMonth(),
        1,
      ),
  );

  const nowYear = new Date().getFullYear();
  const startYear =
    Math.min(nowYear, selectedYearForOptions) - (minDateTime ? 0 : 2);
  const endYear = Math.max(nowYear + 8, selectedYearForOptions + 2);
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => startYear + index,
  );

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const isDateDisabled = (day: number) => {
    const dateKey = `${viewMonth.getFullYear()}-${pad2(viewMonth.getMonth() + 1)}-${pad2(day)}`;
    const minimumDateKey = minDateKey(minDateTime);
    return Boolean(
      minimumDateKey &&
      (dateKey < minimumDateKey ||
        (dateKey === minimumDateKey &&
          !firstSelectableTime(dateKey, minDateTime))),
    );
  };

  const selectDate = (day: number) => {
    if (isDateDisabled(day)) return;
    const dateKey = `${viewMonth.getFullYear()}-${pad2(viewMonth.getMonth() + 1)}-${pad2(day)}`;
    const safeTime = isBeforeMinDateTime(dateKey, selectedTime, minDateTime)
      ? firstSelectableTime(dateKey, minDateTime)
      : selectedTime || firstSelectableTime(dateKey, minDateTime);
    if (safeTime) onChange(`${dateKey}T${safeTime}`);
  };

  const selectTime = (time: string) => {
    const dateKey =
      selectedDateKey || minDateKey(minDateTime) || localDateKey(new Date());
    if (isBeforeMinDateTime(dateKey, time, minDateTime)) return;
    onChange(`${dateKey}T${time}`);
  };

  return (
    <div className="space-y-3 rounded-lg border border-cyan-400/20 bg-slate-950/70 p-3 shadow-[0_18px_60px_rgba(8,47,73,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={id} className="text-slate-200">
            {label}
          </Label>
          <p id={id} className="mt-1 text-xs font-medium text-cyan-100">
            {formatDateTimeDisplay(value, t)}
          </p>
        </div>
        <CalendarDays className="h-5 w-5 text-cyan-300" />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() =>
            setViewMonth(
              (current) =>
                new Date(current.getFullYear(), current.getMonth() - 1, 1),
            )
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select
          value={String(viewMonth.getMonth())}
          onValueChange={(month) =>
            setViewMonth(
              (current) => new Date(current.getFullYear(), Number(month), 1),
            )
          }
        >
          <SelectTrigger className="h-9 border-cyan-400/20 bg-white/[0.04]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {t.monthNames.map((month, index) => (
              <SelectItem key={month} value={String(index)}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(viewMonth.getFullYear())}
          onValueChange={(year) =>
            setViewMonth(
              (current) => new Date(Number(year), current.getMonth(), 1),
            )
          }
        >
          <SelectTrigger className="h-9 w-24 border-cyan-400/20 bg-white/[0.04]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() =>
            setViewMonth(
              (current) =>
                new Date(current.getFullYear(), current.getMonth() + 1, 1),
            )
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
        {t.weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((day, index) => {
          if (!day)
            return <span key={`blank-${index}`} className="aspect-square" />;
          const dateKey = `${viewMonth.getFullYear()}-${pad2(viewMonth.getMonth() + 1)}-${pad2(day)}`;
          const isSelected = dateKey === selectedDateKey;
          const disabled = isDateDisabled(day);
          return (
            <button
              key={dateKey}
              type="button"
              disabled={disabled}
              onClick={() => selectDate(day)}
              className={[
                "aspect-square rounded-md border text-sm font-semibold transition",
                isSelected
                  ? "border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                  : "border-white/5 bg-white/[0.035] text-slate-200 hover:border-cyan-400/50 hover:bg-cyan-400/10",
                disabled
                  ? "cursor-not-allowed opacity-30 hover:border-white/5 hover:bg-white/[0.035]"
                  : "",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>

      <Select
        value={selectedTime}
        onValueChange={selectTime}
        disabled={!selectedDateKey && !minDateTime}
      >
        <SelectTrigger className="border-cyan-400/20 bg-white/[0.04]">
          <SelectValue placeholder={t.selectTime} />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {TIME_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={isBeforeMinDateTime(
                selectedDateKey || minDateKey(minDateTime),
                option.value,
                minDateTime,
              )}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-3 gap-2">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onChange(action.value)}
          >
            {action.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onChange("")}
        >
          {t.clear}
        </Button>
      </div>
    </div>
  );
}

const submissionReviewVariant: Record<
  PlayerAssignmentSubmission["reviewStatus"],
  "info" | "success" | "destructive"
> = {
  pending: "info",
  approved: "success",
  rejected: "destructive",
};

function SubmissionReviewCard({
  submission,
  t,
  onRequestReview,
  isReviewing,
  canReview,
}: {
  submission: PlayerAssignmentSubmission;
  t: AssignmentsCopy;
  onRequestReview: (
    submission: PlayerAssignmentSubmission,
    status: "approved" | "rejected",
    comment: string,
  ) => void;
  isReviewing: boolean;
  canReview: boolean;
}) {
  const [comment, setComment] = useState(submission.coachComment || "");
  const isPending = (submission.reviewStatus || "pending") === "pending";

  return (
    <div className="rounded-md border border-border/50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{submission.playerName || t.player}</p>
            <Badge
              variant={
                submissionReviewVariant[submission.reviewStatus || "pending"]
              }
            >
              {
                t.statuses[
                  (submission.reviewStatus ||
                    "pending") as keyof typeof t.statuses
                ]
              }
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.submitted} {formatDate(submission.submittedAt)}
          </p>
          {submission.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              {t.reviewed} {formatDate(submission.reviewedAt)}
            </p>
          )}
        </div>
        <Badge variant="secondary">
          {submission.files.length}{" "}
          {submission.files.length === 1 ? t.file : t.files}
        </Badge>
      </div>
      {submission.notes && (
        <p className="mt-2 text-sm text-muted-foreground">{submission.notes}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {submission.files.map((file) => (
          <a
            key={file.id}
            href={file.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border/60 px-2 py-1 text-xs font-medium hover:bg-muted/20"
          >
            {file.fileName} ({file.fileType})
          </a>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <Label htmlFor={`submission-comment-${submission.id}`}>
          {t.coachComment}
        </Label>
        <Textarea
          id={`submission-comment-${submission.id}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t.feedbackPlaceholder}
        />
      </div>
      {isPending && canReview && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
            disabled={isReviewing}
            onClick={() => onRequestReview(submission, "approved", comment)}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t.accept}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            disabled={isReviewing}
            onClick={() => onRequestReview(submission, "rejected", comment)}
          >
            <XCircle className="h-4 w-4" />
            {t.needsRedo}
          </Button>
        </div>
      )}
    </div>
  );
}

function SubmissionList({
  submissions,
  t,
  onRequestReview,
  isReviewing,
  canReview,
}: {
  submissions: PlayerAssignmentSubmission[];
  t: AssignmentsCopy;
  onRequestReview: (
    submission: PlayerAssignmentSubmission,
    status: "approved" | "rejected",
    comment: string,
  ) => void;
  isReviewing: boolean;
  canReview: boolean;
}) {
  if (!submissions.length) {
    return <p className="text-sm text-muted-foreground">{t.noSubmissions}</p>;
  }

  return (
    <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
      {submissions.map((submission) => (
        <SubmissionReviewCard
          key={submission.id}
          submission={submission}
          t={t}
          onRequestReview={onRequestReview}
          isReviewing={isReviewing}
          canReview={canReview}
        />
      ))}
    </div>
  );
}

export default function CoachAssignmentsPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { can } = useCoachPermissions();
  const canManagePlayerAssignments = can("can_manage_player_assignments");
  const [adminSelected, setAdminSelected] = useState<CoachAssignment | null>(
    null,
  );
  const [uploadedFile, setUploadedFile] =
    useState<UploadedAssignmentFile | null>(null);
  const [adminForm, setAdminForm] = useState({ coachNotes: "" });
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [playerForm, setPlayerForm] = useState(emptyPlayerForm);
  const [playerFormError, setPlayerFormError] = useState("");
  const [deletePlayerAssignmentTarget, setDeletePlayerAssignmentTarget] =
    useState<CoachPlayerAssignment | null>(null);
  const [submissionsFor, setSubmissionsFor] =
    useState<CoachPlayerAssignment | null>(null);
  const [pendingSubmissionReview, setPendingSubmissionReview] = useState<{
    submission: PlayerAssignmentSubmission;
    status: "approved" | "rejected";
    comment: string;
  } | null>(null);

  const adminAssignments = useGetMyCoachAssignmentsQuery({ limit: 100 });
  const playerAssignments = useGetMyPlayerAssignmentsQuery({ limit: 100 });
  const groupsQuery = useGetCoachGroupsQuery();
  const { data: permissionGroups = [] } = useGetCoachGroupsScopedQuery();
  const dailyAiQuery = useGetCoachDailyAiInputsQuery();
  const submissionsQuery = useGetPlayerAssignmentSubmissionsQuery(
    submissionsFor?.id ?? "",
    { skip: !submissionsFor },
  );
  const [
    submitAdminAssignment,
    { isLoading: isSubmittingAdmin, error: adminSubmitError },
  ] = useSubmitCoachAssignmentMutation();
  const [uploadFile, { isLoading: isUploading, error: uploadError }] =
    useUploadCoachAssignmentFileMutation();
  const [createPlayerAssignment, { isLoading: isCreatingPlayer }] =
    useCreateMyPlayerAssignmentMutation();
  const [updatePlayerAssignment, { isLoading: isUpdatingPlayer }] =
    useUpdateMyPlayerAssignmentMutation();
  const [deletePlayerAssignment, { isLoading: isDeletingPlayerAssignment }] =
    useDeleteMyPlayerAssignmentMutation();
  const [reviewPlayerSubmission, { isLoading: isReviewingPlayerSubmission }] =
    useReviewPlayerAssignmentSubmissionMutation();

  const manageableGroupIds = useMemo(
    () =>
      new Set(
        permissionGroups
          .filter((group) => group.can_manage_player_assignments)
          .map((group) => group.group_id),
      ),
    [permissionGroups],
  );
  const groups = useMemo(
    () =>
      (groupsQuery.data ?? []).filter((group) =>
        manageableGroupIds.has(group.id),
      ),
    [groupsQuery.data, manageableGroupIds],
  );
  const birthYearTargets = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; label: string; groupIds: string[] }
    >();
    groups.forEach((group) => {
      group.birthYears.forEach((birthYear) => {
        const label =
          birthYear.label || `${birthYear.fromYear}-${birthYear.toYear}`;
        const current = byId.get(birthYear.id) || {
          id: birthYear.id,
          label,
          groupIds: [],
        };
        current.groupIds.push(group.id);
        byId.set(birthYear.id, current);
      });
    });
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [groups]);
  const dailyRows = dailyAiQuery.data?.data ?? [];
  const dailyPlayers = new Set(dailyRows.map((row) => row.playerId)).size;
  const dailyAverage = dailyRows.length
    ? Math.round(
        dailyRows.reduce((sum, row) => sum + row.dailyAiScore, 0) /
          dailyRows.length,
      )
    : 0;

  const adminColumns = useMemo<Column<CoachAssignment>[]>(
    () => [
      {
        key: "title",
        header: t.adminAssignments,
        accessor: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.description || t.noDescription}
            </p>
          </div>
        ),
        sortable: true,
        sortValue: (row) => row.title,
      },
      {
        key: "scope",
        header: t.scope,
        accessor: (row) =>
          [row.branchName, row.groupName].filter(Boolean).join(" - ") ||
          t.general,
      },
      {
        key: "due",
        header: t.due,
        accessor: (row) =>
          row.dueDate ? formatDate(row.dueDate) : t.noDueDate,
        sortable: true,
        sortValue: (row) => row.dueDate ?? "",
      },
      {
        key: "status",
        header: t.status,
        accessor: (row) => (
          <Badge variant={adminStatusVariant[row.status]}>
            {t.statuses[row.status]}
          </Badge>
        ),
        sortable: true,
        sortValue: (row) => row.status,
      },
      {
        key: "actions",
        header: "",
        accessor: (row) => (
          <Button
            size="sm"
            variant={row.submissions.length ? "outline" : "default"}
            className="gap-1.5"
            onClick={(event) => {
              event.stopPropagation();
              setAdminSelected(row);
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {row.submissions.length ? t.resubmit : t.submit}
          </Button>
        ),
      },
    ],
    [t],
  );

  const playerColumns = useMemo<Column<CoachPlayerAssignment>[]>(
    () => [
      {
        key: "title",
        header: t.playerAssignments,
        accessor: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.description || t.noDescription}
            </p>
          </div>
        ),
        sortable: true,
        sortValue: (row) => row.title,
      },
      {
        key: "groups",
        header: t.groups,
        accessor: (row) =>
          row.groups.map((group) => group.name).join(", ") || t.noGroup,
      },
      {
        key: "window",
        header: t.window,
        accessor: (row) => (
          <div className="text-xs">
            <p>
              {t.opens} {formatAssignmentDateTime(row.openAt, t.now)}
            </p>
            <p className="text-muted-foreground">
              {t.due} {formatAssignmentDateTime(row.dueAt, t.noDeadline)}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: t.status,
        accessor: (row) => (
          <Badge variant={playerStatusVariant[row.status]}>
            {t.statuses[row.status]}
          </Badge>
        ),
        sortable: true,
        sortValue: (row) => row.status,
      },
      {
        key: "submissions",
        header: t.submissions,
        accessor: (row) => (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(event) => {
              event.stopPropagation();
              setSubmissionsFor(row);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            {row.submissionCount}
          </Button>
        ),
      },
      {
        key: "actions",
        header: "",
        accessor: (row) =>
          canManagePlayerAssignments ? (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={(event) => {
                  event.stopPropagation();
                  setPlayerFormError("");
                  const assignedGroupIds = new Set(
                    row.groups.map((group) => group.id),
                  );
                  const assignedBirthYearIds = new Set(
                    row.birthYears?.map((birthYear) => birthYear.id) || [],
                  );
                  const allAvailableSelected =
                    groups.length > 0 &&
                    groups.every((group) => assignedGroupIds.has(group.id));
                  const allBirthYearsSelected =
                    birthYearTargets.length > 0 &&
                    birthYearTargets.every((target) =>
                      assignedBirthYearIds.has(target.id),
                    );
                  const birthYearSelected = birthYearTargets.find((target) =>
                    assignedBirthYearIds.has(target.id),
                  );
                  const isBirthYearTarget = row.targetType === "birth_year";
                  setPlayerForm({
                    assignmentId: row.id,
                    title: row.title,
                    description: row.description,
                    openAt: dateTimeInputValue(row.openAt),
                    dueAt: dateTimeInputValue(row.dueAt),
                    targetMode: isBirthYearTarget ? "birthYear" : "group",
                    groupId:
                      isBirthYearTarget && allBirthYearsSelected
                        ? allBirthYearsValue
                        : isBirthYearTarget && birthYearSelected
                          ? birthYearSelected.id
                          : allAvailableSelected
                            ? allGroupsValue
                            : row.groups[0]?.id || "",
                    isOpenLocked: isAssignmentOpenNow(row),
                    status: row.status,
                  });
                  setPlayerDialogOpen(true);
                }}
              >
                <Edit className="h-3.5 w-3.5" />
                {t.edit}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletePlayerAssignmentTarget(row);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.delete}
              </Button>
            </div>
          ) : null,
      },
    ],
    [birthYearTargets, canManagePlayerAssignments, groups, t],
  );

  const handleAdminFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const uploaded = await uploadFile(file).unwrap();
    setUploadedFile(uploaded);
  };

  const handleAdminSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminSelected || !uploadedFile) return;

    await submitAdminAssignment({
      assignmentId: adminSelected.id,
      coachNotes: adminForm.coachNotes.trim() || undefined,
      files: [uploadedFile],
    }).unwrap();

    setAdminForm({ coachNotes: "" });
    setUploadedFile(null);
    setAdminSelected(null);
  };

  const openCreatePlayerDialog = () => {
    setPlayerFormError("");
    setPlayerForm({
      ...emptyPlayerForm,
      openAt: dateTimeFromNow(),
      dueAt: dateTimeFromNow(24),
      targetMode: "group",
      groupId: groups.length ? allGroupsValue : "",
    });
    setPlayerDialogOpen(true);
  };

  const handlePlayerAssignmentSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPlayerFormError("");
    if (!playerForm.groupId) return;

    const minCreateDateTime = dateTimeFromNow();
    if (!playerForm.assignmentId) {
      if (playerForm.openAt && playerForm.openAt < minCreateDateTime) {
        setPlayerFormError(t.openNowError);
        return;
      }
      if (playerForm.dueAt && playerForm.dueAt < minCreateDateTime) {
        setPlayerFormError(t.deadlineNowError);
        return;
      }
    }
    if (
      playerForm.openAt &&
      playerForm.dueAt &&
      playerForm.dueAt < playerForm.openAt
    ) {
      setPlayerFormError(t.deadlineOpenError);
      return;
    }
    const selectedBirthYearTarget = birthYearTargets.find(
      (target) => target.id === playerForm.groupId,
    );
    const selectedBirthYearIds =
      playerForm.targetMode === "birthYear"
        ? playerForm.groupId === allBirthYearsValue
          ? birthYearTargets.map((target) => target.id)
          : [playerForm.groupId].filter(Boolean)
        : [];
    const selectedGroupIds =
      playerForm.targetMode === "group"
        ? playerForm.groupId === allGroupsValue
          ? groups.map((group) => group.id)
          : [playerForm.groupId].filter(Boolean)
        : playerForm.groupId === allBirthYearsValue
          ? uniqueIds(birthYearTargets.flatMap((target) => target.groupIds))
          : selectedBirthYearTarget?.groupIds || [];
    if (!selectedGroupIds.length) {
      setPlayerFormError(t.targetRequiredError);
      return;
    }

    const body = {
      title: playerForm.title.trim(),
      description: playerForm.description.trim() || undefined,
      ...(!playerForm.isOpenLocked
        ? {
            openAt: playerForm.openAt
              ? toOffsetDateTime(playerForm.openAt)
              : undefined,
          }
        : {}),
      dueAt: playerForm.dueAt ? toOffsetDateTime(playerForm.dueAt) : undefined,
      targetType:
        playerForm.targetMode === "birthYear"
          ? ("birth_year" as const)
          : ("group" as const),
      groupIds: selectedGroupIds,
      birthYearIds: selectedBirthYearIds,
    };

    if (playerForm.assignmentId) {
      await updatePlayerAssignment({
        assignmentId: playerForm.assignmentId,
        body: { ...body, status: playerForm.status },
      }).unwrap();
    } else {
      await createPlayerAssignment(body).unwrap();
    }

    setPlayerDialogOpen(false);
    setPlayerForm(emptyPlayerForm);
  };

  const confirmDeletePlayerAssignment = async () => {
    if (!deletePlayerAssignmentTarget) return;
    await deletePlayerAssignment(deletePlayerAssignmentTarget.id).unwrap();
    setDeletePlayerAssignmentTarget(null);
  };

  const confirmReviewPlayerSubmission = async () => {
    if (!submissionsFor || !pendingSubmissionReview) return;
    await reviewPlayerSubmission({
      assignmentId: submissionsFor.id,
      submissionId: pendingSubmissionReview.submission.id,
      status: pendingSubmissionReview.status,
      comment: pendingSubmissionReview.comment.trim() || undefined,
    }).unwrap();
    setPendingSubmissionReview(null);
    submissionsQuery.refetch();
  };

  const isInitialLoading =
    adminAssignments.isLoading ||
    playerAssignments.isLoading ||
    groupsQuery.isLoading;

  const minCreateDateTime = dateTimeFromNow();
  const openAtMinDateTime = playerForm.assignmentId
    ? undefined
    : minCreateDateTime;
  const dueAtMinDateTime = playerForm.assignmentId
    ? playerForm.isOpenLocked
      ? laterDateTime(minCreateDateTime, playerForm.openAt)
      : playerForm.openAt || undefined
    : laterDateTime(minCreateDateTime, playerForm.openAt);
  const playerDateError =
    !playerForm.assignmentId &&
    playerForm.openAt &&
    playerForm.openAt < minCreateDateTime
      ? t.openNowError
      : !playerForm.assignmentId &&
          playerForm.dueAt &&
          playerForm.dueAt < minCreateDateTime
        ? t.deadlineNowError
        : playerForm.isOpenLocked &&
            playerForm.dueAt &&
            playerForm.dueAt < minCreateDateTime
          ? t.deadlineLockedError
          : playerForm.openAt &&
              playerForm.dueAt &&
              playerForm.dueAt < playerForm.openAt
            ? t.deadlineOpenError
            : "";

  if (isInitialLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.assignments}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.assignments },
        ]}
        actions={
          <RefreshButton
            onRefresh={() =>
              Promise.all([
                adminAssignments.refetch(),
                playerAssignments.refetch(),
                dailyAiQuery.refetch(),
              ])
            }
            isRefreshing={
              adminAssignments.isFetching ||
              playerAssignments.isFetching ||
              dailyAiQuery.isFetching
            }
            label={t.refresh}
          />
        }
      />

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t.adminAssignments}</CardTitle>
        </CardHeader>
        <CardContent>
          {adminAssignments.isError ? (
            <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <span>{t.failedAdminAssignments}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => adminAssignments.refetch()}
              >
                {t.retry}
              </Button>
            </div>
          ) : (
            <DataTable
              data={adminAssignments.data?.data ?? []}
              columns={adminColumns}
              searchable
              searchPlaceholder={t.searchAdminAssignments}
              searchKey={(row) =>
                `${row.title} ${row.branchName ?? ""} ${row.groupName ?? ""}`
              }
              emptyTitle={t.noAdminAssignments}
              emptyDescription={t.noAdminAssignmentsDescription}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              {t.dailyAiScoreAssignment}
            </CardTitle>
            <Badge variant="secondary">{t.lockedSystemDaily}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-border/50 p-3">
                <p className="text-xs">{t.inputs}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {t.inputFieldsLabel}
                </p>
              </div>
              <div className="rounded-md border border-border/50 p-3">
                <p className="text-xs">{t.output}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {t.outputFieldLabel}
                </p>
              </div>
              <div className="rounded-md border border-border/50 p-3">
                <p className="text-xs">{t.thisWeek}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {dailyRows.length} {t.submissions} / {dailyPlayers}{" "}
                  {t.players}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Badge variant="outline">{t.sleepHigh}</Badge>
              <Badge variant="outline">{t.sleepMid}</Badge>
              <Badge variant="outline">{t.otherwise}</Badge>
              <Badge variant="outline">{t.trainedTodayYes}</Badge>
              <Badge variant="outline">{t.trainedTodayNo}</Badge>
              <Badge variant="outline">{t.mealsHigh}</Badge>
              <Badge variant="outline">{t.mealsMid}</Badge>
              <Badge variant="outline">{t.mealsLow}</Badge>
            </div>
          </div>
          <div className="rounded-md border border-border/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t.weeklySubmissions}</p>
              <Badge variant={dailyRows.length ? "success" : "warning"}>
                {t.average} {dailyAverage}
              </Badge>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {dailyRows.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded bg-muted/20 px-2 py-1.5 text-xs"
                >
                  <span className="font-medium">{row.playerName}</span>
                  <span className="text-muted-foreground">
                    {formatDate(row.inputDate)} · {t.score} {row.dailyAiScore}
                  </span>
                </div>
              ))}
              {!dailyRows.length && (
                <p className="text-sm text-muted-foreground">
                  {t.noDailyInputs}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">{t.playerAssignments}</CardTitle>
            {canManagePlayerAssignments && (
              <Button
                className="gap-2"
                onClick={openCreatePlayerDialog}
                disabled={!groups.length}
              >
                <Plus className="h-4 w-4" />
                {t.newAssignment}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {playerAssignments.isError ? (
            <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <span>{t.failedPlayerAssignments}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => playerAssignments.refetch()}
              >
                {t.retry}
              </Button>
            </div>
          ) : (
            <DataTable
              data={playerAssignments.data?.data ?? []}
              columns={playerColumns}
              searchable
              searchPlaceholder={t.searchPlayerAssignments}
              searchKey={(row) =>
                `${row.title} ${row.description} ${row.groups.map((group) => group.name).join(" ")}`
              }
              emptyTitle={t.noPlayerAssignments}
              emptyDescription={t.noPlayerAssignmentsDescription}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!adminSelected}
        onOpenChange={(open) => {
          if (!open) {
            setAdminSelected(null);
            setUploadedFile(null);
            setAdminForm({ coachNotes: "" });
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.submitAdminAssignment}</DialogTitle>
            <DialogDescription>
              {t.submitAdminAssignmentDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAdminSubmit}>
            <div className="space-y-2">
              <Label htmlFor="submission-file">{t.uploadFile}</Label>
              <Input
                id="submission-file"
                type="file"
                accept={fileAccept}
                onChange={(event) =>
                  handleAdminFileUpload(event.target.files?.[0])
                }
                disabled={isUploading}
                required
              />
              {isUploading && (
                <p className="text-xs text-muted-foreground">
                  {t.uploadingFile}
                </p>
              )}
              {uploadedFile && (
                <p className="text-xs text-emerald-400">
                  {t.uploaded} {uploadedFile.fileName} ({uploadedFile.fileType})
                </p>
              )}
              {uploadError && (
                <p className="text-xs text-red-400">{t.uploadFailed}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="submission-notes">{t.notes}</Label>
              <Textarea
                id="submission-notes"
                value={adminForm.coachNotes}
                onChange={(event) =>
                  setAdminForm({ coachNotes: event.target.value })
                }
              />
            </div>
            {adminSubmitError && (
              <p className="text-sm text-red-400">{t.submitError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdminSelected(null)}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingAdmin || isUploading || !uploadedFile}
                className="gap-2"
              >
                {isSubmittingAdmin && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletePlayerAssignmentTarget}
        onOpenChange={(open) => {
          if (!open) setDeletePlayerAssignmentTarget(null);
        }}
        title={t.deleteAssignmentQuestion}
        description={`${t.deleteDescriptionPrefix} "${deletePlayerAssignmentTarget?.title || t.deleteDescriptionFallback}" ${t.deleteDescriptionSuffix}`}
        confirmLabel={t.deleteAssignment}
        variant="destructive"
        onConfirm={confirmDeletePlayerAssignment}
        isLoading={isDeletingPlayerAssignment}
      />

      <ConfirmDialog
        open={!!pendingSubmissionReview}
        onOpenChange={(open) => {
          if (!open) setPendingSubmissionReview(null);
        }}
        title={
          pendingSubmissionReview?.status === "approved"
            ? t.acceptSubmissionQuestion
            : t.needsRedoQuestion
        }
        description={
          pendingSubmissionReview?.status === "approved"
            ? t.acceptSubmissionDescription
            : t.redoSubmissionDescription
        }
        confirmLabel={
          pendingSubmissionReview?.status === "approved"
            ? t.acceptSubmission
            : t.markNeedsRedo
        }
        variant={
          pendingSubmissionReview?.status === "rejected"
            ? "destructive"
            : "default"
        }
        onConfirm={confirmReviewPlayerSubmission}
        isLoading={isReviewingPlayerSubmission}
      />

      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {playerForm.assignmentId
                ? t.editPlayerAssignment
                : t.newPlayerAssignment}
            </DialogTitle>
            <DialogDescription>
              {t.playerAssignmentDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePlayerAssignmentSubmit}>
            <div className="grid gap-4 lg:grid-cols-[1fr_180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="player-assignment-title">{t.title}</Label>
                <Input
                  id="player-assignment-title"
                  value={playerForm.title}
                  onChange={(event) =>
                    setPlayerForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.targetBy}</Label>
                <Select
                  value={playerForm.targetMode}
                  onValueChange={(value) =>
                    setPlayerForm((current) => ({
                      ...current,
                      targetMode: value as PlayerTargetMode,
                      groupId:
                        value === "group"
                          ? groups.length
                            ? allGroupsValue
                            : ""
                          : birthYearTargets.length
                            ? allBirthYearsValue
                            : "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">{t.group}</SelectItem>
                    <SelectItem value="birthYear">{t.birthday}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {playerForm.targetMode === "group"
                    ? t.targetGroup
                    : t.targetBirthday}
                </Label>
                <Select
                  value={playerForm.groupId}
                  onValueChange={(value) =>
                    setPlayerForm((current) => ({ ...current, groupId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        playerForm.targetMode === "group"
                          ? t.selectGroup
                          : t.selectBirthday
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {playerForm.targetMode === "group" ? (
                      <>
                        <SelectItem value={allGroupsValue}>
                          {t.allAvailableGroups} ({groups.length})
                        </SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <SelectItem value={allBirthYearsValue}>
                          {t.allBirthdays} ({birthYearTargets.length})
                        </SelectItem>
                        {birthYearTargets.map((target) => (
                          <SelectItem key={target.id} value={target.id}>
                            {target.label} - {target.groupIds.length} {t.groups}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="player-assignment-description">
                {t.description}
              </Label>
              <Textarea
                id="player-assignment-description"
                value={playerForm.description}
                onChange={(event) =>
                  setPlayerForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
              {playerForm.isOpenLocked ? (
                <div className="space-y-3 rounded-lg border border-cyan-400/20 bg-slate-950/70 p-3 shadow-[0_18px_60px_rgba(8,47,73,0.25)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-slate-200">{t.openAt}</Label>
                      <p className="mt-1 text-xs font-medium text-cyan-100">
                        {formatAssignmentDateTime(playerForm.openAt, t.now)}
                      </p>
                    </div>
                    <CalendarDays className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                    {t.openLocked}
                  </div>
                </div>
              ) : (
                <AssignmentDateTimePicker
                  id="player-assignment-open"
                  label={t.openAt}
                  t={t}
                  value={playerForm.openAt}
                  minDateTime={openAtMinDateTime}
                  onChange={(value) => {
                    setPlayerFormError("");
                    setPlayerForm((current) => ({
                      ...current,
                      openAt: value,
                      dueAt:
                        value && current.dueAt && current.dueAt < value
                          ? dateTimeFromValue(value, 24)
                          : current.dueAt,
                    }));
                  }}
                  quickActions={[
                    { label: t.now, value: dateTimeFromNow() },
                    {
                      label: "+1h",
                      value: dateTimeFromValue(playerForm.openAt, 1),
                    },
                  ]}
                />
              )}
              <AssignmentDateTimePicker
                id="player-assignment-due"
                label={t.deadline}
                t={t}
                value={playerForm.dueAt}
                minDateTime={dueAtMinDateTime}
                onChange={(value) => {
                  setPlayerFormError("");
                  setPlayerForm((current) => ({ ...current, dueAt: value }));
                }}
                quickActions={[
                  {
                    label: "+24h",
                    value: dateTimeFromValue(
                      playerForm.openAt || minCreateDateTime,
                      24,
                    ),
                  },
                  {
                    label: "+48h",
                    value: dateTimeFromValue(
                      playerForm.openAt || minCreateDateTime,
                      48,
                    ),
                  },
                ]}
              />
              <div className="space-y-2">
                <Label>{t.status}</Label>
                <Select
                  value={playerForm.status}
                  onValueChange={(value) =>
                    setPlayerForm((current) => ({
                      ...current,
                      status: value as CoachPlayerAssignment["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t.active}</SelectItem>
                    <SelectItem value="closed">{t.closed}</SelectItem>
                    <SelectItem value="cancelled">{t.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(playerFormError || playerDateError) && (
              <p className="text-sm text-red-400">
                {playerFormError || playerDateError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlayerDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  isCreatingPlayer ||
                  isUpdatingPlayer ||
                  !playerForm.title.trim() ||
                  !playerForm.groupId ||
                  Boolean(playerDateError)
                }
              >
                {(isCreatingPlayer || isUpdatingPlayer) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {playerForm.assignmentId ? t.saveChanges : t.createAssignment}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!submissionsFor}
        onOpenChange={(open) => {
          if (!open) setSubmissionsFor(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.playerSubmissions}</DialogTitle>
            <DialogDescription>{submissionsFor?.title}</DialogDescription>
          </DialogHeader>
          {submissionsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loadingSubmissions}
            </div>
          ) : (
            <SubmissionList
              submissions={submissionsQuery.data ?? []}
              t={t}
              canReview={canManagePlayerAssignments}
              onRequestReview={(submission, status, comment) =>
                setPendingSubmissionReview({ submission, status, comment })
              }
              isReviewing={isReviewingPlayerSubmission}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
