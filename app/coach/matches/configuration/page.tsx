"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Loader2, Save, UserMinus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  type CoachPlayer,
  type InjuryRiskPredictionRecord,
  type Match,
  useGetCoachAdminMatchRequestsQuery,
  useGetCoachGroupsScopedQuery,
  useGetInjuryRiskPredictionsQuery,
  useGetCoachMatchQuery,
  useGetCoachMatchesQuery,
  useGetCoachPlayersScopedQuery,
  useUpdateCoachMatchTargetsMutation,
  useUpsertMatchSquadMutation,
  useUpsertMatchTacticsMutation,
} from "@/lib/store/api/calendarApi";
import { useGetCoachBirthdaysQuery } from "@/lib/store/api/coachApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { FORMATIONS, getFormationSlots } from "@/lib/football/formations";
import { formatDate, localDateTimeTimestamp } from "@/lib/utils";

const FormationPreview3D = dynamic(
  () => import("@/components/coach/FormationPreview3D").then((mod) => mod.FormationPreview3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-[var(--gx-border)] bg-[var(--gx-card)] text-sm font-semibold text-[var(--gx-muted)]">
        ...
      </div>
    ),
  }
);

type TargetMode = "group" | "birthday";
type SlotState = Record<string, { playerId: string; instruction: string }>;

const closedMatchStatuses = new Set(["cancelled", "finished", "completed"]);
const MATCH_AUTO_FINISH_HOURS = 3;
const CAM_ALLOWED_MAIN_POSITIONS = new Set(["CAM", "ST", "CM", "LW", "RW"]);
const CM_COMPATIBLE_SLOT_POSITIONS = new Set([
  "CM",
  "LCM",
  "RCM",
  "CAM",
  "LAM",
  "RAM",
  "CDM",
  "LDM",
  "RDM",
]);
const POSITION_ALIASES: Record<string, string> = {
  GOALKEEPER: "GK",
  "GOAL KEEPER": "GK",
  KEEPER: "GK",
  "CENTER BACK": "CB",
  "CENTRE BACK": "CB",
  "LEFT BACK": "LB",
  "RIGHT BACK": "RB",
  "DEFENSIVE MIDFIELDER": "CDM",
  "CENTRAL MIDFIELDER": "CM",
  MIDFIELDER: "CM",
  "ATTACKING MIDFIELDER": "CAM",
  STRIKER: "ST",
  FORWARD: "ST",
  "LEFT WINGER": "LW",
  "RIGHT WINGER": "RW",
};

let configurationClockSnapshot = 0;
const subscribeConfigurationClock = (onStoreChange: () => void) => {
  configurationClockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    configurationClockSnapshot = Date.now();
    onStoreChange();
  }, 30000);
  return () => window.clearInterval(intervalId);
};
const getConfigurationClockSnapshot = () => configurationClockSnapshot;
const getServerConfigurationClockSnapshot = () => 0;

const normalizePosition = (value?: string | null) => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
  return POSITION_ALIASES[normalized] ?? normalized;
};

const customProfileValue = (
  player: Pick<CoachPlayer, "customProfile">,
  key: string,
  label: string,
) => {
  const field = (player.customProfile ?? []).find(
    (item) =>
      item.key.toLowerCase() === key.toLowerCase() ||
      item.label.toLowerCase() === label.toLowerCase(),
  );
  const value = field?.value;
  return value === null || value === undefined ? "" : String(value);
};

const playerMainPosition = (
  player: Pick<CoachPlayer, "position" | "customProfile">,
) => customProfileValue(player, "main_position", "Main Position") || player.position || "";

const playerDisplayPosition = (
  player: Pick<CoachPlayer, "position" | "customProfile">,
  fallback: string,
) => playerMainPosition(player) || fallback;

const isHighInjuryRisk = (record?: InjuryRiskPredictionRecord) => {
  const prediction = record?.prediction;
  return (
    Boolean(prediction?.alert_flag) ||
    String(prediction?.risk_level || "").toLowerCase() === "high"
  );
};

function InjuryRiskBadge({ record, label }: { record?: InjuryRiskPredictionRecord; label: string }) {
  if (!isHighInjuryRisk(record)) return null;
  return (
    <Badge
      variant="destructive"
      className="inline-flex w-fit items-center gap-1 rounded-md text-[11px]"
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
    </Badge>
  );
}

const slotAllowsPlayer = (slotLabel: string, player: CoachPlayer) => {
  const slotPosition = normalizePosition(slotLabel);
  const mainPosition = normalizePosition(playerMainPosition(player));
  if (!mainPosition) return false;
  if (
    mainPosition === "CM" &&
    CM_COMPATIBLE_SLOT_POSITIONS.has(slotPosition)
  ) {
    return true;
  }
  if (slotPosition === "CAM") return CAM_ALLOWED_MAIN_POSITIONS.has(mainPosition);
  return mainPosition === slotPosition;
};

const matchAutoFinishTimestamp = (match: {
  match_date: string;
  match_time: string;
}) => {
  const start = localDateTimeTimestamp(match.match_date, match.match_time);
  return start ? start + MATCH_AUTO_FINISH_HOURS * 60 * 60 * 1000 : 0;
};

function isConfigurableMatch(match: Match, nowMs: number) {
  if (closedMatchStatuses.has(match.status)) return false;
  if (closedMatchStatuses.has(match.match_status)) return false;
  if (
    match.match_status === "scheduled" &&
    matchAutoFinishTimestamp(match) <= nowMs
  ) {
    return false;
  }
  return true;
}

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

const matchConfigurationCopy = {
  en: {
    selectedGroup: "Selected group",
    selectedBirthday: "Selected birthday",
    noMainPosition: "No main position",
    highRisk: "high",
    highInjuryRisk: "High injury risk",
    highRiskConfirm: "{player} has a high injury risk ({percentage}). Are you sure you want to use this player as {role} despite the injury risk?",
    substituteRole: "a substitute",
    squadRiskConfirm: "The Injury Risk model marked these players as high risk: {names}. Are you sure you want to save them in the match squad?",
    saved: "Configuration saved.",
    saveError: "Could not save match configuration.",
    pageTitle: "Matches Configuration",
    pageDescription: "Configure match target, lineup, substitutes, player instructions, and tactical shape.",
    home: "Home",
    matches: "Matches",
    configuration: "Configuration",
    matchSetup: "Match Setup",
    loadingMatches: "Loading matches...",
    noConfigurableMatches: "No configurable matches are available.",
    match: "Match",
    selectMatch: "Select match",
    friendly: "Friendly",
    notFriendly: "Not friendly",
    targetType: "Target Type",
    group: "Group",
    birthday: "Birthday",
    selectGroup: "Select group",
    selectBirthday: "Select birthday",
    formation: "Formation",
    tacticalNotes: "Tactical Notes",
    tacticalPlaceholder: "Pressing plan, build-up notes, set-piece reminders...",
    saveConfiguration: "Save Configuration",
    startingLineup: "Starting Lineup",
    availablePlayers: "{count} available players",
    selectPlayer: "Select player",
    playerInstruction: "Player instruction",
    substitutes: "Substitutes",
    selected: "{count} selected",
    add: "Add",
    remove: "Remove",
    matchBench: "Match Bench",
    removePlayer: "Remove {name}",
    substituteInstruction: "Substitute instruction",
    noSubstitutes: "No substitutes selected.",
    noCompletePlayers: "No complete players found for this target.",
  },
  ar: {
    selectedGroup: "المجموعة المختارة",
    selectedBirthday: "سنة الميلاد المختارة",
    noMainPosition: "لا يوجد مركز رئيسي",
    highRisk: "مرتفع",
    highInjuryRisk: "مخاطر إصابة مرتفعة",
    highRiskConfirm: "{player} لديه خطر إصابة مرتفع ({percentage}). هل تريد استخدامه في مركز {role} رغم خطر الإصابة؟",
    substituteRole: "بديل",
    squadRiskConfirm: "نموذج مخاطر الإصابة وضع هؤلاء اللاعبين ضمن الخطر المرتفع: {names}. هل تريد حفظهم في قائمة المباراة؟",
    saved: "تم حفظ الإعدادات.",
    saveError: "تعذر حفظ إعداد المباراة.",
    pageTitle: "إعداد المباراة",
    pageDescription: "اضبط هدف المباراة والتشكيل والبدلاء وتعليمات اللاعبين والشكل التكتيكي.",
    home: "الرئيسية",
    matches: "المباريات",
    configuration: "الإعداد",
    matchSetup: "إعداد المباراة",
    loadingMatches: "جاري تحميل المباريات...",
    noConfigurableMatches: "لا توجد مباريات متاحة للإعداد.",
    match: "المباراة",
    selectMatch: "اختر مباراة",
    friendly: "ودية",
    notFriendly: "غير ودية",
    targetType: "نوع الهدف",
    group: "مجموعة",
    birthday: "سنة ميلاد",
    selectGroup: "اختر مجموعة",
    selectBirthday: "اختر سنة ميلاد",
    formation: "التشكيل",
    tacticalNotes: "ملاحظات تكتيكية",
    tacticalPlaceholder: "خطة الضغط، ملاحظات البناء، تذكيرات الكرات الثابتة...",
    saveConfiguration: "حفظ الإعداد",
    startingLineup: "التشكيل الأساسي",
    availablePlayers: "{count} لاعب متاح",
    selectPlayer: "اختر لاعبًا",
    playerInstruction: "تعليمات اللاعب",
    substitutes: "البدلاء",
    selected: "{count} محدد",
    add: "إضافة",
    remove: "إزالة",
    matchBench: "دكة المباراة",
    removePlayer: "إزالة {name}",
    substituteInstruction: "تعليمات البديل",
    noSubstitutes: "لا يوجد بدلاء محددون.",
    noCompletePlayers: "لا يوجد لاعبون مكتملون لهذا الهدف.",
  },
} as const;

export default function CoachMatchConfigurationPage() {
  const language = useDashboardLanguage();
  const t = matchConfigurationCopy[language];
  const { data: matchesRes, isLoading: loadingMatches } =
    useGetCoachMatchesQuery();
  const { data: adminRequestsRes } = useGetCoachAdminMatchRequestsQuery();
  const { data: playersRes } = useGetCoachPlayersScopedQuery({ limit: 200 });
  const { data: injuryRiskRows = [] } = useGetInjuryRiskPredictionsQuery();
  const { data: groups = [] } = useGetCoachGroupsScopedQuery();
  const { data: birthdays = [] } = useGetCoachBirthdaysQuery();
  const [upsertSquad, { isLoading: savingSquad }] =
    useUpsertMatchSquadMutation();
  const [upsertTactics, { isLoading: savingTactics }] =
    useUpsertMatchTacticsMutation();
  const [updateTargets, { isLoading: savingTargets }] =
    useUpdateCoachMatchTargetsMutation();
  const nowMs = useSyncExternalStore(
    subscribeConfigurationClock,
    getConfigurationClockSnapshot,
    getServerConfigurationClockSnapshot,
  );

  const matches = useMemo(
    () =>
      (matchesRes?.data ?? []).map((match) => ({
        ...match,
        groups:
          match.groups?.length || !match.team_id
            ? match.groups
            : [
                {
                  id: match.team_id,
                  name: match.team_name ?? t.selectedGroup,
                },
              ],
      })),
    [matchesRes?.data, t.selectedGroup],
  );
  const acceptedRequestMatches: Match[] = useMemo(
    () => [
      ...(adminRequestsRes?.data ?? [])
        .filter(
          (request) =>
            request.status === "accepted" && request.created_match_id,
        )
        .map((request) => {
          const closed =
            matchAutoFinishTimestamp({
              match_date: request.match_date,
              match_time: request.match_time,
            }) <= nowMs;
          return {
            id: request.created_match_id!,
            event_id: null,
            team_id: request.selected_group_id,
            age_group_id: null,
            opponent_name: request.opponent_name,
            match_type: request.match_type,
            match_date: request.match_date,
            match_time: request.match_time,
            location: request.location,
            venue_type: request.venue_type,
            referee_name: request.referee_name,
            status: closed ? ("completed" as const) : ("scheduled" as const),
            match_status: closed ? "finished" : "scheduled",
            organizer_notes: request.organizer_notes,
            match_notes: null,
            our_score: null,
            opponent_score: null,
            groups: request.selected_group_id
              ? [
                  {
                    id: request.selected_group_id,
                    name: request.selected_group_name ?? t.selectedGroup,
                  },
                ]
              : [],
            birth_years: request.selected_birth_year_id
              ? [
                  {
                    id: request.selected_birth_year_id,
                    label:
                      request.selected_birth_year_name ?? t.selectedBirthday,
                    fromYear: 0,
                    toYear: 9999,
                  },
                ]
              : [],
          };
        }),
    ],
    [adminRequestsRes?.data, nowMs, t.selectedBirthday, t.selectedGroup],
  );
  const matchOptions = useMemo(
    () =>
      [
        ...matches,
        ...acceptedRequestMatches.filter(
          (item) => !matches.some((match) => match.id === item.id),
        ),
      ].filter((match) => isConfigurableMatch(match, nowMs)),
    [acceptedRequestMatches, matches, nowMs],
  );
  const players = useMemo(() => playersRes?.data ?? [], [playersRes?.data]);
  const injuryRiskByPlayerId = useMemo(
    () => new Map(injuryRiskRows.map((row) => [row.player_id, row])),
    [injuryRiskRows],
  );
  const [matchId, setMatchId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("matchId") ?? ""),
  );
  const [targetMode, setTargetMode] = useState<TargetMode | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [formation, setFormation] = useState("");
  const [tacticalNotes, setTacticalNotes] = useState<string | null>(null);
  const [slotState, setSlotState] = useState<SlotState | null>(null);
  const [reserveIds, setReserveIds] = useState<string[] | null>(null);
  const [reserveInstructions, setReserveInstructions] = useState<Record<
    string,
    string
  > | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [acknowledgedRiskPlayerIds, setAcknowledgedRiskPlayerIds] = useState<
    Set<string>
  >(new Set());

  const selectedMatch =
    matchOptions.find((match) => match.id === matchId) ?? matchOptions[0];
  const { data: selectedMatchDetails } = useGetCoachMatchQuery(
    selectedMatch?.id ?? "",
    { skip: !selectedMatch?.id },
  );
  const savedTargetMode: TargetMode =
    selectedMatchDetails?.birth_years?.length &&
    !selectedMatchDetails?.groups?.length
      ? "birthday"
      : selectedMatch?.birth_years?.length && !selectedMatch?.groups?.length
        ? "birthday"
        : "group";
  const activeFormation =
    formation || selectedMatchDetails?.tactics?.formation || "4-3-3";
  const activeTacticalNotes =
    tacticalNotes ?? selectedMatchDetails?.tactics?.tactical_notes ?? "";
  const slots = getFormationSlots(activeFormation);
  const savedLineup = useMemo(() => {
    const nextSlots = getFormationSlots(activeFormation);
    const nextSlotState: SlotState = {};
    const usedSlotIds = new Set<string>();
    const reserves: string[] = [];
    const reserveInstructionMap: Record<string, string> = {};

    selectedMatchDetails?.squad?.forEach((player) => {
      if (player.squad_role !== "starter") {
        reserves.push(player.player_id);
        reserveInstructionMap[player.player_id] =
          player.player_instruction ?? "";
        return;
      }

      const rosterPlayer = players.find((item) => item.id === player.player_id);
      const savedPosition =
        player.position ||
        (rosterPlayer ? playerMainPosition(rosterPlayer) : "");
      const slot =
        nextSlots.find(
          (item) => item.label === savedPosition && !usedSlotIds.has(item.id),
        ) ?? nextSlots.find((item) => !usedSlotIds.has(item.id));
      if (!slot) return;
      usedSlotIds.add(slot.id);
      nextSlotState[slot.id] = {
        playerId: player.player_id,
        instruction: player.player_instruction ?? "",
      };
    });

    return {
      slotState: nextSlotState,
      reserveIds: reserves,
      reserveInstructions: reserveInstructionMap,
    };
  }, [activeFormation, players, selectedMatchDetails?.squad]);
  const activeSlotState = slotState ?? savedLineup.slotState;
  const activeReserveIds = reserveIds ?? savedLineup.reserveIds;
  const activeReserveInstructions =
    reserveInstructions ?? savedLineup.reserveInstructions;
  const selectedStarterIds = new Set(
    Object.values(activeSlotState)
      .map((item) => item.playerId)
      .filter(Boolean),
  );

  const effectiveTargetMode: TargetMode = targetMode ?? savedTargetMode;

  const matchGroups = selectedMatchDetails?.groups?.length
    ? selectedMatchDetails.groups.map((group) => ({
        id: group.id,
        name: group.name,
      }))
    : selectedMatch?.groups?.length
      ? selectedMatch.groups.map((group) => ({
          id: group.id,
          name: group.name,
        }))
      : groups.map((group) => ({
          id: group.group_id,
          name: group.group_name,
        }));

  const matchBirthdays = selectedMatchDetails?.birth_years?.length
    ? selectedMatchDetails.birth_years.map((birthday) => ({
        id: birthday.id,
        label: birthday.label,
      }))
    : selectedMatch?.birth_years?.length
      ? selectedMatch.birth_years.map((birthday) => ({
          id: birthday.id,
          label: birthday.label,
        }))
      : birthdays.map((birthday) => ({
          id: birthday.id,
          label: birthday.label,
        }));

  const effectiveTargetId =
    targetId ??
    (effectiveTargetMode === "group"
      ? matchGroups[0]?.id
      : matchBirthdays[0]?.id) ??
    "";

  const targetPlayers = (() => {
    if (!effectiveTargetId) return [];
    if (effectiveTargetMode === "group") {
      return players.filter(
        (player) =>
          player.group_id === effectiveTargetId &&
          player.profile_status === "complete",
      );
    }
    const birthday = birthdays.find((item) => item.id === effectiveTargetId);
    if (!birthday) return [];
    return players.filter((player) => {
      const year = player.date_of_birth
        ? new Date(player.date_of_birth).getFullYear()
        : 0;
      return (
        player.profile_status === "complete" &&
        player.branch_id === birthday.branchId &&
        year >= birthday.fromYear &&
        year <= birthday.toYear
      );
    });
  })();
  const targetPlayerIds = new Set(targetPlayers.map((player) => player.id));
  const selectedReserveIds = new Set(
    activeReserveIds.filter((playerId) => targetPlayerIds.has(playerId)),
  );
  const previewPlayerNames = Object.fromEntries(
    slots.map((slot) => [
      slot.id,
      players.find((player) => player.id === activeSlotState[slot.id]?.playerId)
        ?.full_name,
    ]),
  );

  const updateSlot = (
    slotId: string,
    patch: Partial<{ playerId: string; instruction: string }>,
  ) => {
    setSlotState((prev) => {
      const base = prev ?? activeSlotState;
      return {
        ...base,
        [slotId]: {
          playerId: base[slotId]?.playerId ?? "",
          instruction: base[slotId]?.instruction ?? "",
          ...patch,
        },
      };
    });
    if (patch.playerId) {
      setReserveIds((prev) => {
        const base = prev ?? activeReserveIds;
        return base.filter((playerId) => playerId !== patch.playerId);
      });
      setReserveInstructions((prev) => {
        const base = prev ?? activeReserveInstructions;
        const next = { ...base };
        delete next[patch.playerId!];
        return next;
      });
    }
  };

  const confirmHighRiskPlayer = (player: CoachPlayer, role: string) => {
    const risk = injuryRiskByPlayerId.get(player.id);
    if (!isHighInjuryRisk(risk)) return true;
    if (acknowledgedRiskPlayerIds.has(player.id)) return true;
    const percentage =
      risk?.prediction?.risk_percentage !== undefined
        ? `${risk.prediction.risk_percentage}%`
        : t.highRisk;
    const confirmed = window.confirm(
      t.highRiskConfirm
        .replace("{player}", player.full_name)
        .replace("{percentage}", percentage)
        .replace("{role}", role),
    );
    if (confirmed) {
      setAcknowledgedRiskPlayerIds((prev) => new Set(prev).add(player.id));
    }
    return confirmed;
  };

  const toggleReserve = (playerId: string) => {
    const player = targetPlayers.find((item) => item.id === playerId);
    const adding = !activeReserveIds.includes(playerId);
    if (adding && player && !confirmHighRiskPlayer(player, t.substituteRole)) {
      return;
    }
    setReserveIds((prev) => {
      const base = prev ?? activeReserveIds;
      return base.includes(playerId)
        ? base.filter((id) => id !== playerId)
        : [...base, playerId];
    });
    if (activeReserveIds.includes(playerId)) {
      setReserveInstructions((prev) => {
        const base = prev ?? activeReserveInstructions;
        const next = { ...base };
        delete next[playerId];
        return next;
      });
    }
  };

  const saveConfiguration = async () => {
    if (!selectedMatch) return;
    setStatus("");
    setError("");
    const starters = slots
      .map((slot) => ({ slot, state: activeSlotState[slot.id] }))
      .filter(({ state }) => state?.playerId)
      .map(({ slot, state }) => ({
        playerId: state.playerId,
        squadRole: "starter",
        position: slot.label,
        playerInstruction: state.instruction,
      }));
    const starterIds = new Set(starters.map((item) => item.playerId));
    const reserves = activeReserveIds
      .filter((playerId) => targetPlayerIds.has(playerId))
      .filter((playerId) => !starterIds.has(playerId))
      .map((playerId) => ({
        playerId,
        squadRole: "reserve",
        playerInstruction: activeReserveInstructions[playerId] || "",
      }));
    const selectedSquadPlayerIds = [
      ...starters.map((item) => item.playerId),
      ...reserves.map((item) => item.playerId),
    ];
    const highRiskPlayers = selectedSquadPlayerIds
      .map((playerId) => targetPlayers.find((player) => player.id === playerId))
      .filter((player): player is CoachPlayer => Boolean(player))
      .filter(
        (player) =>
          isHighInjuryRisk(injuryRiskByPlayerId.get(player.id)) &&
          !acknowledgedRiskPlayerIds.has(player.id),
      );
    if (highRiskPlayers.length) {
      const names = highRiskPlayers.map((player) => player.full_name).join(", ");
      const confirmed = window.confirm(
        t.squadRiskConfirm.replace("{names}", names),
      );
      if (!confirmed) return;
      setAcknowledgedRiskPlayerIds((prev) => {
        const next = new Set(prev);
        highRiskPlayers.forEach((player) => next.add(player.id));
        return next;
      });
    }

    try {
      if (effectiveTargetId) {
        await updateTargets({
          matchId: selectedMatch.id,
          body:
            effectiveTargetMode === "group"
              ? { groupId: effectiveTargetId }
              : { birthYearId: effectiveTargetId },
        }).unwrap();
      }
      await upsertTactics({
        matchId: selectedMatch.id,
        body: {
          formation: activeFormation,
          tacticalNotes: activeTacticalNotes,
        },
      }).unwrap();
      if (starters.length || reserves.length) {
        await upsertSquad({
          matchId: selectedMatch.id,
          players: [...starters, ...reserves],
        }).unwrap();
      }
      setStatus(t.saved);
    } catch (err) {
      setError(getApiMessage(err, t.saveError));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.matches, href: "/coach/matches" },
          { label: t.configuration },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.matchSetup}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingMatches && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loadingMatches}
              </p>
            )}
            {!loadingMatches && !matchOptions.length && (
              <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {t.noConfigurableMatches}
              </p>
            )}
            <div className="space-y-2">
              <Label>{t.match}</Label>
              <Select
                value={selectedMatch?.id ?? ""}
                disabled={!matchOptions.length}
                onValueChange={(value) => {
                  const nextMatch = matchOptions.find(
                    (match) => match.id === value,
                  );
                  setMatchId(value);
                  setTargetMode(
                    nextMatch?.groups?.length
                      ? "group"
                      : nextMatch?.birth_years?.length
                        ? "birthday"
                        : "group",
                  );
                  setTargetId(
                    nextMatch?.groups?.[0]?.id ??
                      nextMatch?.birth_years?.[0]?.id ??
                      "",
                  );
                  setFormation("");
                  setTacticalNotes(null);
                  setSlotState(null);
                  setReserveIds(null);
                  setReserveInstructions(null);
                  setAcknowledgedRiskPlayerIds(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectMatch} />
                </SelectTrigger>
                <SelectContent>
                  {matchOptions.map((match) => (
                    <SelectItem key={match.id} value={match.id}>
                      {match.opponent_name} - {formatDate(match.match_date)} -{" "}
                      {match.match_type === "friendly"
                        ? t.friendly
                        : t.notFriendly}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.targetType}</Label>
              <Select
                value={effectiveTargetMode}
                disabled={!selectedMatch}
                onValueChange={(value) => {
                  setTargetMode(value as TargetMode);
                  setTargetId("");
                  setSlotState({});
                  setReserveIds([]);
                  setReserveInstructions({});
                  setAcknowledgedRiskPlayerIds(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">{t.group}</SelectItem>
                  <SelectItem value="birthday">{t.birthday}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {effectiveTargetMode === "group" ? t.group : t.birthday}
              </Label>
              <Select
                value={effectiveTargetId}
                disabled={!selectedMatch}
                onValueChange={(value) => {
                  setTargetId(value);
                  setSlotState({});
                  setReserveIds([]);
                  setReserveInstructions({});
                  setAcknowledgedRiskPlayerIds(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      effectiveTargetMode === "group"
                        ? t.selectGroup
                        : t.selectBirthday
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(effectiveTargetMode === "group"
                    ? matchGroups
                    : matchBirthdays
                  ).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {"name" in item ? item.name : item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.formation}</Label>
              <Select
                value={activeFormation}
                disabled={!selectedMatch}
                onValueChange={(value) => {
                  setFormation(value);
                  setSlotState({});
                  setReserveIds(activeReserveIds);
                  setReserveInstructions(activeReserveInstructions);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {
                  FORMATIONS.find((item) => item.value === activeFormation)
                    ?.notes
                }
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t.tacticalNotes}</Label>
              <Textarea
                value={activeTacticalNotes}
                onChange={(event) => setTacticalNotes(event.target.value)}
                placeholder={t.tacticalPlaceholder}
                disabled={!selectedMatch}
              />
            </div>
            {status && (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {status}
              </p>
            )}
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="w-full gap-2"
              disabled={
                !selectedMatch || savingTargets || savingSquad || savingTactics
              }
              onClick={saveConfiguration}
            >
              {savingTargets || savingSquad || savingTactics ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t.saveConfiguration}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-border/50 bg-card/55">
            <CardContent className="p-0">
              <FormationPreview3D
                formation={activeFormation}
                playerNames={previewPlayerNames}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{t.startingLineup}</CardTitle>
                <Badge variant="secondary">
                  {t.availablePlayers.replace("{count}", String(targetPlayers.length))}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {slots.map((slot) => {
                const current = activeSlotState[slot.id];
                const available = targetPlayers.filter(
                  (player) =>
                    player.id === current?.playerId ||
                    (slotAllowsPlayer(slot.label, player) &&
                      !selectedStarterIds.has(player.id) &&
                      !selectedReserveIds.has(player.id)),
                );
                return (
                  <div
                    key={slot.id}
                    className="space-y-2 rounded-md border border-border/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Label>{slot.label}</Label>
                      <Badge variant="outline">{slot.line}</Badge>
                    </div>
                    <Select
                      value={current?.playerId ?? ""}
                      onValueChange={(value) => {
                        const player = targetPlayers.find((item) => item.id === value);
                        if (
                          player &&
                          !confirmHighRiskPlayer(player, slot.label)
                        ) {
                          return;
                        }
                        updateSlot(slot.id, { playerId: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.selectPlayer} />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((player) => {
                          const risk = injuryRiskByPlayerId.get(player.id);
                          return (
                            <SelectItem key={player.id} value={player.id}>
                              <span className="flex w-full items-center justify-between gap-3">
                                <span className="min-w-0 truncate">
                                  {player.full_name} - {playerDisplayPosition(player, t.noMainPosition)}
                                </span>
                                <InjuryRiskBadge record={risk} label={t.highInjuryRisk} />
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={current?.instruction ?? ""}
                      onChange={(event) =>
                        updateSlot(slot.id, { instruction: event.target.value })
                      }
                      placeholder={t.playerInstruction}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{t.substitutes}</CardTitle>
                <Badge variant="secondary">
                  {t.selected.replace(
                    "{count}",
                    String(activeReserveIds.filter((id) => targetPlayerIds.has(id)).length),
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <div className="space-y-2">
                {targetPlayers
                  .filter((player) => !selectedStarterIds.has(player.id))
                  .map((player) => {
                    const active = activeReserveIds.includes(player.id);
                    return (
                      <div
                        key={player.id}
                        className="grid gap-3 rounded-md border border-border/50 bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {player.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {playerDisplayPosition(player, t.noMainPosition)} - {player.level}
                          </p>
                          <div className="mt-2">
                            <InjuryRiskBadge
                              record={injuryRiskByPlayerId.get(player.id)}
                              label={t.highInjuryRisk}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          className="gap-2"
                          onClick={() => toggleReserve(player.id)}
                        >
                          {active ? (
                            <UserMinus className="h-4 w-4" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                          {active ? t.remove : t.add}
                        </Button>
                      </div>
                    );
                  })}
              </div>
              <div className="space-y-3 rounded-md border border-border/50 bg-muted/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t.matchBench}</Label>
                  <Badge variant="outline">{activeReserveIds.length}</Badge>
                </div>
                {activeReserveIds.map((playerId) => {
                  const player = targetPlayers.find(
                    (item) => item.id === playerId,
                  );
                  if (!player || selectedStarterIds.has(player.id)) return null;
                  return (
                    <div key={playerId} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {player.full_name}
                          </p>
                          <InjuryRiskBadge
                            record={injuryRiskByPlayerId.get(player.id)}
                            label={t.highInjuryRisk}
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleReserve(playerId)}
                          aria-label={t.removePlayer.replace("{name}", player.full_name)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={activeReserveInstructions[playerId] ?? ""}
                        onChange={(event) =>
                          setReserveInstructions((prev) => {
                            const base = prev ?? activeReserveInstructions;
                            return {
                              ...base,
                              [playerId]: event.target.value,
                            };
                          })
                        }
                        placeholder={t.substituteInstruction}
                      />
                    </div>
                  );
                })}
                {!activeReserveIds.filter((id) => targetPlayerIds.has(id)).length && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t.noSubstitutes}
                  </p>
                )}
              </div>
              {!targetPlayers.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t.noCompletePlayers}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
