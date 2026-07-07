"use client";

import { useSyncExternalStore } from "react";
import {
  CalendarClock,
  ClipboardList,
  Clock,
  Goal,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  UserCheck,
} from "lucide-react";
import { PlayerAttendanceQrPrompt } from "@/components/attendance/PlayerAttendanceQrPrompt";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useGetPlayerAttendanceQrQuery,
  useGetPlayerMatchesQuery,
} from "@/lib/store/api/calendarApi";
import type {
  Match,
  MatchPlayerStats,
  PlayerAttendanceQr,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12, localDateTimeTimestamp } from "@/lib/utils";

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

let playerMatchesClockSnapshot = 0;
const subscribePlayerMatchesClock = (onStoreChange: () => void) => {
  playerMatchesClockSnapshot = Date.now();
  onStoreChange();
  const intervalId = window.setInterval(() => {
    playerMatchesClockSnapshot = Date.now();
    onStoreChange();
  }, 1000);
  return () => window.clearInterval(intervalId);
};
const getPlayerMatchesClockSnapshot = () => playerMatchesClockSnapshot;
const getServerPlayerMatchesClockSnapshot = () => 0;

const QR_WINDOW_MS = 15 * 60 * 1000;

const formatRating = (value: unknown) => {
  const rating = numberValue(value);
  if (rating === null) return "N/A";
  return `${Number.isInteger(rating) ? rating : rating.toFixed(1)}/10`;
};

const ratingProgress = (value: unknown) => {
  const rating = numberValue(value);
  return rating === null ? 0 : Math.max(0, Math.min(100, rating * 10));
};

const formatNumber = (value: unknown) => {
  const numeric = numberValue(value);
  return numeric === null ? "0" : String(Math.round(numeric));
};

const isGoalkeeperPosition = (position?: string | null) => {
  const normalized = String(position ?? "").trim().toLowerCase();
  return normalized === "gk" || normalized.includes("goalkeeper");
};

const titleCase = (value: string | null | undefined) =>
  (value || "Not set")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const matchTimestamp = (match: Match) => {
  const timestamp = localDateTimeTimestamp(match.match_date, match.match_time);
  if (timestamp) return timestamp;
  return Date.parse(`${match.match_date}T00:00:00`) || 0;
};

const statusVariant = (status: string) => {
  if (["completed", "finished", "starter", "present"].includes(status)) return "success" as const;
  if (["scheduled", "substitute", "reserve"].includes(status)) return "info" as const;
  if (["postponed", "late"].includes(status)) return "warning" as const;
  if (["cancelled", "absent", "injured"].includes(status)) return "destructive" as const;
  return "secondary" as const;
};

const statFields: Array<{ key: keyof MatchPlayerStats; label: string }> = [
  { key: "performance_rating", label: "Overall" },
  { key: "technical_rating", label: "Technical" },
  { key: "tactical_rating", label: "Tactical" },
  { key: "physical_rating", label: "Physical" },
  { key: "fatigue_rating", label: "Fatigue" },
  { key: "mentality_rating", label: "Mentality" },
  { key: "decision_making_rating", label: "Decision Making" },
  { key: "work_rate_rating", label: "Work Rate" },
  { key: "positioning_rating", label: "Positioning" },
];

const matchesCopy = {
  en: {
    title: "Matches",
    description: "Your squad role, match plan, instructions, and post-match evaluation.",
    home: "Home",
    matchEvaluation: "Match Evaluation",
  },
  ar: {
    title: "المباريات",
    description: "دورك في التشكيل وخطة المباراة والتعليمات وتقييم ما بعد المباراة.",
    home: "الرئيسية",
    matchEvaluation: "تقييم المباراة",
  },
} as const;

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-3 text-center">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function MatchEvaluation({
  stats,
  position,
}: {
  stats?: MatchPlayerStats;
  position?: string | null;
}) {
  if (!stats) {
    return <EmptyState text="No match evaluation has been published for you yet." />;
  }

  const showSaves = isGoalkeeperPosition(position);
  const visibleRatings = statFields.filter(
    (field) => stats[field.key] !== null && stats[field.key] !== undefined,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatBox label="Minutes" value={formatNumber(stats.minutes_played)} />
        <StatBox label="Goals" value={formatNumber(stats.goals)} />
        <StatBox label="Assists" value={formatNumber(stats.assists)} />
        {showSaves && <StatBox label="Saves" value={formatNumber(stats.saves)} />}
        <StatBox label="Yellow" value={formatNumber(stats.yellow_cards)} />
        <StatBox label="Red" value={formatNumber(stats.red_cards)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleRatings.map((field) => (
          <div key={field.key} className="rounded-lg bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">{field.label}</span>
              <span className="font-semibold text-white">
                {formatRating(stats[field.key])}
              </span>
            </div>
            <Progress
              value={ratingProgress(stats[field.key])}
              className="h-1.5 bg-slate-800"
            />
          </div>
        ))}
      </div>

      {(stats.strengths ||
        stats.weaknesses ||
        stats.improvement_plan ||
        stats.coach_notes) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {stats.strengths && (
            <div className="rounded-lg bg-emerald-400/10 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-200">
                Strengths
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {stats.strengths}
              </p>
            </div>
          )}
          {stats.weaknesses && (
            <div className="rounded-lg bg-amber-400/10 p-4">
              <p className="text-xs font-semibold uppercase text-amber-200">
                Weaknesses
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {stats.weaknesses}
              </p>
            </div>
          )}
          {stats.improvement_plan && (
            <div className="rounded-lg bg-cyan-400/10 p-4">
              <p className="text-xs font-semibold uppercase text-cyan-200">
                Improvement Plan
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {stats.improvement_plan}
              </p>
            </div>
          )}
          {stats.coach_notes && (
            <div className="rounded-lg bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Coach Notes
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {stats.coach_notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  nowMs,
  qr,
}: {
  match: Match;
  nowMs: number;
  qr?: PlayerAttendanceQr;
}) {
  const language = useDashboardLanguage();
  const t = matchesCopy[language];
  const mySquad = match.squad?.[0];
  const myStats = match.stats?.[0];
  const myAttendance = match.attendance?.[0];
  const hasPlan = Boolean(match.tactics || mySquad);
  const startMs = matchTimestamp(match);
  const showAttendanceQr = Boolean(
    startMs &&
      nowMs >= startMs - QR_WINDOW_MS &&
      !["finished", "completed", "cancelled"].includes(match.status),
  );

  return (
    <Card className="border-white/10 bg-white/[0.045] shadow-none">
      <CardContent className="space-y-4 p-4">
        {showAttendanceQr && (
          <PlayerAttendanceQrPrompt
            kind="match"
            title={match.opponent_name}
            startsAt={`${match.match_date}T${match.match_time}`}
            qr={qr}
            attendanceStatus={myAttendance?.status}
          />
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-200">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-white">
                  {match.opponent_name}
                </h3>
                <Badge variant={statusVariant(match.status)}>
                  {titleCase(match.status)}
                </Badge>
                <Badge variant="outline">{titleCase(match.match_type)}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-4 w-4" />
                  {formatDate(match.match_date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime12(match.match_time)}
                </span>
                {match.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {match.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant={mySquad ? statusVariant(mySquad.squad_role) : "secondary"}>
            {mySquad ? titleCase(mySquad.squad_role) : "Not selected yet"}
          </Badge>
          {myAttendance && (
            <Badge variant={statusVariant(myAttendance.status)}>
              Attendance {titleCase(myAttendance.status)}
            </Badge>
          )}
        </div>

        {hasPlan ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-white/[0.035] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <UserCheck className="h-4 w-4" />
                Your Position
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {mySquad?.position || "Not assigned"}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.035] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                Formation
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {match.tactics?.formation || "Not set"}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.035] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <UserCheck className="h-4 w-4" />
                Attendance
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {titleCase(myAttendance?.status)}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.035] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <Goal className="h-4 w-4" />
                Goals | Assists
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatNumber(myStats?.goals)} | {formatNumber(myStats?.assists)}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState text="The coach has not published your match configuration yet." />
        )}

        {(mySquad?.player_instruction || match.tactics?.tactical_notes) && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-200">
                <ClipboardList className="h-4 w-4" />
                Your Instructions
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {mySquad?.player_instruction || "No individual instruction yet."}
              </p>
            </div>
            <div className="rounded-lg border border-lime-400/20 bg-lime-400/10 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-lime-200">
                <Target className="h-4 w-4" />
                Tactical Notes
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {match.tactics?.tactical_notes || "No tactical notes yet."}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-[#06111f]/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-300" />
            <h4 className="font-semibold text-white">{t.matchEvaluation}</h4>
          </div>
          <MatchEvaluation stats={myStats} position={mySquad?.position} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlayerMatchesPage() {
  const language = useDashboardLanguage();
  const t = matchesCopy[language];
  const nowMs = useSyncExternalStore(
    subscribePlayerMatchesClock,
    getPlayerMatchesClockSnapshot,
    getServerPlayerMatchesClockSnapshot,
  );
  const attendanceQrQuery = useGetPlayerAttendanceQrQuery();
  const { data, isLoading, isFetching } = useGetPlayerMatchesQuery();
  const matches = (data?.data ?? [])
    .slice()
    .sort((a, b) => matchTimestamp(a) - matchTimestamp(b));

  const upcomingMatches = matches.filter(
    (match) => !["finished", "completed", "cancelled"].includes(match.status),
  );
  const completedMatches = matches
    .filter((match) => ["finished", "completed"].includes(match.status))
    .reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/player/home" },
          { label: t.title },
        ]}
      />

      {isLoading || isFetching ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading matches...
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-white">
              Upcoming Matches
            </h2>
              {upcomingMatches.length ? (
                upcomingMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    nowMs={nowMs}
                    qr={attendanceQrQuery.data}
                  />
                ))
              ) : (
                <EmptyState text="No upcoming matches are visible for you yet." />
              )}
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-white">
              Completed Matches
            </h2>
              {completedMatches.length ? (
                completedMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    nowMs={nowMs}
                    qr={attendanceQrQuery.data}
                  />
                ))
              ) : (
                <EmptyState text="No completed matches with your data yet." />
              )}
          </section>
        </div>
      )}
    </div>
  );
}
