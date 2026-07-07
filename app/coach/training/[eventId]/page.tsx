"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  Check,
  Clock,
  Loader2,
  LockKeyhole,
  Save,
  Search,
  Send,
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
  useExtendCoachTrainingEventMutation,
  useGetCoachTrainingEventQuery,
  useUpsertTrainingAttendanceMutation,
  useUpsertTrainingEvaluationsMutation,
} from "@/lib/store/api/calendarApi";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import type { TrainingParticipant } from "@/lib/store/api/calendarApi";
import { formatDate, formatTime12 } from "@/lib/utils";

let trainingDetailClockSnapshot = 0;
const subscribeTrainingDetailClock = (onStoreChange: () => void) => {
  trainingDetailClockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    trainingDetailClockSnapshot = Date.now();
    onStoreChange();
  }, 1000);
  return () => window.clearInterval(intervalId);
};
const getTrainingDetailClockSnapshot = () => trainingDetailClockSnapshot;
const getServerTrainingDetailClockSnapshot = () => 0;

const ratingFields = [
  ["overallRating", "Overall"],
  ["ballControlRating", "Ball Control"],
  ["passingAccuracyRating", "Passing Accuracy"],
  ["shootingRating", "Shooting"],
  ["dribblingRating", "Dribbling"],
  ["receivingUnderPressureRating", "Receiving Under Pressure"],
  ["speedRating", "Speed"],
  ["enduranceRating", "Endurance"],
  ["fatigueRating", "Fatigue"],
  ["strengthRating", "Strength"],
  ["agilityRating", "Agility"],
] as const;

const goalkeeperRatingFields = [
  ["ballControlRating", "Handling"],
  ["passingAccuracyRating", "Distribution"],
  ["shootingRating", "Shot Stopping"],
  ["dribblingRating", "1v1 / Sweeper"],
  ["receivingUnderPressureRating", "Crosses / High Balls"],
  ["speedRating", "Reactions"],
  ["enduranceRating", "Concentration"],
  ["fatigueRating", "Fatigue"],
  ["strengthRating", "Command of Area"],
  ["agilityRating", "Footwork / Agility"],
] as const;

type RatingOption = {
  label: "Poor" | "Good" | "Very Good" | "Excellent";
  range: string;
  value: number;
  min: number;
  max: number;
};

const rating10Options: RatingOption[] = [
  { label: "Poor", range: "0-3.9", value: 1.95, min: 0, max: 3.9 },
  { label: "Good", range: "4-6.4", value: 5.2, min: 4, max: 6.4 },
  { label: "Very Good", range: "6.5-8.4", value: 7.45, min: 6.5, max: 8.4 },
  { label: "Excellent", range: "8.5-10", value: 9.25, min: 8.5, max: 10 },
];

const optionValue = (value: string) => {
  if (value === "") return "";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "";
  const exact = rating10Options.find((option) => option.value === numeric);
  if (exact) return String(exact.value);
  const ranged = rating10Options.find(
    (option) => numeric >= option.min && numeric <= option.max,
  );
  return ranged ? String(ranged.value) : "";
};

const nowTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
};

const toNumberOrUndefined = (value: string) =>
  value === "" ? undefined : Number(value);

const clampRatingInput = (value: string) => {
  if (value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return String(Math.max(0, Math.min(10, numeric)));
};

const evaluationVisibility = (player: TrainingParticipant) =>
  player.evaluation?.visibility ?? "private";

const visibilityLabel = (visibility: string | null | undefined) =>
  visibility === "player_and_parent" ? "Published" : "Not published";

const isGoalkeeperPosition = (position?: string | null) => {
  const normalized = String(position ?? "").trim().toLowerCase();
  return normalized === "gk" || normalized.includes("goalkeeper");
};

const customProfileValue = (
  player: Pick<TrainingParticipant, "customProfile">,
  key: string,
  label: string,
) => {
  const field = player.customProfile.find(
    (item) =>
      item.key.toLowerCase() === key.toLowerCase() ||
      item.label.toLowerCase() === label.toLowerCase(),
  );
  const value = field?.value;
  return value === null || value === undefined ? "" : String(value);
};

const playerMainPosition = (
  player: Pick<TrainingParticipant, "position" | "customProfile">,
) => customProfileValue(player, "main_position", "Main Position") || player.position || "";

const WARNING_BEFORE_END_MS = 5 * 60 * 1000;
const FINAL_AUTOSAVE_BEFORE_END_MS = 10 * 1000;
const MAX_EXTENSION_MINUTES = 60;
const COACH_EVALUATION_MODE_KEY = "goalix-coach-training-evaluation-mode";

const initialEvaluationMode = (): "all" | "search" => {
  if (typeof window === "undefined") return "all";
  return window.localStorage.getItem(COACH_EVALUATION_MODE_KEY) === "search"
    ? "search"
    : "all";
};

const trainingDetailCopy = {
  en: {
    evaluationView: "Evaluation View",
    attendedReady: "{count} attended players ready for review.",
    published: "published",
    saveAll: "Save All",
    publishTrainingEvaluations: "Publish Training Evaluations",
    allPlayers: "All players",
    searchPlayer: "Search player",
    searchAttendedPlayers: "Search attended players",
    noPosition: "No position",
    noGroup: "No group",
    selectPlayerPrompt: "Select a player to open his evaluation section.",
    overall: "Overall /10",
    selectRating: "Select rating",
    saveEvaluation: "Save Evaluation",
    trainingClosesSoon: "Training closes soon",
    closesDescription: "This training closes in {count} minutes. Current attendance times and player evaluations are being auto-saved.",
    currentWindow: "Current window",
    extendByMinutes: "Extend by minutes",
    maxExtension: "Maximum total extension is one hour.",
    attendance: "Attendance",
    ok: "OK",
    extendTime: "Extend Time",
  },
  ar: {
    evaluationView: "عرض التقييم",
    attendedReady: "{count} لاعب حاضر جاهز للمراجعة.",
    published: "منشور",
    saveAll: "حفظ الكل",
    publishTrainingEvaluations: "نشر تقييمات التدريب",
    allPlayers: "كل اللاعبين",
    searchPlayer: "البحث عن لاعب",
    searchAttendedPlayers: "ابحث في اللاعبين الحاضرين",
    noPosition: "لا يوجد مركز",
    noGroup: "لا توجد مجموعة",
    selectPlayerPrompt: "اختر لاعبًا لفتح قسم التقييم الخاص به.",
    overall: "الإجمالي /10",
    selectRating: "اختر التقييم",
    saveEvaluation: "حفظ التقييم",
    trainingClosesSoon: "التدريب سيغلق قريبًا",
    closesDescription: "سيغلق هذا التدريب خلال {count} دقيقة. يتم حفظ أوقات الحضور وتقييمات اللاعبين تلقائيًا.",
    currentWindow: "النافذة الحالية",
    extendByMinutes: "التمديد بالدقائق",
    maxExtension: "الحد الأقصى للتمديد ساعة واحدة.",
    attendance: "الحضور",
    ok: "حسنًا",
    extendTime: "تمديد الوقت",
  },
} as const;

export default function CoachTrainingEventPage() {
  const language = useDashboardLanguage();
  const t = trainingDetailCopy[language];
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { can } = useCoachPermissions();
  const canTakeAttendance = can("can_take_attendance");
  const canEvaluatePlayers = can("can_evaluate_players");
  const canManageTraining = can("can_create_training");
  const { data: event, isLoading, isError, refetch } =
    useGetCoachTrainingEventQuery(eventId);
  const nowMs = useSyncExternalStore(
    subscribeTrainingDetailClock,
    getTrainingDetailClockSnapshot,
    getServerTrainingDetailClockSnapshot,
  );
  const [upsertAttendance, { isLoading: savingAttendance }] =
    useUpsertTrainingAttendanceMutation();
  const [upsertEvaluations, { isLoading: savingEvaluation }] =
    useUpsertTrainingEvaluationsMutation();
  const [extendTraining, { isLoading: extendingTraining }] =
    useExtendCoachTrainingEventMutation();
  const warningAutoSaveKeyRef = useRef("");
  const finalAutoSaveAtRef = useRef(0);
  const [arrivalTimes, setArrivalTimes] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [evaluationMode, setEvaluationMode] =
    useState<"all" | "search">(initialEvaluationMode);
  const [evaluationSearch, setEvaluationSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [pageError, setPageError] = useState("");
  const [warningDismissedEndKey, setWarningDismissedEndKey] = useState("");
  const [extensionMinutes, setExtensionMinutes] = useState("10");
  const [autoSaving, setAutoSaving] = useState(false);
  const trainingStartMs = event ? Date.parse(event.start_datetime) : 0;
  const trainingEndMs = event ? Date.parse(event.end_datetime) : 0;
  const trainingOpen = Boolean(
    event &&
      event.status === "scheduled" &&
      nowMs >= trainingStartMs &&
      nowMs < trainingEndMs,
  );
  const trainingClosed = Boolean(
    event &&
      (event.status === "completed" ||
        event.status === "finished" ||
        nowMs >= trainingEndMs),
  );
  const trainingEndKey = event?.end_datetime ?? "";
  const minutesUntilClose = Math.max(
    0,
    Math.ceil((trainingEndMs - nowMs) / 60000),
  );
  const warningWindowOpen = Boolean(
    trainingOpen &&
      trainingEndMs - nowMs <= WARNING_BEFORE_END_MS &&
      trainingEndMs > nowMs,
  );
  const showClosingWarning = Boolean(
    warningWindowOpen &&
      (canTakeAttendance || canEvaluatePlayers || canManageTraining) &&
      warningDismissedEndKey !== trainingEndKey,
  );
  const evaluationEditable = Boolean(
    canEvaluatePlayers &&
    event &&
      event.status !== "cancelled" &&
      event.status !== "postponed" &&
      nowMs >= trainingStartMs,
  );
  const attendanceEditable = Boolean(
    canTakeAttendance &&
    event &&
      event.status !== "cancelled" &&
      event.status !== "postponed" &&
      nowMs >= trainingStartMs,
  );

  const participants = useMemo(
    () => event?.participants ?? [],
    [event?.participants],
  );
  const attendedPlayers = useMemo(
    () =>
      participants.filter((player) =>
        ["present", "late"].includes(player.attendance?.status ?? ""),
      ),
    [participants],
  );
  const filteredEvaluationPlayers = useMemo(() => {
    const query = evaluationSearch.trim().toLowerCase();
    if (!query) return attendedPlayers;
    return attendedPlayers.filter((player) =>
      `${player.full_name} ${playerMainPosition(player)} ${player.position ?? ""} ${player.group_name ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [attendedPlayers, evaluationSearch]);
  const visibleEvaluationPlayers =
    evaluationMode === "all"
      ? attendedPlayers
      : selectedPlayerId
        ? attendedPlayers.filter((player) => player.id === selectedPlayerId)
        : [];
  const publishedEvaluationCount = attendedPlayers.filter(
    (player) =>
      (drafts[player.id]?.visibility ?? evaluationVisibility(player)) ===
      "player_and_parent",
  ).length;
  const allEvaluationsPublished = Boolean(
    attendedPlayers.length && publishedEvaluationCount === attendedPlayers.length,
  );

  useEffect(() => {
    window.localStorage.setItem(COACH_EVALUATION_MODE_KEY, evaluationMode);
  }, [evaluationMode]);

  useEffect(() => {
    const syncCoachSettings = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const mode = (event.detail as { evaluationMode?: string }).evaluationMode;
      if (mode === "all" || mode === "search") {
        setEvaluationMode(mode);
        if (mode === "all") setSelectedPlayerId("");
      }
    };

    window.addEventListener("goalix-coach-settings-changed", syncCoachSettings);
    return () =>
      window.removeEventListener(
        "goalix-coach-settings-changed",
        syncCoachSettings,
      );
  }, []);

  const saveAttendance = async (
    player: TrainingParticipant,
    status: "present" | "late" | "absent" | "injured",
  ) => {
    if (!attendanceEditable) {
      setPageError("Attendance can be changed after the training starts.");
      return;
    }
    const manualArrivalTime =
      arrivalTimes[player.id] || player.attendance?.arrival_time?.slice(0, 5) || "";
    if (trainingClosed && ["present", "late"].includes(status) && !manualArrivalTime) {
      setPageError(
        "Add a manual arrival time before marking attendance after training is closed.",
      );
      return;
    }
    setPageError("");
    try {
      await upsertAttendance({
        eventId,
        records: [
          {
            playerId: player.id,
            status,
            arrivalTime:
              status === "present" || status === "late"
                ? trainingOpen
                  ? arrivalTimes[player.id] || nowTime()
                  : manualArrivalTime
                : undefined,
          },
        ],
      }).unwrap();
    } catch {
      setPageError("Could not save attendance.");
    }
  };

  const fieldValue = (player: TrainingParticipant, field: string) => {
    if (drafts[player.id]?.[field] !== undefined) return drafts[player.id][field];
    const snake = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return String(
      (player.evaluation as unknown as Record<string, string | number | null>)?.[
        snake
      ] ?? "",
    );
  };

  const saveDraftedTrainingData = useCallback(async (
    options: { includeAttendance?: boolean; publishAll?: boolean } = {},
  ) => {
    const includeAttendance = options.includeAttendance ?? trainingOpen;
    const attendanceRecords = participants
      .filter((player) => {
        const status = player.attendance?.status;
        return (
          includeAttendance &&
          (status === "present" || status === "late") &&
          Boolean(arrivalTimes[player.id])
        );
      })
      .map((player) => ({
        playerId: player.id,
        status: player.attendance?.status,
        arrivalTime: arrivalTimes[player.id],
      }));

    if (canTakeAttendance && attendanceRecords.length) {
      await upsertAttendance({
        eventId,
        records: attendanceRecords,
      }).unwrap();
    }

    if (canEvaluatePlayers && attendedPlayers.length) {
      await upsertEvaluations({
        eventId,
        records: attendedPlayers.map((player) => {
          const draft = drafts[player.id] ?? {};
          const getValue = (field: string) => {
            if (draft[field] !== undefined) return draft[field];
            const snake = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            return String(
              (player.evaluation as unknown as Record<
                string,
                string | number | null
              >)?.[snake] ?? "",
            );
          };

          return {
            playerId: player.id,
            ...Object.fromEntries(
              ratingFields.map(([key]) => [
                key,
                toNumberOrUndefined(clampRatingInput(getValue(key))),
              ]),
            ),
            strengths: draft.strengths ?? player.evaluation?.strengths ?? "",
            weaknesses: draft.weaknesses ?? player.evaluation?.weaknesses ?? "",
            coachNotes: draft.coachNotes ?? player.evaluation?.coach_notes ?? "",
            improvementPlan:
              draft.improvementPlan ?? player.evaluation?.improvement_plan ?? "",
            developmentNotes:
              draft.developmentNotes ??
              player.evaluation?.development_notes ??
              "",
            visibility: options.publishAll
              ? "player_and_parent"
              : draft.visibility ?? player.evaluation?.visibility ?? "private",
          };
        }),
      }).unwrap();
    }
  }, [
    arrivalTimes,
    attendedPlayers,
    canEvaluatePlayers,
    canTakeAttendance,
    drafts,
    eventId,
    participants,
    trainingOpen,
    upsertAttendance,
    upsertEvaluations,
  ]);

  const saveEvaluation = async (player: TrainingParticipant) => {
    if (!evaluationEditable) {
      setPageError("Evaluations can be saved after the training starts.");
      return;
    }
    const draft = drafts[player.id] ?? {};
    setPageError("");
    try {
      await upsertEvaluations({
        eventId,
        records: [
          {
            playerId: player.id,
            ...Object.fromEntries(
              ratingFields.map(([key]) => [
                key,
                toNumberOrUndefined(
                  clampRatingInput(draft[key] ?? fieldValue(player, key)),
                ),
              ]),
            ),
            strengths: draft.strengths ?? player.evaluation?.strengths ?? "",
            weaknesses: draft.weaknesses ?? player.evaluation?.weaknesses ?? "",
            coachNotes: draft.coachNotes ?? player.evaluation?.coach_notes ?? "",
            improvementPlan:
              draft.improvementPlan ?? player.evaluation?.improvement_plan ?? "",
            developmentNotes:
              draft.developmentNotes ?? player.evaluation?.development_notes ?? "",
            visibility:
              draft.visibility ??
              player.evaluation?.visibility ??
              "private",
          },
        ],
      }).unwrap();
      setDrafts((prev) => ({ ...prev, [player.id]: {} }));
    } catch {
      setPageError("Could not save evaluation.");
    }
  };

  const saveAllEvaluations = async () => {
    if (!evaluationEditable) {
      setPageError("Evaluations can be saved after the training starts.");
      return;
    }
    if (!attendedPlayers.length) {
      setPageError("No attended players are available for evaluation.");
      return;
    }
    setPageError("");
    try {
      await saveDraftedTrainingData({ includeAttendance: trainingOpen });
      setDrafts({});
    } catch {
      setPageError("Could not save evaluations.");
    }
  };

  const publishAllEvaluations = async () => {
    if (!evaluationEditable) {
      setPageError("Evaluations can be published after the training starts.");
      return;
    }
    if (!attendedPlayers.length) {
      setPageError("No attended players are available for publishing.");
      return;
    }
    setPageError("");
    try {
      await saveDraftedTrainingData({
        includeAttendance: trainingOpen,
        publishAll: true,
      });
      setDrafts(
        Object.fromEntries(
          attendedPlayers.map((player) => [
            player.id,
            { visibility: "player_and_parent" },
          ]),
        ),
      );
    } catch {
      setPageError("Could not publish evaluations.");
    }
  };

  useEffect(() => {
    if (!warningWindowOpen || !trainingEndKey) return;
    if (warningAutoSaveKeyRef.current === trainingEndKey) return;

    warningAutoSaveKeyRef.current = trainingEndKey;
    saveDraftedTrainingData().catch(() => {
      setPageError("Could not auto-save training data.");
    });
  }, [saveDraftedTrainingData, trainingEndKey, warningWindowOpen]);

  useEffect(() => {
    if (!trainingOpen || !trainingEndKey) return;
    const timeLeft = trainingEndMs - nowMs;
    if (timeLeft > FINAL_AUTOSAVE_BEFORE_END_MS) return;
    if (nowMs - finalAutoSaveAtRef.current < 3000) return;

    finalAutoSaveAtRef.current = nowMs;
    saveDraftedTrainingData().catch(() => {
      setPageError("Could not auto-save training data before closing.");
    });
  }, [
    nowMs,
    saveDraftedTrainingData,
    trainingEndKey,
    trainingEndMs,
    trainingOpen,
  ]);

  const acknowledgeClosingWarning = async () => {
    if (!trainingEndKey) return;
    setAutoSaving(true);
    setPageError("");
    try {
      await saveDraftedTrainingData();
      setWarningDismissedEndKey(trainingEndKey);
    } catch {
      setPageError("Could not auto-save training data.");
    } finally {
      setAutoSaving(false);
    }
  };

  const extendTrainingTime = async () => {
    const minutes = Math.min(
      MAX_EXTENSION_MINUTES,
      Math.max(1, Number(extensionMinutes) || 1),
    );
    setAutoSaving(true);
    setPageError("");
    try {
      await saveDraftedTrainingData();
      await extendTraining({ id: eventId, minutes }).unwrap();
      setExtensionMinutes("10");
      setWarningDismissedEndKey("");
      warningAutoSaveKeyRef.current = "";
      finalAutoSaveAtRef.current = 0;
    } catch {
      setPageError("Could not extend training time.");
    } finally {
      setAutoSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={event?.title ?? "Training"}
        description="Attendance, player details, and training evaluation."
        breadcrumbs={[
          { label: "Home", href: "/coach/home" },
          { label: "Calendar", href: "/coach/calendar" },
          { label: "Training" },
        ]}
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading training...
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-destructive">
            <span>
              Could not load this training session. Your session may need refresh,
              or the backend may be rate-limited from repeated requests.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {event && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <InfoTile label="Date" value={formatDate(event.start_datetime)} />
            <InfoTile
              label="Time"
              value={`${formatTime12(event.start_datetime)} - ${formatTime12(
                event.end_datetime,
              )}`}
            />
            <InfoTile
              label="Focus"
              value={event.training?.training_focus?.replaceAll("_", " ") ?? "-"}
            />
            <InfoTile
              label="Players"
              value={`${participants.length} targeted`}
            />
          </div>

          {!trainingOpen && (
            <div className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {trainingClosed ? "Training is closed" : "Training is not open yet"}
                </p>
                <p className="mt-1">
                  {trainingClosed
                    ? "Attendance can still be corrected manually. Add an arrival time for present or late players."
                    : `Open window: ${formatTime12(event.start_datetime)} - ${formatTime12(event.end_datetime)}`}
                </p>
              </div>
            </div>
          )}

          {pageError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {pageError}
            </p>
          )}

          <QrAttendanceScanner
            mode="training"
            id={eventId}
            disabled={!canTakeAttendance || !trainingOpen || savingAttendance}
            onScanSuccess={() => {
              void refetch();
            }}
          />

          {canTakeAttendance && <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.attendance}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {participants.map((player) => (
                <div
                  key={player.id}
                  className="grid gap-3 rounded-md border border-border/50 p-3 lg:grid-cols-[1fr_140px_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{player.full_name}</p>
                      <Badge variant="outline">
                        {player.attendance?.status ?? "not marked"}
                      </Badge>
                      {player.group_name && (
                        <Badge variant="secondary">{player.group_name}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {player.username ?? "no username"} -{" "}
                      {player.phone ?? player.account_phone ?? "no phone"} -{" "}
                      Guardian {player.guardian_phone ?? "-"}
                    </p>
                  </div>
                  <Input
                    type="time"
                    disabled={!attendanceEditable}
                    value={
                      arrivalTimes[player.id] ??
                      player.attendance?.arrival_time?.slice(0, 5) ??
                      ""
                    }
                    onChange={(event) =>
                      setArrivalTimes((prev) => ({
                        ...prev,
                        [player.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingAttendance || !attendanceEditable}
                      onClick={() => saveAttendance(player, "present")}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingAttendance || !attendanceEditable}
                      onClick={() => saveAttendance(player, "late")}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingAttendance || !attendanceEditable}
                      onClick={() => saveAttendance(player, "absent")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>}

          {canEvaluatePlayers && <Card className="border-border/50 bg-card">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t.evaluationView}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.attendedReady.replace("{count}", String(attendedPlayers.length))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={allEvaluationsPublished ? "success" : "secondary"}
                  >
                    {publishedEvaluationCount}/{attendedPlayers.length} {t.published}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={
                      savingEvaluation ||
                      !evaluationEditable ||
                      !attendedPlayers.length
                    }
                    onClick={saveAllEvaluations}
                  >
                    {savingEvaluation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t.saveAll}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    disabled={
                      savingEvaluation ||
                      !evaluationEditable ||
                      !attendedPlayers.length
                    }
                    onClick={publishAllEvaluations}
                  >
                    {savingEvaluation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t.publishTrainingEvaluations}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={evaluationMode === "all" ? "default" : "outline"}
                    onClick={() => {
                      setEvaluationMode("all");
                      setSelectedPlayerId("");
                    }}
                  >
                    {t.allPlayers}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={evaluationMode === "search" ? "default" : "outline"}
                    onClick={() => setEvaluationMode("search")}
                  >
                    {t.searchPlayer}
                  </Button>
                </div>
              </div>

              {evaluationMode === "search" && (
                <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={evaluationSearch}
                        onChange={(event) =>
                          setEvaluationSearch(event.target.value)
                        }
                        placeholder={t.searchAttendedPlayers}
                      />
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {filteredEvaluationPlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            selectedPlayerId === player.id
                              ? "border-primary bg-primary/10"
                              : "border-border/50 hover:bg-muted/30"
                          }`}
                          onClick={() => setSelectedPlayerId(player.id)}
                        >
                          <span className="font-medium">{player.full_name}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {player.position ?? t.noPosition} -{" "}
                            {player.group_name ?? t.noGroup}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {!selectedPlayerId && (
                    <div className="flex min-h-40 items-center justify-center rounded-md border border-border/50 text-sm text-muted-foreground">
                      {t.selectPlayerPrompt}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>}

          <div className="space-y-4">
            {visibleEvaluationPlayers.map((player) => {
              const mainPosition = playerMainPosition(player);
              const activeRatingFields = isGoalkeeperPosition(mainPosition)
                ? goalkeeperRatingFields
                : ratingFields.slice(1);

              return (
              <Card key={player.id} className="border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                    <span className="flex flex-wrap items-center gap-2">
                      {player.full_name}
                      {isGoalkeeperPosition(mainPosition) && (
                        <Badge variant="secondary">GK</Badge>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Badge variant="info">
                        {player.totals.attendance.present +
                          player.totals.attendance.late}{" "}
                        attended
                      </Badge>
                      <Badge variant="warning">
                        {player.totals.attendance.absent} absent
                      </Badge>
                      <Badge variant="outline">
                        {player.totals.matches.minutes_played} match min
                      </Badge>
                      <Badge
                        variant={
                          (
                            drafts[player.id]?.visibility ??
                            evaluationVisibility(player)
                          ) === "player_and_parent"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {visibilityLabel(
                          drafts[player.id]?.visibility ??
                            evaluationVisibility(player),
                        )}
                      </Badge>
                      <Badge variant="destructive">
                        {player.totals.injuries} injuries
                      </Badge>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <InfoTile
                      label="Matches"
                      value={String(player.totals.matches.matches_played)}
                    />
                    <InfoTile
                      label="Goals / Assists"
                      value={`${player.totals.matches.goals} / ${player.totals.matches.assists}`}
                    />
                    <InfoTile
                      label="Pass Accuracy"
                      value={
                        player.totals.matches.pass_accuracy_percentage
                          ? `${player.totals.matches.pass_accuracy_percentage}%`
                          : "-"
                      }
                    />
                    <InfoTile
                      label="Match Rating"
                      value={String(player.totals.matches.average_rating ?? "-")}
                    />
                  </div>

                  {player.customProfile.length > 0 && (
                    <div className="grid gap-2 md:grid-cols-3">
                      {player.customProfile.slice(0, 9).map((field) => (
                        <div
                          key={`${player.id}-${field.key}`}
                          className="rounded-md border border-border/40 px-3 py-2 text-sm"
                        >
                          <p className="text-xs text-muted-foreground">
                            {field.label}
                          </p>
                          <p className="font-medium">{String(field.value ?? "-")}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1">
                      <Label>{t.overall}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        disabled={!evaluationEditable}
                        value={fieldValue(player, "overallRating")}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [player.id]: {
                              ...(prev[player.id] ?? {}),
                              overallRating: clampRatingInput(event.target.value),
                            },
                          }))
                        }
                        />
                      </div>
                    {activeRatingFields.map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label>{label} /10</Label>
                        <Select
                          disabled={!evaluationEditable}
                          value={
                            drafts[player.id]?.[key] !== undefined
                              ? drafts[player.id][key]
                              : optionValue(fieldValue(player, key))
                          }
                          onValueChange={(value) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [player.id]: {
                                ...(prev[player.id] ?? {}),
                                [key]: value,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t.selectRating} />
                          </SelectTrigger>
                          <SelectContent>
                            {rating10Options.map((option) => (
                              <SelectItem
                                key={`${key}-${option.label}`}
                                value={String(option.value)}
                              >
                                {option.label} ({option.range})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {[
                      ["strengths", "Strengths"],
                      ["weaknesses", "Weaknesses"],
                      ["coachNotes", "Coach Notes"],
                      ["developmentNotes", "Development Notes"],
                      ["improvementPlan", "Improvement Plan"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label>{label}</Label>
                        <Textarea
                          disabled={!evaluationEditable}
                          value={
                            drafts[player.id]?.[key] ??
                            String(
                              (player.evaluation as unknown as Record<
                                string,
                                string | null
                              >)?.[
                                key === "coachNotes"
                                  ? "coach_notes"
                                  : key.replace(/[A-Z]/g, (letter) =>
                                      `_${letter.toLowerCase()}`,
                                    )
                              ] ?? "",
                            )
                          }
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [player.id]: {
                                ...(prev[player.id] ?? {}),
                                [key]: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {player.monthlyProgress.slice(-6).map((point) => (
                        <Badge key={point.month} variant="outline">
                          <Activity className="mr-1 h-3 w-3" />
                          {point.month}: {point.average_rating ?? "-"}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <Button
                        type="button"
                        className="gap-2"
                        disabled={savingEvaluation || !evaluationEditable}
                        onClick={() => saveEvaluation(player)}
                      >
                        <Save className="h-4 w-4" />
                        {t.saveEvaluation}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        open={showClosingWarning}
        onOpenChange={(open) => {
          if (!open && trainingEndKey) {
            setWarningDismissedEndKey(trainingEndKey);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.trainingClosesSoon}</DialogTitle>
            <DialogDescription>
              {t.closesDescription.replace("{count}", String(minutesUntilClose))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">{t.currentWindow}</p>
              <p className="mt-1 font-medium">
                {event
                  ? `${formatTime12(event.start_datetime)} - ${formatTime12(
                      event.end_datetime,
                    )}`
                  : "-"}
              </p>
            </div>
            {canManageTraining && (
              <div className="space-y-2">
                <Label>{t.extendByMinutes}</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_EXTENSION_MINUTES}
                  value={extensionMinutes}
                  onChange={(changeEvent) =>
                    setExtensionMinutes(changeEvent.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t.maxExtension}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={autoSaving || extendingTraining}
              onClick={acknowledgeClosingWarning}
            >
              {autoSaving && !extendingTraining && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t.ok}
            </Button>
            {canManageTraining && (
              <Button
                type="button"
                className="gap-2"
                disabled={autoSaving || extendingTraining}
                onClick={extendTrainingTime}
              >
                {extendingTraining && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t.extendTime}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/10 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
  );
}
