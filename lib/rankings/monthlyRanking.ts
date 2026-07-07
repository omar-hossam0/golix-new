import type { RankingSystemInput } from "@/lib/store/api/calendarApi";

export type MonthlyRankingRow = {
  id: string;
  month: string;
  playerId: string;
  playerName: string;
  position: string | null;
  roleFamily: RankingSystemInput["role_family"];
  score: number | null;
  predicted: number | null;
  rank: number;
  weekCount: number;
  weekStarts: string[];
  latestRow: RankingSystemInput | null;
  breakdown: {
    coachScore: number | null;
    attendanceScore: number | null;
    matchScore: number | null;
    weeklyAiScore: number | null;
  };
};

export type WeeklyRankingPeriod = {
  key: string;
  label: string;
  start: string;
  end: string;
  rangeLabel: string;
  rows: RankingSystemInput[];
};

export type MonthlyRankingPeriod = {
  key: string;
  label: string;
  start: string;
  end: string;
  rangeLabel: string;
  weeksLabel: string;
  rows: MonthlyRankingRow[];
};

export const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const rankingWeeklyScore = (row: RankingSystemInput) =>
  numberValue(row.final_api_response?.weekly_score ?? row.weekly_score);

export const rankingPredictedScore = (row: RankingSystemInput) =>
  numberValue(row.final_api_response?.predicted_next_score ?? row.predicted_next_score);

export const rankingRankValue = (row: RankingSystemInput) =>
  Number(row.final_api_response?.rank ?? row.rank ?? 0);

export const isRankingCarryForwardRow = (row: RankingSystemInput) =>
  Boolean(row.carry_forward || row.final_api_response?.carry_forward);

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export const rankingDateKey = (value: string | null | undefined) =>
  String(value || "").slice(0, 10);

export const currentRankingWeekStartKey = (today = new Date()) => {
  const utcDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  return dateKey(utcDate);
};

export const isRankingWeekComplete = (
  weekStart: string | null | undefined,
  currentWeekStart = currentRankingWeekStartKey(),
) => {
  const weekKey = rankingDateKey(weekStart);
  return Boolean(weekKey && weekKey < currentWeekStart);
};

type RankingPeriodOptions = {
  currentWeekStart?: string;
  includeCurrentWeek?: boolean;
  includeCarryForward?: boolean;
};

export const isActualCompletedRankingRow = (
  row: RankingSystemInput,
  options: RankingPeriodOptions = {},
) => {
  if (!options.includeCarryForward && isRankingCarryForwardRow(row)) return false;
  if (options.includeCurrentWeek) return Boolean(rankingDateKey(row.week_start));
  return isRankingWeekComplete(row.week_start, options.currentWeekStart);
};

export const latestCompletedRankingWeekKey = (
  rows: RankingSystemInput[],
  options: RankingPeriodOptions = {},
) =>
  rows
    .filter((row) => isActualCompletedRankingRow(row, options))
    .map((row) => rankingDateKey(row.week_start))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || "";

export const rankingMonthKey = (value: string | null | undefined) =>
  String(value || "").slice(0, 7);

export const rankingMonthRange = (month: string, locale = "en") => {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    return { start: "", end: "", label: month || "Unknown month" };
  }

  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(startDate);

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    label,
  };
};

export const rankingMonthLabel = (month: string, locale = "en") =>
  rankingMonthRange(month, locale).label;

export const rankingWeekOfMonthNumber = (weekStart: string | null | undefined) => {
  const weekKey = rankingDateKey(weekStart);
  const dayOfMonth = Number(weekKey.slice(8, 10));
  if (!dayOfMonth) return null;
  return Math.floor((dayOfMonth - 1) / 7) + 1;
};

export const rankingWeekLabel = (
  weekStart: string | null | undefined,
  locale = "en",
) => {
  const weekKey = rankingDateKey(weekStart);
  const weekNumber = rankingWeekOfMonthNumber(weekKey);
  const monthLabel = rankingMonthLabel(rankingMonthKey(weekKey), locale);
  if (!weekKey || !weekNumber) return "Unknown week";
  return `Week ${weekNumber} of ${monthLabel}`;
};

export const rankingWeeksInMonthLabel = (
  weekStarts: string[],
  month?: string,
  locale = "en",
) => {
  const weekNumbers = [
    ...new Set(
      weekStarts
        .map((weekStart) => rankingWeekOfMonthNumber(weekStart))
        .filter((value): value is number => value !== null),
    ),
  ].sort((a, b) => a - b);
  const targetMonth = month || rankingMonthKey(weekStarts[0]);
  const label = rankingMonthLabel(targetMonth, locale);
  if (!weekNumbers.length) return label;
  return `${weekNumbers.length === 1 ? "Week" : "Weeks"} ${weekNumbers.join(", ")} of ${label}`;
};

export const latestRankingMonthKey = (
  rows: RankingSystemInput[],
  options: RankingPeriodOptions = {},
) =>
  rows
    .filter((row) => isActualCompletedRankingRow(row, options))
    .map((row) => rankingMonthKey(row.week_start))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || "";

export const sortWeeklyRankingRows = (rows: RankingSystemInput[]) =>
  [...rows].sort((a, b) => {
    const rankDiff = rankingRankValue(a) - rankingRankValue(b);
    if (rankDiff) return rankDiff;
    const scoreDiff = (rankingWeeklyScore(b) ?? -1) - (rankingWeeklyScore(a) ?? -1);
    if (scoreDiff) return scoreDiff;
    return String(a.player_name || "").localeCompare(String(b.player_name || ""));
  });

const average = (values: Array<number | null>) => {
  const numeric = values.filter((value): value is number => value !== null);
  if (!numeric.length) return null;
  return Number(
    (numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2),
  );
};

export const buildMonthlyRankingRows = (
  rows: RankingSystemInput[],
  month?: string,
  options: RankingPeriodOptions = {},
): MonthlyRankingRow[] => {
  const targetMonth = month || latestRankingMonthKey(rows, options);
  if (!targetMonth) return [];

  const byPlayer = new Map<string, RankingSystemInput[]>();
  rows
    .filter((row) => isActualCompletedRankingRow(row, options))
    .filter((row) => rankingMonthKey(row.week_start) === targetMonth)
    .forEach((row) => {
      if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, []);
      byPlayer.get(row.player_id)?.push(row);
    });

  return [...byPlayer.entries()]
    .map(([playerId, playerRows]) => {
      const sortedRows = [...playerRows].sort((a, b) =>
        String(b.week_start || "").localeCompare(String(a.week_start || "")),
      );
      const latestRow = sortedRows[0] || null;
      const weekStarts = [
        ...new Set(
          playerRows.map((row) => rankingDateKey(row.week_start)).filter(Boolean),
        ),
      ].sort();

      return {
        id: `${targetMonth}:${playerId}`,
        month: targetMonth,
        playerId,
        playerName: latestRow?.player_name || "Player",
        position: latestRow?.position || null,
        roleFamily: latestRow?.role_family || "unknown",
        score: average(playerRows.map(rankingWeeklyScore)),
        predicted: average(playerRows.map(rankingPredictedScore)),
        rank: 0,
        weekCount: weekStarts.length,
        weekStarts,
        latestRow,
        breakdown: {
          coachScore: average(playerRows.map((row) => numberValue(row.coach_score))),
          attendanceScore: average(playerRows.map((row) => numberValue(row.attendance_score))),
          matchScore: average(playerRows.map((row) => numberValue(row.match_score))),
          weeklyAiScore: average(playerRows.map((row) => numberValue(row.weekly_ai_score))),
        },
      };
    })
    .sort((a, b) => {
      const scoreDiff = (b.score ?? -1) - (a.score ?? -1);
      if (scoreDiff) return scoreDiff;
      return a.playerName.localeCompare(b.playerName);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

export const buildWeeklyRankingHistory = (
  rows: RankingSystemInput[],
  options: RankingPeriodOptions = {},
): WeeklyRankingPeriod[] => {
  const byWeek = new Map<string, RankingSystemInput[]>();
  rows
    .filter((row) => isActualCompletedRankingRow(row, options))
    .forEach((row) => {
      const weekKey = rankingDateKey(row.week_start);
      if (!weekKey) return;
      if (!byWeek.has(weekKey)) byWeek.set(weekKey, []);
      byWeek.get(weekKey)?.push(row);
    });

  return [...byWeek.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, weekRows]) => {
      const end = rankingDateKey(weekRows[0]?.week_end);
      return {
        key,
        label: rankingWeekLabel(key),
        start: key,
        end,
        rangeLabel: end ? `${key} to ${end}` : key,
        rows: sortWeeklyRankingRows(weekRows),
      };
    });
};

export const buildMonthlyRankingHistory = (
  rows: RankingSystemInput[],
  options: RankingPeriodOptions = {},
): MonthlyRankingPeriod[] => {
  const monthKeys = [
    ...new Set(
      rows
        .filter((row) => isActualCompletedRankingRow(row, options))
        .map((row) => rankingMonthKey(row.week_start))
        .filter(Boolean),
    ),
  ].sort((a, b) => b.localeCompare(a));

  return monthKeys.map((month) => {
    const range = rankingMonthRange(month);
    const monthlyRows = buildMonthlyRankingRows(rows, month, options);
    const weekStarts = [
      ...new Set(monthlyRows.flatMap((row) => row.weekStarts)),
    ].sort();

    return {
      key: month,
      label: range.label,
      start: range.start,
      end: range.end,
      rangeLabel: range.start ? `${range.start} to ${range.end}` : month,
      weeksLabel: weekStarts.length
        ? rankingWeeksInMonthLabel(weekStarts, month)
        : "No completed weeks",
      rows: monthlyRows,
    };
  });
};
