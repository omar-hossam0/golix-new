"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CalendarClock,
  ChevronRight,
  Clock,
  Dumbbell,
  Goal,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  Trophy,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useGetPlayerCalendarEventsQuery,
  useGetPlayerEvaluationsQuery,
  useGetPlayerMatchesQuery,
  useGetPlayerProfileQuery,
  useGetPlayerProgressQuery,
  useGetPlayerTrainingsQuery,
} from "@/lib/store/api/calendarApi";
import type {
  CalendarEvent,
  Match,
  MatchPlayerStats,
  PlayerEvaluationRecord,
  PlayerProfile,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12, localDateTimeTimestamp } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

const closedStatuses = new Set(["completed", "finished", "cancelled"]);

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatNumber = (value: unknown) => {
  const numeric = numberValue(value);
  return numeric === null ? "0" : String(Math.round(numeric));
};

const formatRating = (value: unknown) => {
  const numeric = numberValue(value);
  if (numeric === null) return "N/A";
  return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)}/10`;
};

const percent = (value: unknown) => {
  const numeric = numberValue(value);
  return Math.max(0, Math.min(100, numeric ?? 0));
};

const ratingPercent = (value: unknown) => percent((numberValue(value) ?? 0) * 10);

const averageKnown = (values: unknown[]) => {
  const numbers = values
    .map(numberValue)
    .filter((value): value is number => value !== null);
  if (!numbers.length) return null;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
};

const firstKnown = (...values: unknown[]) => {
  for (const value of values) {
    const numeric = numberValue(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

const titleCase = (value: string | null | undefined) =>
  (value || "Not set")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const textValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const values = value.map(textValue).filter(Boolean);
    return values.length ? values.join(", ") : null;
  }
  return null;
};

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const profileValue = (
  profile: PlayerProfile | undefined,
  keys: string[],
): string | null => {
  if (!profile) return null;
  const normalizedKeys = new Set(keys.map(normalizeKey));

  for (const [key, value] of Object.entries(profile as Record<string, unknown>)) {
    if (normalizedKeys.has(normalizeKey(key))) {
      const text = textValue(value);
      if (text) return text;
    }
  }

  for (const item of profile.customProfile ?? []) {
    if (
      normalizedKeys.has(normalizeKey(item.key)) ||
      normalizedKeys.has(normalizeKey(item.label))
    ) {
      const text = textValue(item.value);
      if (text) return text;
    }
  }

  return null;
};

const matchTimestamp = (match: Match) => {
  const timestamp = localDateTimeTimestamp(match.match_date, match.match_time);
  if (timestamp) return timestamp;
  return Date.parse(`${match.match_date}T00:00:00`) || 0;
};

const eventTimestamp = (event: CalendarEvent) =>
  Date.parse(String(event.start_datetime || "")) || 0;

const uniqueEventsById = (items: CalendarEvent[]) => {
  const byId = new Map<string, CalendarEvent>();

  for (const item of items) {
    const key = String(item.id);
    if (!byId.has(key)) {
      byId.set(key, item);
    }
  }

  return Array.from(byId.values());
};

const statusVariant = (status: string): BadgeVariant => {
  if (["completed", "finished", "starter", "present"].includes(status)) return "success";
  if (["scheduled", "substitute", "reserve"].includes(status)) return "info";
  if (["postponed", "late"].includes(status)) return "warning";
  if (["cancelled", "absent", "injured"].includes(status)) return "destructive";
  return "secondary";
};

const trainingTechnicalRating = (evaluation: PlayerEvaluationRecord) =>
  firstKnown(
    evaluation.technical_rating,
    averageKnown([
      evaluation.ball_control_rating,
      evaluation.passing_accuracy_rating,
      evaluation.shooting_rating,
      evaluation.dribbling_rating,
      evaluation.receiving_under_pressure_rating,
    ]),
  );

const trainingPhysicalRating = (evaluation: PlayerEvaluationRecord) =>
  firstKnown(
    evaluation.physical_rating,
    averageKnown([
      evaluation.speed_rating,
      evaluation.endurance_rating,
      evaluation.strength_rating,
      evaluation.agility_rating,
    ]),
  );

const latestMatchEvaluation = (matches: Match[]) =>
  matches
    .flatMap((match) =>
      (match.stats ?? [])
        .filter((stats) => numberValue(stats.performance_rating) !== null)
        .map((stats) => ({ match, stats })),
    )
    .sort((a, b) => matchTimestamp(b.match) - matchTimestamp(a.match))[0];

const homeCopy = {
  en: {
    player: "Player",
    notSet: "Not set",
    welcome: (name: string) => `Welcome, ${name}`,
    description:
      "Your live academy data, upcoming schedule, match plan, and coach feedback.",
    home: "Home",
    settings: "Settings",
    matches: "Matches",
    calendar: "Calendar",
    loadWarning:
      "Some player data could not load. Anything available from the backend is still shown below.",
    loading: "Loading your player dashboard...",
    attendance: "Attendance",
    trainingsAttended: (count: string) => `${count} trainings attended`,
    matchesPlayed: "Matches Played",
    attendedRecords: (count: string) => `${count} attended records`,
    monthlyMinutes: "Monthly Minutes",
    matchEntries: (count: string) => `${count} match entries this month`,
    goalsAssists: "Goals / Assists",
    recordedMatchStats: "From recorded match stats",
    snapshot: "Player Snapshot",
    position: "Position",
    group: "Group",
    branch: "Branch",
    profile: "Profile",
    nextMatch: "Next Match",
    recentMatch: "Recent Match",
    rating: "Rating",
    minutes: "Minutes",
    noUpcomingMatch: "No upcoming match has been scheduled for your group yet.",
    upcomingSchedule: "Upcoming Schedule",
    noUpcomingEvents: "No upcoming training or calendar events are listed yet.",
    latestCoachFeedback: "Latest Coach Feedback",
    noCoachEvaluation: "No coach evaluation is available yet.",
    latestMatchEvaluation: "Latest match evaluation",
    latestTrainingEvaluation: "Latest training evaluation",
    overall: "Overall",
    publishedMatch: "Published match evaluation",
    publishedTraining: "Published training evaluation",
    technical: "Technical",
    ballWork: "Ball work and execution",
    physical: "Physical",
    fitness: "Fitness and intensity",
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    improvementPlan: "Improvement Plan",
    coachNotes: "Coach Notes",
    developmentNotes: "Development Notes",
    noCompletedMatch: "No completed matches with your data yet.",
  },
  ar: {
    player: "لاعب",
    notSet: "غير محدد",
    welcome: (name: string) => `أهلًا بعودتك، ${name}`,
    description: "بياناتك المباشرة وجدولك القادم وخطة المباريات وملاحظات المدرب.",
    home: "الرئيسية",
    settings: "الإعدادات",
    matches: "المباريات",
    calendar: "التقويم",
    loadWarning:
      "تعذر تحميل بعض بيانات اللاعب. يتم عرض أي بيانات متاحة من الباك إند بالأسفل.",
    loading: "جاري تحميل لوحة اللاعب...",
    attendance: "الحضور",
    trainingsAttended: (count: string) => `${count} حصص تدريب حضرتها`,
    matchesPlayed: "المباريات الملعوبة",
    attendedRecords: (count: string) => `${count} سجل حضور`,
    monthlyMinutes: "دقائق الشهر",
    matchEntries: (count: string) => `${count} سجل مباراة هذا الشهر`,
    goalsAssists: "الأهداف / التمريرات الحاسمة",
    recordedMatchStats: "من إحصائيات المباريات المسجلة",
    snapshot: "ملخص اللاعب",
    position: "المركز",
    group: "المجموعة",
    branch: "الفرع",
    profile: "الملف",
    nextMatch: "المباراة القادمة",
    recentMatch: "آخر مباراة",
    rating: "التقييم",
    minutes: "الدقائق",
    noUpcomingMatch: "لا توجد مباراة قادمة مجدولة لمجموعتك حتى الآن.",
    upcomingSchedule: "الجدول القادم",
    noUpcomingEvents: "لا توجد تدريبات أو أحداث قادمة في التقويم حتى الآن.",
    latestCoachFeedback: "آخر ملاحظات المدرب",
    noCoachEvaluation: "لا يوجد تقييم من المدرب حتى الآن.",
    latestMatchEvaluation: "آخر تقييم مباراة",
    latestTrainingEvaluation: "آخر تقييم تدريب",
    overall: "الإجمالي",
    publishedMatch: "تقييم مباراة منشور",
    publishedTraining: "تقييم تدريب منشور",
    technical: "فني",
    ballWork: "التحكم والتنفيذ",
    physical: "بدني",
    fitness: "اللياقة والشدة",
    strengths: "نقاط القوة",
    weaknesses: "نقاط الضعف",
    improvementPlan: "خطة التحسين",
    coachNotes: "ملاحظات المدرب",
    developmentNotes: "ملاحظات التطوير",
    noCompletedMatch: "لا توجد مباريات مكتملة ببياناتك حتى الآن.",
  },
} as const;

type HomeCopy = (typeof homeCopy)[keyof typeof homeCopy];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  progress?: number;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.045] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
          <span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-200">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">{detail}</p>
        {progress !== undefined && <Progress className="mt-4" value={progress} />}
      </CardContent>
    </Card>
  );
}

function MatchCard({
  match,
  copy,
  label,
}: {
  match: Match;
  copy: HomeCopy;
  label: string;
}) {
  const squad = match.squad?.[0];
  const stats = match.stats?.[0] as MatchPlayerStats | undefined;

  return (
    <Card className="border-white/10 bg-white/[0.045] shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              {match.opponent_name}
            </h3>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-cyan-300" />
                {formatDate(match.match_date)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-300" />
                {formatTime12(match.match_time)}
              </span>
              {match.location && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-cyan-300" />
                  {match.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(match.status)}>{titleCase(match.status)}</Badge>
            {squad?.squad_role && (
              <Badge variant={statusVariant(squad.squad_role)}>
                {titleCase(squad.squad_role)}
              </Badge>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/[0.035] p-3">
            <p className="text-xs text-slate-400">{copy.position}</p>
            <p className="mt-1 font-semibold text-white">{squad?.position || copy.notSet}</p>
          </div>
          <div className="rounded-lg bg-white/[0.035] p-3">
            <p className="text-xs text-slate-400">{copy.rating}</p>
            <p className="mt-1 font-semibold text-white">
              {formatRating(stats?.performance_rating)}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.035] p-3">
            <p className="text-xs text-slate-400">{copy.minutes}</p>
            <p className="mt-1 font-semibold text-white">
              {formatNumber(stats?.minutes_played)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const content = (
    <>
      <div>
        <p className="font-medium text-white">{event.title}</p>
        <p className="mt-1 text-sm text-slate-400">
          {formatDate(event.start_datetime)} | {formatTime12(event.start_datetime)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusVariant(event.status)}>{titleCase(event.status)}</Badge>
        {event.event_type === "training" && (
          <ChevronRight className="h-4 w-4 text-slate-500" />
        )}
      </div>
    </>
  );

  if (event.event_type === "training") {
    return (
      <Link
        href={`/player/training/${event.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.055]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      {content}
    </div>
  );
}

function LatestEvaluation({
  trainingEvaluation,
  matchEvaluation,
  copy,
}: {
  trainingEvaluation?: PlayerEvaluationRecord;
  matchEvaluation?: { match: Match; stats: MatchPlayerStats };
  copy: HomeCopy;
}) {
  const latestTrainingAt = trainingEvaluation
    ? Date.parse(String(trainingEvaluation.start_datetime || ""))
    : 0;
  const latestMatchAt = matchEvaluation ? matchTimestamp(matchEvaluation.match) : 0;
  const useMatch = Boolean(matchEvaluation && latestMatchAt >= latestTrainingAt);
  const evaluation = trainingEvaluation;

  if (!evaluation && !matchEvaluation) {
    return <EmptyState text={copy.noCoachEvaluation} />;
  }
  const overall = useMatch
    ? matchEvaluation?.stats.performance_rating
    : evaluation?.overall_rating;
  const technical = useMatch
    ? matchEvaluation?.stats.technical_rating
    : evaluation
      ? trainingTechnicalRating(evaluation)
      : null;
  const physical = useMatch
    ? matchEvaluation?.stats.physical_rating
    : evaluation
      ? trainingPhysicalRating(evaluation)
      : null;
  const notes = useMatch
    ? [
        { label: copy.strengths, value: matchEvaluation?.stats.strengths },
        { label: copy.weaknesses, value: matchEvaluation?.stats.weaknesses },
        {
          label: copy.improvementPlan,
          value: matchEvaluation?.stats.improvement_plan,
        },
        { label: copy.coachNotes, value: matchEvaluation?.stats.coach_notes },
      ].filter((note) => textValue(note.value))
    : [
        { label: copy.strengths, value: evaluation?.strengths },
        { label: copy.weaknesses, value: evaluation?.weaknesses },
        { label: copy.improvementPlan, value: evaluation?.improvement_plan },
        { label: copy.coachNotes, value: evaluation?.coach_notes },
        { label: copy.developmentNotes, value: evaluation?.development_notes },
      ].filter((note) => textValue(note.value));

  return (
    <div className="space-y-4">
      <Badge variant={useMatch ? "info" : "secondary"}>
        {useMatch ? copy.latestMatchEvaluation : copy.latestTrainingEvaluation}
      </Badge>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label={copy.overall}
          value={formatRating(overall)}
          detail={useMatch ? copy.publishedMatch : copy.publishedTraining}
          icon={Star}
          progress={ratingPercent(overall)}
        />
        <KpiCard
          label={copy.technical}
          value={formatRating(technical)}
          detail={copy.ballWork}
          icon={Goal}
          progress={ratingPercent(technical)}
        />
        <KpiCard
          label={copy.physical}
          value={formatRating(physical)}
          detail={copy.fitness}
          icon={ShieldCheck}
          progress={ratingPercent(physical)}
        />
      </div>
      {notes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <div key={note.label} className="rounded-lg bg-white/[0.035] p-4 text-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {note.label}
              </p>
              <p className="mt-2 leading-6 text-slate-300">
                {textValue(note.value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlayerHomePage() {
  const language = useDashboardLanguage();
  const copy = homeCopy[language];
  const profileQuery = useGetPlayerProfileQuery();
  const progressQuery = useGetPlayerProgressQuery();
  const matchesQuery = useGetPlayerMatchesQuery();
  const calendarQuery = useGetPlayerCalendarEventsQuery();
  const trainingsQuery = useGetPlayerTrainingsQuery();
  const evaluationsQuery = useGetPlayerEvaluationsQuery();

  const profile = profileQuery.data;
  const progress = progressQuery.data;
  const matches = useMemo(() => matchesQuery.data?.data ?? [], [matchesQuery.data]);
  const events = useMemo(() => calendarQuery.data?.data ?? [], [calendarQuery.data]);
  const trainings = useMemo(
    () => trainingsQuery.data?.data ?? [],
    [trainingsQuery.data],
  );
  const evaluations = useMemo(
    () => evaluationsQuery.data?.data ?? [],
    [evaluationsQuery.data],
  );

  const playerName = profile?.full_name || progress?.playerName || copy.player;
  const position =
    profileValue(profile, ["main_position", "main position"]) ||
    profile?.position ||
    copy.notSet;

  const nextMatch = matches
    .filter((match) => !closedStatuses.has(match.status))
    .sort((a, b) => matchTimestamp(a) - matchTimestamp(b))[0];
  const latestMatch = matches
    .filter((match) => closedStatuses.has(match.status))
    .sort((a, b) => matchTimestamp(b) - matchTimestamp(a))[0];
  const upcomingEvents = uniqueEventsById([...events, ...trainings])
    .filter((event) => !closedStatuses.has(event.status))
    .sort((a, b) => eventTimestamp(a) - eventTimestamp(b))
    .slice(0, 4);
  const latestEvaluation = evaluations
    .slice()
    .sort(
      (a, b) =>
        Date.parse(String(b.start_datetime || "")) -
        Date.parse(String(a.start_datetime || "")),
    )[0];
  const latestMatchFeedback = latestMatchEvaluation(matches);

  const isLoading =
    profileQuery.isLoading ||
    progressQuery.isLoading ||
    matchesQuery.isLoading ||
    calendarQuery.isLoading;
  const hasError =
    profileQuery.isError ||
    progressQuery.isError ||
    matchesQuery.isError ||
    calendarQuery.isError ||
    trainingsQuery.isError ||
    evaluationsQuery.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.welcome(playerName)}
        description={copy.description}
        breadcrumbs={[{ label: copy.home }]}
        actions={
          <div className="hidden gap-2 sm:flex">
            <Link
              href="/player/settings"
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
            >
              {copy.settings}
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/player/matches"
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
            >
              {copy.matches}
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/player/calendar"
              className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
            >
              {copy.calendar}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      {hasError && (
        <Card className="border-amber-400/30 bg-amber-500/10 shadow-none">
          <CardContent className="p-4 text-sm text-amber-100">
            {copy.loadWarning}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={copy.attendance}
              value={`${formatNumber(progress?.attendancePercentage)}%`}
              detail={copy.trainingsAttended(formatNumber(progress?.trainingsAttended))}
              icon={ShieldCheck}
              progress={percent(progress?.attendancePercentage)}
            />
            <KpiCard
              label={copy.matchesPlayed}
              value={formatNumber(progress?.matchesPlayed)}
              detail={copy.attendedRecords(formatNumber(progress?.matchesAttended))}
              icon={Trophy}
            />
            <KpiCard
              label={copy.monthlyMinutes}
              value={formatNumber(progress?.monthlyMinutesPlayed)}
              detail={copy.matchEntries(formatNumber(progress?.monthlyMatchesPlayed))}
              icon={Clock}
              progress={percent(Number(progress?.monthlyMinutesPlayed ?? 0) / 0.9)}
            />
            <KpiCard
              label={copy.goalsAssists}
              value={`${formatNumber(progress?.goals)} / ${formatNumber(progress?.assists)}`}
              detail={copy.recordedMatchStats}
              icon={Goal}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-cyan-300" />
                  {copy.snapshot}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white/[0.035] p-4">
                  <p className="text-xs text-slate-400">{copy.position}</p>
                  <p className="mt-1 font-semibold text-white">{position}</p>
                </div>
                <div className="rounded-lg bg-white/[0.035] p-4">
                  <p className="text-xs text-slate-400">{copy.group}</p>
                  <p className="mt-1 font-semibold text-white">
                    {profile?.group_name || copy.notSet}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.035] p-4">
                  <p className="text-xs text-slate-400">{copy.branch}</p>
                  <p className="mt-1 font-semibold text-white">
                    {profile?.branch_name || copy.notSet}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.035] p-4">
                  <p className="text-xs text-slate-400">{copy.profile}</p>
                  <p className="mt-1 font-semibold text-white">
                    {titleCase(profile?.profile_status)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {nextMatch ? (
              <MatchCard match={nextMatch} copy={copy} label={copy.nextMatch} />
            ) : (
              <Card className="border-white/10 bg-white/[0.045] shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{copy.nextMatch}</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmptyState text={copy.noUpcomingMatch} />
                </CardContent>
              </Card>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Dumbbell className="h-4 w-4 text-cyan-300" />
                  {copy.upcomingSchedule}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.length ? (
                  upcomingEvents.map((event) => <EventRow key={event.id} event={event} />)
                ) : (
                  <EmptyState text={copy.noUpcomingEvents} />
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-cyan-300" />
                  {copy.latestCoachFeedback}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LatestEvaluation
                  trainingEvaluation={latestEvaluation}
                  matchEvaluation={latestMatchFeedback}
                  copy={copy}
                />
              </CardContent>
            </Card>
          </section>

          <Card className="border-white/10 bg-white/[0.045] shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{copy.recentMatch}</CardTitle>
            </CardHeader>
            <CardContent>
              {latestMatch ? (
                <MatchCard match={latestMatch} copy={copy} label={copy.recentMatch} />
              ) : (
                <EmptyState text={copy.noCompletedMatch} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
