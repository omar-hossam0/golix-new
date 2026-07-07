"use client";

import { Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Match } from "@/lib/store/api/calendarApi";
import { formatDate, formatTime12 } from "@/lib/utils";

interface FinishedMatchDetailsProps {
  match?: Match;
  isLoading?: boolean;
  hasMatches: boolean;
}

export function FinishedMatchDetails({
  match,
  isLoading = false,
  hasMatches,
}: FinishedMatchDetailsProps) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading match details...
      </p>
    );
  }

  if (!match && hasMatches) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Eye className="h-4 w-4" />
        Select a finished match to view its saved details.
      </p>
    );
  }

  if (!match) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Finished matches will appear here after the match ends or three hours
        pass from kick-off.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{match.opponent_name}</h3>
            <Badge variant="outline">
              {match.match_type === "friendly" ? "Friendly" : "Not friendly"}
            </Badge>
            <Badge variant="success">played</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(match.match_date)} · {formatTime12(match.match_time)} ·{" "}
            {match.location || "To be confirmed"}
          </p>
        </div>
        <div className="rounded-md bg-muted/20 px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-2xl font-semibold">
            {match.our_score ?? "-"} : {match.opponent_score ?? "-"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-muted/10 p-3">
          <p className="text-xs text-muted-foreground">Groups</p>
          <p className="mt-1 text-sm font-medium">
            {match.groups?.map((group) => group.name).join(", ") ||
              match.team_name ||
              "No group"}
          </p>
        </div>
        <div className="rounded-md bg-muted/10 p-3">
          <p className="text-xs text-muted-foreground">Venue</p>
          <p className="mt-1 text-sm font-medium">{match.venue_type}</p>
        </div>
        <div className="rounded-md bg-muted/10 p-3">
          <p className="text-xs text-muted-foreground">Referee</p>
          <p className="mt-1 text-sm font-medium">
            {match.referee_name || "Not recorded"}
          </p>
        </div>
        <div className="rounded-md bg-muted/10 p-3">
          <p className="text-xs text-muted-foreground">Finished at</p>
          <p className="mt-1 text-sm font-medium">
            {match.finished_at
              ? `${formatDate(match.finished_at)} · ${formatTime12(match.finished_at)}`
              : "Auto finished"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border/40 p-4">
          <p className="font-medium">Plan & Tactics</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Formation</p>
              <p className="font-medium">
                {match.tactics?.formation || "Not saved"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coach</p>
              <p className="font-medium">
                {match.tactics?.coach_name || "Not recorded"}
              </p>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {match.tactics?.tactical_notes ||
              match.match_notes ||
              "No tactical notes recorded."}
          </p>
        </div>

        <div className="rounded-md border border-border/40 p-4">
          <p className="font-medium">Match Notes</p>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p className="whitespace-pre-wrap">
              {match.organizer_notes || "No organizer notes."}
            </p>
            <p className="whitespace-pre-wrap">
              {match.match_notes || "No post-match notes."}
            </p>
          </div>
        </div>
      </div>

      {Boolean(match.postponements?.length) && (
        <div className="rounded-md border border-border/40 p-4">
          <p className="font-medium">Postponement History</p>
          <div className="mt-3 space-y-2">
            {match.postponements?.map((item) => (
              <div
                key={item.id}
                className="rounded-md bg-muted/10 px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {formatDate(item.previous_date)} at{" "}
                  {formatTime12(item.previous_time)} moved to{" "}
                  {formatDate(item.new_date)} at {formatTime12(item.new_time)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.reason || "No reason recorded."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border/40 p-4">
          <p className="font-medium">Squad & Instructions</p>
          <div className="mt-3 space-y-2">
            {match.squad?.map((player) => (
              <div
                key={player.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/10 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{player.player_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {player.player_instruction || "No instruction"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{player.squad_role}</Badge>
                  {player.position && (
                    <Badge variant="secondary">{player.position}</Badge>
                  )}
                </div>
              </div>
            ))}
            {!match.squad?.length && (
              <p className="text-sm text-muted-foreground">No squad saved.</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border/40 p-4">
          <p className="font-medium">Attendance</p>
          <div className="mt-3 space-y-2">
            {match.attendance?.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/10 px-3 py-2 text-sm"
              >
                <span className="font-medium">{record.player_name}</span>
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
            {!match.attendance?.length && (
              <p className="text-sm text-muted-foreground">
                No attendance recorded.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/40">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-3 font-medium">Player</th>
              <th className="px-3 py-3 font-medium">Min</th>
              <th className="px-3 py-3 font-medium">Week Min</th>
              <th className="px-3 py-3 font-medium">G</th>
              <th className="px-3 py-3 font-medium">A</th>
              <th className="px-3 py-3 font-medium">Cards</th>
              <th className="px-3 py-3 font-medium">Rating</th>
              <th className="px-3 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {match.stats?.map((stat) => (
              <tr
                key={stat.id}
                className="border-b border-border/30 last:border-0"
              >
                <td className="px-3 py-3 font-medium">{stat.player_name}</td>
                <td className="px-3 py-3">{stat.minutes_played}</td>
                <td className="px-3 py-3">
                  {stat.weekly_minutes_played ?? 0}
                  {stat.weekly_matches_played
                    ? ` / ${stat.weekly_matches_played} match${stat.weekly_matches_played === 1 ? "" : "es"}`
                    : ""}
                </td>
                <td className="px-3 py-3">{stat.goals}</td>
                <td className="px-3 py-3">{stat.assists}</td>
                <td className="px-3 py-3">
                  {stat.yellow_cards}Y / {stat.red_cards}R
                </td>
                <td className="px-3 py-3">
                  {stat.performance_rating ?? "-"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {stat.coach_notes || stat.injuries || "-"}
                </td>
              </tr>
            ))}
            {!match.stats?.length && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No player stats recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border/40 p-4">
        <p className="font-medium">Goals</p>
        <div className="mt-3 space-y-2">
          {match.goal_events?.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/10 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {goal.team === "our"
                    ? goal.scorer_player_name || "GOALIX goal"
                    : `${match.opponent_name} goal`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Minute {goal.minute}
                  {goal.assist_player_name
                    ? ` · assist ${goal.assist_player_name}`
                    : ""}
                </p>
              </div>
              <Badge variant={goal.team === "our" ? "success" : "secondary"}>
                {goal.team === "our" ? "GOALIX" : "opponent"}
              </Badge>
            </div>
          ))}
          {!match.goal_events?.length && (
            <p className="text-sm text-muted-foreground">No goals recorded.</p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/40 p-4">
        <p className="font-medium">Substitutions</p>
        <div className="mt-3 space-y-2">
          {match.substitutions?.map((substitution) => (
            <div
              key={substitution.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/10 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {substitution.in_player_name} for{" "}
                  {substitution.out_player_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Minute {substitution.minute}
                  {substitution.reason ? ` · ${substitution.reason}` : ""}
                </p>
              </div>
              <Badge variant="outline">substitution</Badge>
            </div>
          ))}
          {!match.substitutions?.length && (
            <p className="text-sm text-muted-foreground">
              No substitutions recorded.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/40 p-4">
        <p className="font-medium">Incidents</p>
        <div className="mt-3 space-y-2">
          {match.incidents?.map((incident) => (
            <div
              key={incident.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/10 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{incident.player_name}</p>
                <p className="text-xs text-muted-foreground">
                  {incident.incident_type.replace("_", " ")}
                  {incident.body_part ? ` · ${incident.body_part}` : ""}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {incident.notes || "No notes"}
              </p>
            </div>
          ))}
          {!match.incidents?.length && (
            <p className="text-sm text-muted-foreground">
              No incidents recorded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
