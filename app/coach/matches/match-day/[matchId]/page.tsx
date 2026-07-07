"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  PauseCircle,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShieldAlert,
  Square,
  X,
} from "lucide-react";
import { QrAttendanceScanner } from "@/components/attendance/QrAttendanceScanner";
import { PageHeader } from "@/components/shared/PageHeader";
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
import {
  useDeleteMatchGoalMutation,
  useDeleteMatchIncidentMutation,
  useGetCoachMatchQuery,
  useRecordMatchGoalMutation,
  useRecordMatchIncidentMutation,
  useRecordMatchSubstitutionMutation,
  useDeleteMatchSubstitutionMutation,
  useUpdateMatchLiveStatusMutation,
  useUpsertMatchAttendanceMutation,
} from "@/lib/store/api/calendarApi";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12, localDateTimeTimestamp } from "@/lib/utils";

let clockSnapshot = 0;
const subscribeMatchClock = (onStoreChange: () => void) => {
  clockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    clockSnapshot = Date.now();
    onStoreChange();
  }, 1000);
  return () => window.clearInterval(intervalId);
};
const getMatchClockSnapshot = () => clockSnapshot;
const getServerMatchClockSnapshot = () => 0;

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

const matchStartTimestamp = (match?: {
  match_date: string;
  match_time: string;
}) =>
  match ? localDateTimeTimestamp(match.match_date, match.match_time) : 0;

const copy = {
  en: {
    matchDayOperations: "Match Day Operations",
    pageDescription: "Handle attendance, substitutions, live status, goals, stoppage time, and incidents.",
    home: "Home",
    matches: "Matches",
    matchDay: "Match Day",
    loadingMatch: "Loading match...",
    saveTacticsFirst: "Save tactics first",
    saveTacticsDescription: "The match-day page opens only after the match has saved tactics and a selected squad.",
    openConfiguration: "Open Configuration",
    matchDayLocked: "Match day is locked",
    matchDayLockedDescriptionPrefix: "Operations open",
    matchDayLockedDescriptionSuffix: "minutes before kick-off so attendance can be marked before the match starts.",
    matchData: "Match Data",
    opponent: "Opponent",
    kickoff: "Kick-off",
    coach: "Coach",
    assignedCoach: "Assigned coach",
    formation: "Formation",
    squadAttendance: "Squad Attendance",
    playing: "playing",
    subbedOff: "subbed off",
    subbedIn: "subbed in",
    sentOff: "sent off",
    injured: "injured",
    noInstruction: "No instruction",
    week: "Week",
    match: "match",
    matchesPlural: "matches",
    notMarked: "not marked",
    present: "Present",
    absent: "Absent",
    player: "Player",
    sub: "Sub",
    yellow: "Yellow",
    red: "Red",
    injury: "Injury",
    undoYellow: "Undo yellow",
    undoRed: "Undo red",
    undoInjury: "Undo injury",
    liveMatch: "Live Match",
    matchStatus: "Match status",
    minute: "Minute",
    firstHalfStoppage: "1st half stoppage",
    secondHalfStoppage: "2nd half stoppage",
    startMatch: "Start Match",
    startSecondHalf: "Start 2nd Half",
    finishMatch: "Finish Match",
    substitutions: "Substitutions",
    for: "for",
    undo: "Undo",
    scoreGoals: "Score & Goals",
    goalFor: "Goal for",
    scorer: "Scorer",
    selectScorer: "Select scorer",
    assist: "Assist",
    noAssist: "No assist",
    goalNote: "Goal note",
    optionalNote: "Optional note",
    addGoal: "Add Goal",
    startBeforeGoals: "Start the match before recording goals.",
    goalixGoal: "GOALIX goal",
    opponentGoal: "goal",
    noGoals: "No goals recorded yet.",
    lineupSummary: "Lineup Summary",
    currentOnField: "Current on field",
    position: "position",
    benchSubbedOff: "Bench / subbed off",
    noSubstitutes: "No substitutes selected.",
    matchNotFound: "Match not found or not available.",
    recordSubstitution: "Record Substitution",
    substitutionDescriptionPrefix: "Choose the available player who will replace",
    substitutionDescriptionSuffix: "This change is saved and the on-field lineup updates immediately.",
    playerComingOn: "Player coming on",
    selectReplacement: "Select replacement",
    markSubPresent: "Mark a substitute present before using them.",
    reason: "Reason",
    substitutionReasonPlaceholder: "Tactical, injury, absent starter replacement...",
    cancel: "Cancel",
    saveSubstitution: "Save Substitution",
    finishQuestion: "Finish match permanently?",
    finishDescription: "This will lock the match as finished, save the final score, attendance, goals, substitutions, cards, injuries, and stats. You cannot start or postpone it again after this.",
    keepMatchOpen: "Keep Match Open",
    recordInjury: "Record Injury",
    injuryDescriptionPrefix: "Save the injured body part for",
    injuryDescriptionSuffix: "The injury date is recorded automatically.",
    bodyPart: "Body part",
    bodyPartPlaceholder: "Hamstring, ankle, shoulder...",
    notes: "Notes",
    medicalNotePlaceholder: "Optional medical note",
    saveInjury: "Save Injury",
    attendanceReadyAutoStart: "Match will auto-start at kick-off after the attendance is ready.",
    markAttendanceBeforeKickoff: "Mark attendance for every squad player before kick-off so the match can auto-start.",
    replaceUnavailablePlayers: "Replace absent or injured players:",
    saveAttendanceError: "Could not save attendance.",
    updateStatusError: "Could not update match status.",
    autoStartError: "Could not auto-start match.",
    recordIncidentError: "Could not record incident.",
    removeIncidentError: "Could not remove incident.",
    recordGoalError: "Could not record goal.",
    removeGoalError: "Could not remove goal.",
    recordSubstitutionError: "Could not record substitution.",
    removeSubstitutionError: "Could not remove substitution.",
    live: {
      waiting: "Waiting",
      noMatchLoaded: "No match loaded",
      finished: "Finished",
      finalWhistle: "Final whistle",
      ready: "Ready",
      waitingForStart: "Waiting for start",
      halfTime: "Half-time",
      waitingSecondHalf: "Waiting for second half",
      extraTime: "Extra time",
      live: "Live",
      firstHalfRunning: "First half running",
      secondHalfRunning: "Second half running",
    },
  },
  ar: {
    matchDayOperations: "عمليات يوم المباراة",
    pageDescription: "إدارة الحضور، التبديلات، حالة المباراة المباشرة، الأهداف، الوقت بدل الضائع، والحوادث.",
    home: "الرئيسية",
    matches: "المباريات",
    matchDay: "يوم المباراة",
    loadingMatch: "جاري تحميل المباراة...",
    saveTacticsFirst: "احفظ الخطة أولًا",
    saveTacticsDescription: "صفحة يوم المباراة لا تفتح إلا بعد حفظ خطة المباراة واختيار القائمة.",
    openConfiguration: "فتح الإعدادات",
    matchDayLocked: "يوم المباراة مغلق",
    matchDayLockedDescriptionPrefix: "تفتح العمليات قبل",
    matchDayLockedDescriptionSuffix: "دقيقة من بداية المباراة حتى يمكن تسجيل الحضور قبل الانطلاق.",
    matchData: "بيانات المباراة",
    opponent: "المنافس",
    kickoff: "بداية المباراة",
    coach: "المدرب",
    assignedCoach: "المدرب المعين",
    formation: "الخطة",
    squadAttendance: "حضور القائمة",
    playing: "يلعب",
    subbedOff: "خرج بديلًا",
    subbedIn: "دخل بديلًا",
    sentOff: "طُرد",
    injured: "مصاب",
    noInstruction: "لا توجد تعليمات",
    week: "الأسبوع",
    match: "مباراة",
    matchesPlural: "مباريات",
    notMarked: "لم يسجل",
    present: "حاضر",
    absent: "غائب",
    player: "لاعب",
    sub: "تبديل",
    yellow: "أصفر",
    red: "أحمر",
    injury: "إصابة",
    undoYellow: "تراجع عن الأصفر",
    undoRed: "تراجع عن الأحمر",
    undoInjury: "تراجع عن الإصابة",
    liveMatch: "المباراة المباشرة",
    matchStatus: "حالة المباراة",
    minute: "الدقيقة",
    firstHalfStoppage: "بدل ضائع الشوط الأول",
    secondHalfStoppage: "بدل ضائع الشوط الثاني",
    startMatch: "بدء المباراة",
    startSecondHalf: "بدء الشوط الثاني",
    finishMatch: "إنهاء المباراة",
    substitutions: "التبديلات",
    for: "بدل",
    undo: "تراجع",
    scoreGoals: "النتيجة والأهداف",
    goalFor: "الهدف لصالح",
    scorer: "المسجل",
    selectScorer: "اختر المسجل",
    assist: "الصناعة",
    noAssist: "بدون صناعة",
    goalNote: "ملاحظة الهدف",
    optionalNote: "ملاحظة اختيارية",
    addGoal: "إضافة هدف",
    startBeforeGoals: "ابدأ المباراة قبل تسجيل الأهداف.",
    goalixGoal: "هدف GOALIX",
    opponentGoal: "هدف",
    noGoals: "لا توجد أهداف مسجلة بعد.",
    lineupSummary: "ملخص التشكيل",
    currentOnField: "الموجودون في الملعب",
    position: "المركز",
    benchSubbedOff: "الدكة / الخارجون",
    noSubstitutes: "لا توجد بدلاء مختارة.",
    matchNotFound: "المباراة غير موجودة أو غير متاحة.",
    recordSubstitution: "تسجيل تبديل",
    substitutionDescriptionPrefix: "اختر اللاعب المتاح الذي سيحل محل",
    substitutionDescriptionSuffix: "سيتم حفظ التغيير وتحديث التشكيل داخل الملعب فورًا.",
    playerComingOn: "اللاعب الداخل",
    selectReplacement: "اختر البديل",
    markSubPresent: "سجل حضور البديل قبل استخدامه.",
    reason: "السبب",
    substitutionReasonPlaceholder: "تكتيكي، إصابة، استبدال لاعب أساسي غائب...",
    cancel: "إلغاء",
    saveSubstitution: "حفظ التبديل",
    finishQuestion: "إنهاء المباراة نهائيًا؟",
    finishDescription: "سيتم قفل المباراة كمنتهية وحفظ النتيجة النهائية والحضور والأهداف والتبديلات والبطاقات والإصابات والإحصائيات. لن يمكنك بدءها أو تأجيلها مرة أخرى بعد ذلك.",
    keepMatchOpen: "إبقاء المباراة مفتوحة",
    recordInjury: "تسجيل إصابة",
    injuryDescriptionPrefix: "احفظ موضع الإصابة للاعب",
    injuryDescriptionSuffix: "يتم تسجيل تاريخ الإصابة تلقائيًا.",
    bodyPart: "موضع الإصابة",
    bodyPartPlaceholder: "العضلة الخلفية، الكاحل، الكتف...",
    notes: "الملاحظات",
    medicalNotePlaceholder: "ملاحظة طبية اختيارية",
    saveInjury: "حفظ الإصابة",
    attendanceReadyAutoStart: "ستبدأ المباراة تلقائيًا عند وقت الانطلاق بعد جاهزية الحضور.",
    markAttendanceBeforeKickoff: "سجل حضور كل لاعبي القائمة قبل الانطلاق حتى تبدأ المباراة تلقائيًا.",
    replaceUnavailablePlayers: "استبدل اللاعبين الغائبين أو المصابين:",
    saveAttendanceError: "تعذر حفظ الحضور.",
    updateStatusError: "تعذر تحديث حالة المباراة.",
    autoStartError: "تعذر بدء المباراة تلقائيًا.",
    recordIncidentError: "تعذر تسجيل الحادثة.",
    removeIncidentError: "تعذر حذف الحادثة.",
    recordGoalError: "تعذر تسجيل الهدف.",
    removeGoalError: "تعذر حذف الهدف.",
    recordSubstitutionError: "تعذر تسجيل التبديل.",
    removeSubstitutionError: "تعذر حذف التبديل.",
    live: {
      waiting: "انتظار",
      noMatchLoaded: "لم يتم تحميل مباراة",
      finished: "انتهت",
      finalWhistle: "صافرة النهاية",
      ready: "جاهزة",
      waitingForStart: "في انتظار البداية",
      halfTime: "استراحة بين الشوطين",
      waitingSecondHalf: "في انتظار الشوط الثاني",
      extraTime: "وقت إضافي",
      live: "مباشر",
      firstHalfRunning: "الشوط الأول جارٍ",
      secondHalfRunning: "الشوط الثاني جارٍ",
    },
  },
} as const;

export default function CoachMatchDayPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { can } = useCoachPermissions();
  const canTakeAttendance = can("can_take_attendance");
  const canManageMatches = can("can_manage_matches");
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = String(params.matchId || "");
  const { data: match, isLoading, refetch } = useGetCoachMatchQuery(matchId, {
    skip: !matchId,
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  });
  const [upsertAttendance, { isLoading: savingAttendance }] =
    useUpsertMatchAttendanceMutation();
  const [updateLiveStatus, { isLoading: updatingLiveStatus }] =
    useUpdateMatchLiveStatusMutation();
  const autoStartAttemptRef = useRef("");
  const [recordIncident, { isLoading: recordingIncident }] =
    useRecordMatchIncidentMutation();
  const [deleteIncident, { isLoading: deletingIncident }] =
    useDeleteMatchIncidentMutation();
  const [recordGoal, { isLoading: recordingGoal }] =
    useRecordMatchGoalMutation();
  const [deleteGoal, { isLoading: deletingGoal }] =
    useDeleteMatchGoalMutation();
  const [recordSubstitution, { isLoading: recordingSubstitution }] =
    useRecordMatchSubstitutionMutation();
  const [deleteSubstitution, { isLoading: deletingSubstitution }] =
    useDeleteMatchSubstitutionMutation();
  const nowMs = useSyncExternalStore(
    subscribeMatchClock,
    getMatchClockSnapshot,
    getServerMatchClockSnapshot,
  );
  const [firstHalfStoppage, setFirstHalfStoppage] = useState<string | null>(
    null,
  );
  const [secondHalfStoppage, setSecondHalfStoppage] = useState<string | null>(
    null,
  );
  const [pageError, setPageError] = useState("");
  const [injuryDialog, setInjuryDialog] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  const [substitutionDialog, setSubstitutionDialog] = useState<{
    outPlayerId: string;
    outPlayerName: string;
  } | null>(null);
  const [substitutionInPlayerId, setSubstitutionInPlayerId] = useState("");
  const [substitutionReason, setSubstitutionReason] = useState("");
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({
    team: "our" as "our" | "opponent",
    scorerPlayerId: "",
    assistPlayerId: "none",
    notes: "",
  });
  const [injuryBodyPart, setInjuryBodyPart] = useState("");
  const [injuryNotes, setInjuryNotes] = useState("");

  const configured = Boolean(match?.tactics && match.squad?.length);
  const startMs = matchStartTimestamp(match);
  const matchDayOpenMinutes = Number(
    match?.academy_settings?.matchDayOpenMinutesBeforeKickoff ??
      match?.academy_settings?.match_day_open_minutes_before_kickoff ??
      5,
  );
  const safeMatchDayOpenMinutes = Number.isFinite(matchDayOpenMinutes)
    ? Math.max(0, Math.min(240, Math.round(matchDayOpenMinutes)))
    : 5;
  const unlockMs = startMs - safeMatchDayOpenMinutes * 60 * 1000;
  const kickOffReached = Boolean(startMs && nowMs >= startMs);
  const matchDayOpen = Boolean(
    match && configured && match.status !== "cancelled" && nowMs >= unlockMs,
  );
  const activeFirstHalfStoppage =
    firstHalfStoppage ?? String(match?.first_half_stoppage_minutes ?? 0);
  const activeSecondHalfStoppage =
    secondHalfStoppage ?? String(match?.second_half_stoppage_minutes ?? 0);
  const firstHalfLimit = 45 + Number(activeFirstHalfStoppage || 0);
  const secondHalfLimit = 45 + Number(activeSecondHalfStoppage || 0);
  const liveMinute = useMemo(() => {
    if (!match) return 0;
    if (match.match_status === "first_half") {
      const halfStart = match.first_half_started_at || match.started_at;
      if (!halfStart) return 0;
      return Math.min(
        firstHalfLimit,
        Math.max(0, Math.floor((nowMs - Date.parse(halfStart)) / 60000)),
      );
    }
    if (match.match_status === "second_half") {
      const halfStart = match.second_half_started_at;
      if (!halfStart) return firstHalfLimit;
      return (
        firstHalfLimit +
        Math.min(
          secondHalfLimit,
          Math.max(0, Math.floor((nowMs - Date.parse(halfStart)) / 60000)),
        )
      );
    }
    if (match.match_status === "finished") {
      return firstHalfLimit + secondHalfLimit;
    }
    return 0;
  }, [firstHalfLimit, match, nowMs, secondHalfLimit]);

  const squadPlayers = useMemo(() => match?.squad ?? [], [match?.squad]);
  const starters = useMemo(
    () => squadPlayers.filter((item) => item.squad_role === "starter"),
    [squadPlayers],
  );
  const substitutions = useMemo(
    () => match?.substitutions ?? [],
    [match?.substitutions],
  );
  const attendanceByPlayer = useMemo(
    () =>
      new Map(
        (match?.attendance ?? []).map((record) => [record.player_id, record]),
      ),
    [match?.attendance],
  );
  const substitutedOutIds = useMemo(
    () => new Set(substitutions.map((item) => item.out_player_id)),
    [substitutions],
  );
  const substitutedInIds = useMemo(
    () => new Set(substitutions.map((item) => item.in_player_id)),
    [substitutions],
  );
  const injuredPlayerIds = useMemo(
    () =>
      new Set(
        (match?.incidents ?? [])
          .filter((incident) => incident.incident_type === "injury")
          .map((incident) => incident.player_id),
      ),
    [match?.incidents],
  );
  const redCardedPlayerIds = useMemo(
    () =>
      new Set(
        (match?.incidents ?? [])
          .filter((incident) => incident.incident_type === "red_card")
          .map((incident) => incident.player_id),
      ),
    [match?.incidents],
  );
  const doubleYellowPlayerIds = useMemo(() => {
    const yellowCounts = new Map<string, number>();
    (match?.incidents ?? [])
      .filter((incident) => incident.incident_type === "yellow_card")
      .forEach((incident) => {
        yellowCounts.set(
          incident.player_id,
          (yellowCounts.get(incident.player_id) ?? 0) + 1,
        );
      });
    return new Set(
      [...yellowCounts.entries()]
        .filter(([, count]) => count >= 2)
        .map(([playerId]) => playerId),
    );
  }, [match?.incidents]);
  const currentPlayingIds = useMemo(() => {
    const ids = new Set(
      starters
        .filter(
          (player) =>
            !redCardedPlayerIds.has(player.player_id) &&
            !doubleYellowPlayerIds.has(player.player_id),
        )
        .map((player) => player.player_id),
    );
    substitutions.forEach((substitution) => {
      ids.delete(substitution.out_player_id);
      if (
        !redCardedPlayerIds.has(substitution.in_player_id) &&
        !doubleYellowPlayerIds.has(substitution.in_player_id)
      ) {
        ids.add(substitution.in_player_id);
      }
    });
    return ids;
  }, [
    doubleYellowPlayerIds,
    redCardedPlayerIds,
    starters,
    substitutions,
  ]);
  const liveMinutesByPlayer = useMemo(() => {
    const endMinute = Math.max(0, liveMinute);
    const states = new Map<
      string,
      { activeSince: number | null; minutes: number; stopped: boolean }
    >();

    squadPlayers.forEach((player) => {
      const attendance = attendanceByPlayer.get(player.player_id);
      const unavailable = ["absent", "injured"].includes(
        attendance?.status ?? "",
      );
      states.set(player.player_id, {
        activeSince:
          player.squad_role === "starter" && !unavailable ? 0 : null,
        minutes: 0,
        stopped: unavailable,
      });
    });

    const stopPlayer = (playerId: string, minute: number) => {
      const state = states.get(playerId);
      if (!state || state.activeSince === null) return;
      const safeMinute = Math.min(Math.max(minute, 0), endMinute);
      state.minutes += Math.max(0, safeMinute - state.activeSince);
      state.activeSince = null;
    };

    const startPlayer = (playerId: string, minute: number) => {
      const state = states.get(playerId);
      if (!state || state.stopped || state.activeSince !== null) return;
      state.activeSince = Math.min(Math.max(minute, 0), endMinute);
    };

    const yellowCounts = new Map<string, number>();
    const events = [
      ...substitutions.map((substitution) => ({
        type: "substitution" as const,
        minute: Number(substitution.minute || 0),
        substitution,
      })),
      ...(match?.incidents ?? []).map((incident) => ({
        type: "incident" as const,
        minute: Number(incident.minute || 0),
        incident,
      })),
    ].sort((a, b) => a.minute - b.minute || (a.type === "incident" ? -1 : 1));

    events.forEach((event) => {
      if (event.type === "substitution") {
        stopPlayer(event.substitution.out_player_id, event.minute);
        startPlayer(event.substitution.in_player_id, event.minute);
        return;
      }

      if (event.incident.incident_type === "yellow_card") {
        const previous = yellowCounts.get(event.incident.player_id) ?? 0;
        yellowCounts.set(event.incident.player_id, previous + 1);
        if (previous + 1 >= 2) {
          stopPlayer(event.incident.player_id, event.minute);
          const state = states.get(event.incident.player_id);
          if (state) state.stopped = true;
        }
        return;
      }

      if (event.incident.incident_type === "red_card") {
        stopPlayer(event.incident.player_id, event.minute);
        const state = states.get(event.incident.player_id);
        if (state) state.stopped = true;
      }
    });

    states.forEach((state) => {
      if (state.activeSince !== null) {
        state.minutes += Math.max(0, endMinute - state.activeSince);
      }
    });

    return new Map(
      [...states.entries()].map(([playerId, state]) => [
        playerId,
        Math.max(0, Math.round(state.minutes)),
      ]),
    );
  }, [attendanceByPlayer, liveMinute, match?.incidents, squadPlayers, substitutions]);
  const currentPlayingPlayers = squadPlayers.filter((player) =>
    currentPlayingIds.has(player.player_id),
  );
  const matchLive = Boolean(
    match && ["first_half", "second_half"].includes(match.match_status),
  );
  const attendanceEditable = Boolean(
    canTakeAttendance && match && match.match_status === "scheduled",
  );
  const benchPlayers = squadPlayers.filter(
    (player) => !currentPlayingIds.has(player.player_id),
  );
  const goalPlayers = currentPlayingPlayers.length
    ? currentPlayingPlayers
    : squadPlayers;
  const substitutionOptions = squadPlayers.filter((player) => {
    const attendance = attendanceByPlayer.get(player.player_id);
    return (
      !currentPlayingIds.has(player.player_id) &&
      !injuredPlayerIds.has(player.player_id) &&
      !redCardedPlayerIds.has(player.player_id) &&
      !doubleYellowPlayerIds.has(player.player_id) &&
      attendance &&
      !["absent", "injured"].includes(attendance.status)
    );
  });
  const attendanceComplete = Boolean(
    squadPlayers.length &&
      squadPlayers.every((player) => attendanceByPlayer.has(player.player_id)),
  );
  const unavailableCurrentPlayers = squadPlayers.filter((player) => {
    const attendance = attendanceByPlayer.get(player.player_id);
    return (
      currentPlayingIds.has(player.player_id) &&
      ["absent", "injured"].includes(attendance?.status ?? "")
    );
  });
  const canStartMatch = Boolean(
    canManageMatches &&
    match &&
      match.match_status === "scheduled" &&
      kickOffReached &&
      attendanceComplete &&
      unavailableCurrentPlayers.length === 0,
  );
  const autoStartKey = `${matchId}:${match?.attendance
    ?.map((record) => `${record.player_id}:${record.status}`)
    .sort()
    .join("|")}`;
  const scoreLine = `${match?.our_score ?? 0} - ${match?.opponent_score ?? 0}`;
  const canRecordGoal = Boolean(
    canManageMatches &&
    match &&
      matchLive &&
      (goalForm.team === "opponent" || goalForm.scorerPlayerId),
  );
  const canRecordIncident = Boolean(
    canManageMatches && match && matchLive,
  );
  const liveVisual = useMemo(() => {
    if (!match) {
      return {
        label: t.live.waiting,
        detail: t.live.noMatchLoaded,
        icon: PauseCircle,
        dotClass: "bg-muted-foreground",
      };
    }
    if (match.match_status === "finished") {
      return {
        label: t.live.finished,
        detail: t.live.finalWhistle,
        icon: Square,
        dotClass: "bg-emerald-400",
      };
    }
    if (match.match_status === "scheduled") {
      return {
        label: t.live.ready,
        detail: t.live.waitingForStart,
        icon: Clock,
        dotClass: "bg-amber-400",
      };
    }
    if (
      match.match_status === "first_half" &&
      liveMinute >= firstHalfLimit
    ) {
      return {
        label: t.live.halfTime,
        detail: t.live.waitingSecondHalf,
        icon: PauseCircle,
        dotClass: "bg-amber-400",
      };
    }
    const inStoppage =
      (match.match_status === "first_half" &&
        liveMinute >= 45 &&
        firstHalfLimit > 45) ||
      (match.match_status === "second_half" &&
        liveMinute >= firstHalfLimit + 45 &&
        secondHalfLimit > 45);
    return {
      label: inStoppage ? t.live.extraTime : t.live.live,
      detail:
        match.match_status === "first_half" ? t.live.firstHalfRunning : t.live.secondHalfRunning,
      icon: inStoppage ? Clock : Radio,
      dotClass: inStoppage ? "bg-amber-400" : "bg-red-500",
    };
  }, [firstHalfLimit, liveMinute, match, secondHalfLimit, t]);
  const LiveIcon = liveVisual.icon;

  const saveAttendance = async (
    playerId: string,
    status: "present" | "absent",
  ) => {
    if (!attendanceEditable) {
      setPageError("Attendance can only be marked before the match starts.");
      return;
    }
    setPageError("");
    try {
      await upsertAttendance({
        matchId,
        records: [{ playerId, status }],
      }).unwrap();
    } catch (error) {
      setPageError(getApiMessage(error, t.saveAttendanceError));
    }
  };

  const changeLiveStatus = async (
    matchStatus: "first_half" | "second_half" | "finished",
  ) => {
    if (!canManageMatches) return false;
    setPageError("");
    try {
      await updateLiveStatus({
        matchId,
        body: {
          matchStatus,
          firstHalfStoppageMinutes: Number(activeFirstHalfStoppage || 0),
          secondHalfStoppageMinutes: Number(activeSecondHalfStoppage || 0),
        },
      }).unwrap();
      return true;
    } catch (error) {
      setPageError(getApiMessage(error, t.updateStatusError));
      return false;
    }
  };

  useEffect(() => {
    if (!canStartMatch || updatingLiveStatus) return;
    if (autoStartAttemptRef.current === autoStartKey) return;

    autoStartAttemptRef.current = autoStartKey;
    updateLiveStatus({
      matchId,
      body: {
        matchStatus: "first_half",
        firstHalfStoppageMinutes: Number(activeFirstHalfStoppage || 0),
        secondHalfStoppageMinutes: Number(activeSecondHalfStoppage || 0),
      },
    })
      .unwrap()
      .catch((error) => {
        setPageError(getApiMessage(error, t.autoStartError));
      });
  }, [
    activeFirstHalfStoppage,
    activeSecondHalfStoppage,
    autoStartKey,
    canStartMatch,
    matchId,
    updateLiveStatus,
    updatingLiveStatus,
    t,
  ]);

  const saveIncident = async (
    playerId: string,
    incidentType: "yellow_card" | "red_card" | "injury",
    bodyPart?: string,
    notes?: string,
  ) => {
    setPageError("");
    try {
      await recordIncident({
        matchId,
        body: { playerId, incidentType, bodyPart, notes, minute: liveMinute },
      }).unwrap();
    } catch (error) {
      setPageError(getApiMessage(error, t.recordIncidentError));
    }
  };

  const undoIncident = async (incidentId: string) => {
    setPageError("");
    try {
      await deleteIncident({ matchId, incidentId }).unwrap();
    } catch (error) {
      setPageError(getApiMessage(error, t.removeIncidentError));
    }
  };

  const saveGoal = async () => {
    if (!canRecordGoal) return;
    setPageError("");
    try {
      await recordGoal({
        matchId,
        body: {
          team: goalForm.team,
          scorerPlayerId:
            goalForm.team === "our" ? goalForm.scorerPlayerId : undefined,
          assistPlayerId:
            goalForm.team === "our" && goalForm.assistPlayerId !== "none"
              ? goalForm.assistPlayerId
              : undefined,
          minute: liveMinute,
          notes: goalForm.notes.trim() || undefined,
        },
      }).unwrap();
      setGoalForm({
        team: "our",
        scorerPlayerId: "",
        assistPlayerId: "none",
        notes: "",
      });
    } catch (error) {
      setPageError(getApiMessage(error, t.recordGoalError));
    }
  };

  const undoGoal = async (goalId: string) => {
    setPageError("");
    try {
      await deleteGoal({ matchId, goalId }).unwrap();
    } catch (error) {
      setPageError(getApiMessage(error, t.removeGoalError));
    }
  };

  const openSubstitutionDialog = (playerId: string, playerName: string) => {
    if (!canManageMatches) return;
    setSubstitutionDialog({ outPlayerId: playerId, outPlayerName: playerName });
    setSubstitutionInPlayerId("");
    setSubstitutionReason("");
  };

  const submitSubstitution = async () => {
    if (!substitutionDialog || !substitutionInPlayerId) return;
    setPageError("");
    try {
      await recordSubstitution({
        matchId,
        body: {
          outPlayerId: substitutionDialog.outPlayerId,
          inPlayerId: substitutionInPlayerId,
          minute: liveMinute,
          reason: substitutionReason.trim() || undefined,
        },
      }).unwrap();
      setSubstitutionDialog(null);
      setSubstitutionInPlayerId("");
      setSubstitutionReason("");
    } catch (error) {
      setPageError(getApiMessage(error, t.recordSubstitutionError));
    }
  };

  const undoSubstitution = async (substitutionId: string) => {
    setPageError("");
    try {
      await deleteSubstitution({ matchId, substitutionId }).unwrap();
    } catch (error) {
      setPageError(getApiMessage(error, t.removeSubstitutionError));
    }
  };

  const confirmFinishMatch = async () => {
    const finished = await changeLiveStatus("finished");
    if (finished) {
      setFinishDialogOpen(false);
      router.push(`/coach/matches/evaluation/${matchId}`);
    }
  };

  const submitInjury = async () => {
    if (!injuryDialog || !injuryBodyPart.trim()) return;
    await saveIncident(
      injuryDialog.playerId,
      "injury",
      injuryBodyPart.trim(),
      injuryNotes.trim() || undefined,
    );
    setInjuryDialog(null);
    setInjuryBodyPart("");
    setInjuryNotes("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.matchDayOperations}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.matches, href: "/coach/matches" },
          { label: t.matchDay },
        ]}
      />

      {isLoading && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingMatch}
          </CardContent>
        </Card>
      )}

      {match && !configured && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div>
              <p className="font-medium">{t.saveTacticsFirst}</p>
              <p className="text-sm text-muted-foreground">
                {t.saveTacticsDescription}
              </p>
            </div>
            <Button asChild>
              <Link href={`/coach/matches/configuration?matchId=${match.id}`}>
                {t.openConfiguration}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {match && configured && !matchDayOpen && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div>
              <p className="font-medium">{t.matchDayLocked}</p>
              <p className="text-sm text-muted-foreground">
                {t.matchDayLockedDescriptionPrefix} {safeMatchDayOpenMinutes} {t.matchDayLockedDescriptionSuffix}
              </p>
            </div>
            <Badge variant="secondary">
              {formatDate(match.match_date)} - {formatTime12(match.match_time)}
            </Badge>
          </CardContent>
        </Card>
      )}

      {match && matchDayOpen && (
        <div className="space-y-6">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.matchData}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">{t.opponent}</p>
                <p className="font-medium">{match.opponent_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.kickoff}</p>
                <p className="font-medium">
                  {formatDate(match.match_date)} -{" "}
                  {formatTime12(match.match_time)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.coach}</p>
                <p className="font-medium">
                  {match.tactics?.coach_name || t.assignedCoach}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.formation}</p>
                <p className="font-medium">{match.tactics?.formation}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">{t.squadAttendance}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...(match.squad ?? [])].map((player) => {
                  const attendance = attendanceByPlayer.get(player.player_id);
                  const stats = match.stats?.find(
                    (record) => record.player_id === player.player_id,
                  );
                  const playerIncidents =
                    match.incidents?.filter(
                      (incident) => incident.player_id === player.player_id,
                    ) ?? [];
                  const lastYellow = playerIncidents.find(
                    (incident) => incident.incident_type === "yellow_card",
                  );
                  const lastRed = playerIncidents.find(
                    (incident) => incident.incident_type === "red_card",
                  );
                  const lastInjury = playerIncidents.find(
                    (incident) => incident.incident_type === "injury",
                  );
                  const preKickoffAbsenceSubstitution =
                    match.match_status === "scheduled" &&
                    player.squad_role === "starter" &&
                    attendance?.status === "absent" &&
                    !substitutedOutIds.has(player.player_id);
                  const liveSubstitution =
                    matchLive &&
                    (currentPlayingIds.has(player.player_id) ||
                      (injuredPlayerIds.has(player.player_id) &&
                        !substitutedOutIds.has(player.player_id)));
                  const canSubPlayer =
                    canManageMatches &&
                    (liveSubstitution || preKickoffAbsenceSubstitution);
                  return (
                    <div
                      key={player.player_id}
                      className="grid gap-4 rounded-md border border-border/40 bg-muted/10 p-4 text-base lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto_auto_auto_auto] lg:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold">
                            {player.player_name}
                          </p>
                          <Badge variant="outline">{player.squad_role}</Badge>
                          {player.position && (
                            <Badge variant="secondary">{player.position}</Badge>
                          )}
                          {currentPlayingIds.has(player.player_id) && (
                            <Badge variant="success">{t.playing}</Badge>
                          )}
                          {substitutedOutIds.has(player.player_id) && (
                            <Badge variant="secondary">{t.subbedOff}</Badge>
                          )}
                          {substitutedInIds.has(player.player_id) && (
                            <Badge variant="outline">{t.subbedIn}</Badge>
                          )}
                          {(redCardedPlayerIds.has(player.player_id) ||
                            doubleYellowPlayerIds.has(player.player_id)) && (
                            <Badge variant="destructive">{t.sentOff}</Badge>
                          )}
                          {injuredPlayerIds.has(player.player_id) && (
                            <Badge variant="warning">{t.injured}</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {player.player_instruction || t.noInstruction}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {liveMinutesByPlayer.get(player.player_id) ??
                              stats?.minutes_played ??
                              0}{" "}
                            min
                          </Badge>
                          <Badge variant="secondary">
                            {t.week} {stats?.weekly_minutes_played ?? 0} min
                            {stats?.weekly_matches_played
                              ? ` / ${stats.weekly_matches_played} ${
                                  stats.weekly_matches_played === 1 ? t.match : t.matchesPlural
                                }`
                              : ""}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {attendance?.status ?? t.notMarked}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          attendance?.status === "present"
                            ? "default"
                            : "outline"
                        }
                        className="gap-2"
                        disabled={
                          !attendanceEditable ||
                          savingAttendance ||
                          match.match_status === "finished"
                        }
                        onClick={() =>
                          saveAttendance(player.player_id, "present")
                        }
                      >
                        <Check className="h-4 w-4" />
                        {t.present}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          attendance?.status === "absent"
                            ? "destructive"
                            : "outline"
                        }
                        className="gap-2"
                        disabled={
                          !attendanceEditable ||
                          savingAttendance ||
                          match.match_status === "finished"
                        }
                        onClick={() =>
                          saveAttendance(player.player_id, "absent")
                        }
                      >
                        <X className="h-4 w-4" />
                        {t.absent}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={
                          recordingSubstitution ||
                          !canSubPlayer ||
                          redCardedPlayerIds.has(player.player_id) ||
                          doubleYellowPlayerIds.has(player.player_id) ||
                          match.match_status === "finished"
                        }
                        onClick={() =>
                          openSubstitutionDialog(
                            player.player_id,
                            player.player_name ?? t.player,
                          )
                        }
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        {t.sub}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          recordingIncident || !canRecordIncident
                        }
                        onClick={() =>
                          saveIncident(player.player_id, "yellow_card")
                        }
                      >
                        {t.yellow}{" "}
                        {stats?.yellow_cards ? `(${stats.yellow_cards})` : ""}
                      </Button>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            recordingIncident || !canRecordIncident
                          }
                          onClick={() =>
                            saveIncident(player.player_id, "red_card")
                          }
                        >
                          {t.red} {stats?.red_cards ? `(${stats.red_cards})` : ""}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={
                            recordingIncident || !canRecordIncident
                          }
                          onClick={() =>
                            setInjuryDialog({
                              playerId: player.player_id,
                              playerName: player.player_name ?? t.player,
                            })
                          }
                        >
                          <AlertTriangle className="h-4 w-4" />
                          {t.injury}
                        </Button>
                      </div>
                      {(lastYellow || lastRed || lastInjury) && (
                        <div className="flex flex-wrap gap-2 lg:col-span-7">
                          {lastYellow && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              disabled={
                                deletingIncident ||
                                match.match_status === "finished"
                              }
                              onClick={() => undoIncident(lastYellow.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              {t.undoYellow}
                            </Button>
                          )}
                          {lastRed && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              disabled={
                                deletingIncident ||
                                match.match_status === "finished"
                              }
                              onClick={() => undoIncident(lastRed.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              {t.undoRed}
                            </Button>
                          )}
                          {lastInjury && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              disabled={
                                deletingIncident ||
                                match.match_status === "finished"
                              }
                              onClick={() => undoIncident(lastInjury.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              {t.undoInjury}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <QrAttendanceScanner
                mode="match"
                id={matchId}
                disabled={
                  !attendanceEditable ||
                  savingAttendance ||
                  match.match_status === "finished"
                }
                onScanSuccess={() => {
                  void refetch();
                }}
              />

              <Card className="border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="text-base">{t.liveMatch}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-border/40 bg-muted/10 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-background/70">
                          <span
                            className={`absolute h-3 w-3 rounded-full ${liveVisual.dotClass} animate-ping opacity-75`}
                          />
                          <span
                            className={`relative h-3 w-3 rounded-full ${liveVisual.dotClass}`}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t.matchStatus}
                          </p>
                          <p className="flex items-center gap-2 font-medium">
                            <LiveIcon className="h-4 w-4" />
                            {liveVisual.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {liveVisual.detail}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{t.minute} {liveMinute}</Badge>
                    </div>
                  </div>
                  {match.match_status === "scheduled" &&
                    (!attendanceComplete ||
                      unavailableCurrentPlayers.length > 0 ||
                      !kickOffReached) && (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="mt-0.5 h-4 w-4" />
                          <div>
                            {attendanceComplete &&
                              unavailableCurrentPlayers.length === 0 &&
                              !kickOffReached && (
                                <p>
                                  {t.attendanceReadyAutoStart}
                                </p>
                              )}
                            {!attendanceComplete && (
                              <p>
                                {t.markAttendanceBeforeKickoff}
                              </p>
                            )}
                            {unavailableCurrentPlayers.length > 0 && (
                              <p className="mt-1">
                                {t.replaceUnavailablePlayers}{" "}
                                {unavailableCurrentPlayers
                                  .map((player) => player.player_name)
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.firstHalfStoppage}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={activeFirstHalfStoppage}
                        onChange={(event) =>
                          setFirstHalfStoppage(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.secondHalfStoppage}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={activeSecondHalfStoppage}
                        onChange={(event) =>
                          setSecondHalfStoppage(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={
                        !canManageMatches ||
                        updatingLiveStatus ||
                        match.match_status !== "scheduled" ||
                        !canStartMatch
                      }
                      onClick={() => changeLiveStatus("first_half")}
                    >
                      <Play className="h-4 w-4" />
                      {t.startMatch}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={
                        !canManageMatches ||
                        updatingLiveStatus ||
                        match.match_status !== "first_half"
                      }
                      onClick={() => changeLiveStatus("second_half")}
                    >
                      <Clock className="h-4 w-4" />
                      {t.startSecondHalf}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={
                        !canManageMatches ||
                        updatingLiveStatus ||
                        !["first_half", "second_half"].includes(
                          match.match_status,
                        )
                      }
                      onClick={() => setFinishDialogOpen(true)}
                    >
                      <Square className="h-4 w-4" />
                      {t.finishMatch}
                    </Button>
                  </div>
                  {substitutions.length > 0 && (
                    <div className="space-y-2 rounded-md border border-border/40 bg-muted/10 p-3">
                      <p className="text-sm font-medium">{t.substitutions}</p>
                      {substitutions.map((substitution) => (
                        <div
                          key={substitution.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {substitution.in_player_name} {t.for}{" "}
                            {substitution.out_player_name}
                            <span className="text-muted-foreground">
                              {" "}
                              ({substitution.minute} min)
                            </span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            disabled={
                              !canManageMatches ||
                              deletingSubstitution ||
                              match.match_status === "finished"
                            }
                            onClick={() => undoSubstitution(substitution.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {t.undo}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pageError && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {pageError}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="text-base">{t.scoreGoals}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-border/40 bg-muted/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      GOALIX vs {match.opponent_name}
                    </p>
                    <p className="mt-1 text-4xl font-semibold">{scoreLine}</p>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label>{t.goalFor}</Label>
                      <Select
                        value={goalForm.team}
                        onValueChange={(value) =>
                          setGoalForm((prev) => ({
                            ...prev,
                            team: value as "our" | "opponent",
                            scorerPlayerId:
                              value === "opponent" ? "" : prev.scorerPlayerId,
                            assistPlayerId:
                              value === "opponent" ? "none" : prev.assistPlayerId,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="our">GOALIX</SelectItem>
                          <SelectItem value="opponent">
                            {match.opponent_name}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {goalForm.team === "our" && (
                      <>
                        <div className="space-y-2">
                          <Label>{t.scorer}</Label>
                          <Select
                            value={goalForm.scorerPlayerId}
                            onValueChange={(value) =>
                              setGoalForm((prev) => ({
                                ...prev,
                                scorerPlayerId: value,
                                assistPlayerId:
                                  prev.assistPlayerId === value
                                    ? "none"
                                    : prev.assistPlayerId,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t.selectScorer} />
                            </SelectTrigger>
                            <SelectContent>
                              {goalPlayers.map((player) => (
                                <SelectItem
                                  key={player.player_id}
                                  value={player.player_id}
                                >
                                  {player.player_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{t.assist}</Label>
                          <Select
                            value={goalForm.assistPlayerId}
                            onValueChange={(value) =>
                              setGoalForm((prev) => ({
                                ...prev,
                                assistPlayerId: value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t.noAssist} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t.noAssist}</SelectItem>
                              {goalPlayers
                                .filter(
                                  (player) =>
                                    player.player_id !== goalForm.scorerPlayerId,
                                )
                                .map((player) => (
                                  <SelectItem
                                    key={player.player_id}
                                    value={player.player_id}
                                  >
                                    {player.player_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label>{t.goalNote}</Label>
                      <Textarea
                        value={goalForm.notes}
                        onChange={(event) =>
                          setGoalForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        placeholder={t.optionalNote}
                      />
                    </div>

                    <Button
                      type="button"
                      className="gap-2"
                      disabled={!canRecordGoal || recordingGoal}
                      onClick={saveGoal}
                    >
                      {recordingGoal ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {t.addGoal}
                    </Button>
                    {!["first_half", "second_half"].includes(
                      match.match_status,
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        {t.startBeforeGoals}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {match.goal_events?.map((goal) => (
                      <div
                        key={goal.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/10 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {goal.team === "our"
                              ? goal.scorer_player_name || t.goalixGoal
                              : `${match.opponent_name} ${t.opponentGoal}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.minute} {goal.minute}
                            {goal.assist_player_name
                              ? ` · ${t.assist} ${goal.assist_player_name}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-2"
                          disabled={
                            !canManageMatches ||
                            deletingGoal ||
                            match.match_status === "finished"
                          }
                          onClick={() => undoGoal(goal.id)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {t.undo}
                        </Button>
                      </div>
                    ))}
                    {!match.goal_events?.length && (
                      <p className="text-sm text-muted-foreground">
                        {t.noGoals}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="text-base">{t.lineupSummary}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t.currentOnField}
                    </p>
                    <div className="space-y-2">
                      {currentPlayingPlayers.map((player) => (
                        <div
                          key={player.player_id}
                          className="flex items-center justify-between rounded-md bg-muted/10 px-3 py-2 text-sm"
                        >
                          <span>{player.player_name}</span>
                          <Badge variant="outline">
                            {player.position || t.position}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t.benchSubbedOff}
                    </p>
                    <div className="space-y-2">
                      {benchPlayers.length ? (
                        benchPlayers.map((player) => (
                          <div
                            key={player.player_id}
                            className="flex items-center justify-between rounded-md bg-muted/10 px-3 py-2 text-sm"
                          >
                            <span>{player.player_name}</span>
                            <Badge variant="outline">
                              {substitutedOutIds.has(player.player_id)
                                ? t.subbedOff
                                : player.squad_role}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t.noSubstitutes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !match && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {t.matchNotFound}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(substitutionDialog)}
        onOpenChange={(value) => {
          if (!value) {
            setSubstitutionDialog(null);
            setSubstitutionInPlayerId("");
            setSubstitutionReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.recordSubstitution}</DialogTitle>
            <DialogDescription>
              {t.substitutionDescriptionPrefix} {substitutionDialog?.outPlayerName}. {t.substitutionDescriptionSuffix}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t.playerComingOn}</Label>
              <Select
                value={substitutionInPlayerId}
                onValueChange={setSubstitutionInPlayerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectReplacement} />
                </SelectTrigger>
                <SelectContent>
                  {substitutionOptions.map((player) => (
                    <SelectItem key={player.player_id} value={player.player_id}>
                      {player.player_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!substitutionOptions.length && (
                <p className="text-xs text-muted-foreground">
                  {t.markSubPresent}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t.reason}</Label>
              <Textarea
                value={substitutionReason}
                onChange={(event) => setSubstitutionReason(event.target.value)}
                placeholder={t.substitutionReasonPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubstitutionDialog(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              disabled={!substitutionInPlayerId || recordingSubstitution}
              onClick={submitSubstitution}
              className="gap-2"
            >
              {recordingSubstitution && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t.saveSubstitution}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.finishQuestion}</DialogTitle>
            <DialogDescription>
              {t.finishDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFinishDialogOpen(false)}
            >
              {t.keepMatchOpen}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={!canManageMatches || updatingLiveStatus}
              onClick={confirmFinishMatch}
            >
              {updatingLiveStatus && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t.finishMatch}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(injuryDialog)}
        onOpenChange={(value) => {
          if (!value) {
            setInjuryDialog(null);
            setInjuryBodyPart("");
            setInjuryNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.recordInjury}</DialogTitle>
            <DialogDescription>
              {t.injuryDescriptionPrefix} {injuryDialog?.playerName}. {t.injuryDescriptionSuffix}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t.bodyPart}</Label>
              <Input
                value={injuryBodyPart}
                onChange={(event) => setInjuryBodyPart(event.target.value)}
                placeholder={t.bodyPartPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.notes}</Label>
              <Textarea
                value={injuryNotes}
                onChange={(event) => setInjuryNotes(event.target.value)}
                placeholder={t.medicalNotePlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInjuryDialog(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              disabled={!injuryBodyPart.trim() || recordingIncident}
              onClick={submitInjury}
            >
              {recordingIncident && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t.saveInjury}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
