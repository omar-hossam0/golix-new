"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Match,
  useAcceptCoachAdminMatchRequestMutation,
  useGetCoachAdminMatchRequestsQuery,
  useGetCoachGroupsScopedQuery,
  useGetCoachMatchQuery,
  useGetCoachMatchesQuery,
} from "@/lib/store/api/calendarApi";
import { useGetCoachBirthdaysQuery } from "@/lib/store/api/coachApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12, localDateTimeTimestamp } from "@/lib/utils";

let clockSnapshot = 0;
const subscribeMatchClock = (onStoreChange: () => void) => {
  clockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    clockSnapshot = Date.now();
    onStoreChange();
  }, 30000);
  return () => window.clearInterval(intervalId);
};
const getMatchClockSnapshot = () => clockSnapshot;
const getServerMatchClockSnapshot = () => 0;

const matchStartTimestamp = (match?: {
  match_date: string;
  match_time: string;
}) => (match ? localDateTimeTimestamp(match.match_date, match.match_time) : 0);

const MATCH_AUTO_FINISH_HOURS = 3;
const closedMatchStatuses = new Set(["cancelled", "finished", "completed"]);

const matchAutoFinishTimestamp = (match?: {
  match_date: string;
  match_time: string;
}) => {
  const start = matchStartTimestamp(match);
  return start ? start + MATCH_AUTO_FINISH_HOURS * 60 * 60 * 1000 : 0;
};

const isClosedMatch = (
  match: {
    status: string;
    match_status: string;
    match_date: string;
    match_time: string;
  },
  nowMs: number,
) =>
  closedMatchStatuses.has(match.status) ||
  closedMatchStatuses.has(match.match_status) ||
  (match.match_status === "scheduled" &&
    matchAutoFinishTimestamp(match) <= nowMs);

const matchDayOpenMinutes = (match?: Match) => {
  const raw =
    match?.academy_settings?.matchDayOpenMinutesBeforeKickoff ??
    match?.academy_settings?.match_day_open_minutes_before_kickoff;
  const minutes = Number(raw);
  return Number.isFinite(minutes)
    ? Math.max(0, Math.min(240, Math.round(minutes)))
    : 5;
};

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

type DashboardLanguage = "en" | "ar";

const matchLabels: Record<DashboardLanguage, Record<string, string>> = {
  en: {
    accepted: "Accepted",
    birthday: "Birthday",
    cancelled: "Cancelled",
    completed: "Completed",
    expired: "Expired",
    finished: "Finished",
    friendly: "Friendly",
    group: "Group",
    pending: "Pending",
    scheduled: "Scheduled",
    starter: "Starter",
    substitute: "Substitute",
  },
  ar: {
    accepted: "مقبول",
    birthday: "سنة الميلاد",
    cancelled: "ملغي",
    completed: "مكتمل",
    expired: "منتهي",
    finished: "منتهي",
    friendly: "ودية",
    group: "مجموعة",
    pending: "معلق",
    scheduled: "مجدول",
    starter: "أساسي",
    substitute: "بديل",
  },
};

const coachMatchesCopy = {
  en: {
    pageTitle: "Matches",
    pageDescription:
      "View admin-scheduled matches and manage squad, tactics, attendance, and evaluations.",
    home: "Home",
    matches: "Matches",
    refresh: "Refresh",
    upcomingMatches: "Upcoming Matches",
    backendError:
      "Could not load backend matches. Make sure the backend is running and your coach session is valid.",
    loading: "Loading...",
    noMatches:
      "No backend matches are assigned to this coach yet. Admin-created matches must target one of this coach's assigned groups or birth years.",
    selectedGroup: "Selected group",
    selectedBirthYear: "Selected birthday",
    acceptRequestError: "Could not accept match request.",
    matchDetails: "Match Details",
    friendly: "Friendly",
    notFriendly: "Not friendly",
    savedConfiguration: "Saved Configuration",
    configured: "configured",
    notConfigured: "not configured",
    formation: "Formation",
    squad: "Squad",
    playersCount: (count: number) => `${count} players`,
    tacticalNotes: "Tactical notes",
    noNotes: "No notes.",
    configurationHint:
      "Open configuration to choose the target, lineup, substitutes, positions, and tactical notes.",
    squadPreview: "Squad Preview",
    morePlayers: (count: number) => `+${count} more players`,
    noSquad: "No squad saved yet.",
    matchDayOperations: "Match Day Operations",
    operationsHint: (minutes: number) =>
      `Operations open ${minutes} minutes before kick-off after configuration is saved.`,
    matchFinished: "Match finished",
    editConfiguration: "Edit Configuration",
    openMatchDay: "Open Match Day",
    waitingWindow: "Waiting for match window",
    configureFirst: "Configure first",
    selectMatch: "Select a match to manage technical details.",
    adminRequests: "Admin Match Requests",
    expires: "expires",
    group: "Group",
    birthday: "Birthday",
    selectGroup: "Select group",
    selectBirthday: "Select birthday",
    accept: "Accept",
    noRequests: "No admin match requests.",
  },
  ar: {
    pageTitle: "المباريات",
    pageDescription:
      "راجع المباريات المجدولة من الإدارة وتحكم في القائمة، الخطط، الحضور، والتقييمات.",
    home: "الرئيسية",
    matches: "المباريات",
    refresh: "تحديث",
    upcomingMatches: "المباريات القادمة",
    backendError:
      "تعذر تحميل مباريات الباك إند. تأكد أن الخادم يعمل وأن جلسة المدرب صالحة.",
    loading: "جاري التحميل...",
    noMatches:
      "لا توجد مباريات من الباك إند معينة لهذا المدرب بعد. مباريات الإدارة يجب أن تستهدف مجموعة أو سنة ميلاد معينة لهذا المدرب.",
    selectedGroup: "المجموعة المحددة",
    selectedBirthYear: "سنة الميلاد المحددة",
    acceptRequestError: "تعذر قبول طلب المباراة.",
    matchDetails: "تفاصيل المباراة",
    friendly: "ودية",
    notFriendly: "ليست ودية",
    savedConfiguration: "الإعدادات المحفوظة",
    configured: "تم الإعداد",
    notConfigured: "لم يتم الإعداد",
    formation: "الخطة",
    squad: "القائمة",
    playersCount: (count: number) => `${count} لاعبين`,
    tacticalNotes: "ملاحظات تكتيكية",
    noNotes: "لا توجد ملاحظات.",
    configurationHint:
      "افتح الإعدادات لاختيار الهدف، التشكيل، البدلاء، المراكز، والملاحظات التكتيكية.",
    squadPreview: "معاينة القائمة",
    morePlayers: (count: number) => `+${count} لاعبين آخرين`,
    noSquad: "لم يتم حفظ قائمة بعد.",
    matchDayOperations: "عمليات يوم المباراة",
    operationsHint: (minutes: number) =>
      `تفتح العمليات قبل بداية المباراة بـ ${minutes} دقيقة بعد حفظ الإعدادات.`,
    matchFinished: "المباراة انتهت",
    editConfiguration: "تعديل الإعدادات",
    openMatchDay: "فتح يوم المباراة",
    waitingWindow: "في انتظار نافذة المباراة",
    configureFirst: "أكمل الإعداد أولا",
    selectMatch: "اختر مباراة لإدارة التفاصيل الفنية.",
    adminRequests: "طلبات مباريات الإدارة",
    expires: "ينتهي",
    group: "مجموعة",
    birthday: "سنة الميلاد",
    selectGroup: "اختر مجموعة",
    selectBirthday: "اختر سنة الميلاد",
    accept: "قبول",
    noRequests: "لا توجد طلبات مباريات من الإدارة.",
  },
} as const;

const formatMatchLabel = (
  value: string | null | undefined,
  language: DashboardLanguage,
) => {
  if (!value) return "";
  const key = value.toLowerCase().replace(/\s+/g, "_");
  return matchLabels[language][key] ?? value.replace(/_/g, " ");
};

export default function CoachMatchesPage() {
  const language = useDashboardLanguage();
  const t = coachMatchesCopy[language];
  const {
    data: matchesRes,
    isLoading,
    isError: matchesError,
    isFetching: isFetchingMatches,
    refetch: refetchMatches,
  } = useGetCoachMatchesQuery();
  const {
    data: adminRequestsRes,
    isFetching: isFetchingAdminRequests,
    refetch: refetchAdminRequests,
  } = useGetCoachAdminMatchRequestsQuery();
  const nowMs = useSyncExternalStore(
    subscribeMatchClock,
    getMatchClockSnapshot,
    getServerMatchClockSnapshot,
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
                      request.selected_birth_year_name ?? t.selectedBirthYear,
                    fromYear: 0,
                    toYear: 9999,
                  },
                ]
              : [],
          };
        }),
    ],
    [adminRequestsRes?.data, nowMs, t.selectedBirthYear, t.selectedGroup],
  );
  const matches = useMemo(
    () => [
      ...(matchesRes?.data ?? []),
      ...acceptedRequestMatches.filter(
        (item) =>
          !(matchesRes?.data ?? []).some((match) => match.id === item.id),
      ),
    ],
    [acceptedRequestMatches, matchesRes?.data],
  );
  const activeMatches = useMemo(
    () => matches.filter((item) => !isClosedMatch(item, nowMs)),
    [matches, nowMs],
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = activeMatches.some((item) => item.id === selectedId)
    ? selectedId
    : activeMatches[0]?.id || "";
  const {
    data: match,
    isFetching: isFetchingMatch,
    refetch: refetchMatch,
  } = useGetCoachMatchQuery(activeId, { skip: !activeId });
  const {
    data: groups = [],
    isFetching: isFetchingGroups,
    refetch: refetchGroups,
  } = useGetCoachGroupsScopedQuery();
  const {
    data: birthdays = [],
    isFetching: isFetchingBirthdays,
    refetch: refetchBirthdays,
  } = useGetCoachBirthdaysQuery();
  const [adminRequestTargets, setAdminRequestTargets] = useState<
    Record<string, { mode: "group" | "birthday"; value: string }>
  >({});
  const [adminRequestError, setAdminRequestError] = useState("");
  const [acceptAdminRequest, { isLoading: acceptingAdminRequest }] =
    useAcceptCoachAdminMatchRequestMutation();

  const configurationReady = Boolean(match?.tactics && match.squad?.length);
  const matchStartMs = matchStartTimestamp(match);
  const safeMatchDayOpenMinutes = matchDayOpenMinutes(match);
  const matchDayUnlockMs = matchStartMs - safeMatchDayOpenMinutes * 60 * 1000;
  const matchClosed = match ? isClosedMatch(match, nowMs) : false;
  const matchDayOpen = Boolean(
    match &&
    matchStartMs > 0 &&
    match.status !== "cancelled" &&
    !matchClosed &&
    configurationReady &&
    nowMs >= matchDayUnlockMs,
  );

  const acceptRequest = async (requestId: string) => {
    const target = adminRequestTargets[requestId];
    if (!target?.value) return;
    setAdminRequestError("");
    try {
      await acceptAdminRequest({
        id: requestId,
        ...(target.mode === "group"
          ? { groupId: target.value }
          : { birthYearId: target.value }),
      }).unwrap();
      setAdminRequestTargets((prev) => ({
        ...prev,
        [requestId]: { mode: "group", value: "" },
      }));
    } catch (error) {
      setAdminRequestError(getApiMessage(error, t.acceptRequestError));
    }
  };

  const adminRequests = adminRequestsRes?.data ?? [];

  const selectMatch = (id: string) => {
    setSelectedId(id);
  };

  const isRefreshing =
    isFetchingMatches ||
    isFetchingAdminRequests ||
    isFetchingMatch ||
    isFetchingGroups ||
    isFetchingBirthdays;

  const refreshPageData = async () => {
    await Promise.all([
      refetchMatches(),
      refetchAdminRequests(),
      refetchGroups(),
      refetchBirthdays(),
      ...(activeId ? [refetchMatch()] : []),
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.matches },
        ]}
        actions={
          <RefreshButton
            onRefresh={refreshPageData}
            isRefreshing={isRefreshing}
            label={t.refresh}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.upcomingMatches}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matchesError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {t.backendError}
              </div>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            )}
            {activeMatches.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-md border p-3 text-left transition-colors ${activeId === item.id ? "border-primary bg-primary/10" : "border-border/50 bg-muted/10 hover:bg-muted/30"}`}
                onClick={() => selectMatch(item.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.opponent_name}</p>
                  <Badge variant="outline">
                    {formatMatchLabel(item.status, language)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.match_date)} ·{" "}
                  {formatTime12(item.match_time)}
                </p>
              </button>
            ))}
            {!activeMatches.length && !isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.noMatches}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.matchDetails}</CardTitle>
            </CardHeader>
            <CardContent>
              {match ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold">
                        {match.opponent_name}
                      </h2>
                      <Badge>
                        {match.match_type === "friendly"
                          ? t.friendly
                          : t.notFriendly}
                      </Badge>
                      <Badge variant="secondary">
                        {formatMatchLabel(match.venue_type, language)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(match.match_date)} ·{" "}
                      {formatTime12(match.match_time)} · {match.location}
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-border/50 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{t.savedConfiguration}</p>
                        <Badge
                          variant={configurationReady ? "success" : "warning"}
                        >
                          {configurationReady ? t.configured : t.notConfigured}
                        </Badge>
                      </div>
                      {configurationReady ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t.formation}
                              </p>
                              <p className="font-medium">
                                {match.tactics?.formation}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t.squad}
                              </p>
                              <p className="font-medium">
                                {t.playersCount(match.squad?.length ?? 0)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {t.tacticalNotes}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">
                              {match.tactics?.tactical_notes || t.noNotes}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t.configurationHint}
                        </p>
                      )}
                    </div>

                    <div className="rounded-md border border-border/50 p-4">
                      <p className="mb-3 font-medium">{t.squadPreview}</p>
                      {match.squad?.length ? (
                        <div className="space-y-2">
                          {match.squad.slice(0, 8).map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/15 px-3 py-2 text-sm"
                            >
                              <span className="font-medium">
                                {item.player_name}
                              </span>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                  {formatMatchLabel(item.squad_role, language)}
                                </Badge>
                                {item.position && (
                                  <Badge variant="secondary">
                                    {item.position}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                          {(match.squad?.length ?? 0) > 8 && (
                            <p className="text-xs text-muted-foreground">
                              {t.morePlayers((match.squad?.length ?? 0) - 8)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t.noSquad}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.matchDayOperations}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.operationsHint(safeMatchDayOpenMinutes)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {matchClosed ? (
                          <Badge variant="success">{t.matchFinished}</Badge>
                        ) : (
                          <Button asChild variant="outline">
                            <Link
                              href={`/coach/matches/configuration?matchId=${match.id}`}
                            >
                              {t.editConfiguration}
                            </Link>
                          </Button>
                        )}
                        {matchDayOpen ? (
                          <Button asChild>
                            <Link href={`/coach/matches/match-day/${match.id}`}>
                              {t.openMatchDay}
                            </Link>
                          </Button>
                        ) : (
                          <Badge variant="secondary">
                            {configurationReady
                              ? t.waitingWindow
                              : t.configureFirst}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t.selectMatch}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.adminRequests}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {adminRequestError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {adminRequestError}
                </p>
              )}
              {adminRequests.map((item) => {
                const target = adminRequestTargets[item.id] ?? {
                  mode: "group",
                  value: "",
                };
                return (
                  <div
                    key={item.id}
                    className="rounded-md border border-border/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.opponent_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.match_date)} ·{" "}
                          {formatTime12(item.match_time)} · {t.expires}{" "}
                          {formatDate(item.expires_at)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.status === "accepted"
                            ? "success"
                            : item.status === "expired"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {formatMatchLabel(item.status, language)}
                      </Badge>
                    </div>
                    {item.status === "pending" && (
                      <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
                        <Select
                          value={target.mode}
                          onValueChange={(mode) =>
                            setAdminRequestTargets((prev) => ({
                              ...prev,
                              [item.id]: {
                                mode: mode as "group" | "birthday",
                                value: "",
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="group">{t.group}</SelectItem>
                            <SelectItem value="birthday">
                              {t.birthday}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={target.value}
                          onValueChange={(value) =>
                            setAdminRequestTargets((prev) => ({
                              ...prev,
                              [item.id]: { ...target, value },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                target.mode === "group"
                                  ? t.selectGroup
                                  : t.selectBirthday
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {target.mode === "group"
                              ? groups.map((group) => (
                                  <SelectItem
                                    key={group.group_id}
                                    value={group.group_id}
                                  >
                                    {group.group_name}
                                  </SelectItem>
                                ))
                              : birthdays.map((birthday) => (
                                  <SelectItem
                                    key={birthday.id}
                                    value={birthday.id}
                                  >
                                    {birthday.label}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          disabled={!target.value || acceptingAdminRequest}
                          onClick={() => acceptRequest(item.id)}
                        >
                          {t.accept}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!adminRequests.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t.noRequests}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
