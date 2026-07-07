function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function addValue(target, value) {
  const numeric = numberOrNull(value);
  if (numeric !== null) target.push(numeric);
}

function avg(values) {
  return values.length
    ? Number(
        (
          values.reduce((sum, value) => sum + value, 0) / values.length
        ).toFixed(2),
      )
    : null;
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Number(numeric.toFixed(2))));
}

function scoreOrZero(value) {
  const score = clampScore(value);
  return score === null ? 0 : score;
}

function parseDateKey(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(value) {
  return value.toISOString().slice(0, 10);
}

function addDaysKey(value, days) {
  const date = parseDateKey(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function weekEndKey(weekStart) {
  return addDaysKey(weekStart, 6);
}

function buildContinuousWeekKeys(keys, latestWeekKey) {
  const sortedKeys = [...new Set(keys.filter(Boolean).map(String))].sort();
  if (latestWeekKey && !sortedKeys.includes(latestWeekKey)) {
    sortedKeys.push(latestWeekKey);
    sortedKeys.sort();
  }
  const firstKey = sortedKeys[0];
  const lastKey = sortedKeys[sortedKeys.length - 1];
  const firstDate = parseDateKey(firstKey);
  const lastDate = parseDateKey(lastKey);
  if (!firstDate || !lastDate) return sortedKeys;

  const output = [];
  for (
    const cursor = new Date(firstDate);
    cursor.getTime() <= lastDate.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  ) {
    output.push(dateKey(cursor));
  }
  return output;
}

function ratingToScore(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) return null;
  return clampScore(numeric <= 10 ? numeric * 10 : numeric);
}

function avgScore(values) {
  return avg(values.map(ratingToScore).filter((value) => value !== null));
}

function gradeForScore(score) {
  const numeric = scoreOrZero(score);
  if (numeric >= 90) return "A";
  if (numeric >= 80) return "B";
  if (numeric >= 70) return "C";
  if (numeric >= 60) return "D";
  return "F";
}

function weightedWeeklyScore({
  matchScore,
  coachScore,
  attendanceScore,
  weeklyAiScore,
}) {
  return clampScore(
    scoreOrZero(matchScore) * 0.5 +
      scoreOrZero(coachScore) * 0.25 +
      scoreOrZero(attendanceScore) * 0.15 +
      scoreOrZero(weeklyAiScore) * 0.1,
  );
}

const optionRanges = {
  rating10: [
    { min: 0, max: 3.9, midpoint: 1.95 },
    { min: 4, max: 6.4, midpoint: 5.2 },
    { min: 6.5, max: 8.4, midpoint: 7.45 },
    { min: 8.5, max: 10, midpoint: 9.25 },
  ],
  percentage: [
    { min: 0, max: 49, midpoint: 24.5 },
    { min: 50, max: 69, midpoint: 59.5 },
    { min: 70, max: 84, midpoint: 77 },
    { min: 85, max: 100, midpoint: 92.5 },
  ],
  chance: [
    { min: 0, max: 0, midpoint: 0 },
    { min: 1, max: 1, midpoint: 1 },
    { min: 2, max: 2, midpoint: 2 },
    { min: 3, max: Number.POSITIVE_INFINITY, midpoint: 4 },
  ],
  defensiveCount: [
    { min: 0, max: 1, midpoint: 0.5 },
    { min: 2, max: 3, midpoint: 2.5 },
    { min: 4, max: 5, midpoint: 4.5 },
    { min: 6, max: Number.POSITIVE_INFINITY, midpoint: 7 },
  ],
  duels: [
    { min: 0, max: 39, midpoint: 19.5 },
    { min: 40, max: 59, midpoint: 49.5 },
    { min: 60, max: 79, midpoint: 69.5 },
    { min: 80, max: 100, midpoint: 90 },
  ],
  possessionLoss: [
    { min: 0, max: 3, midpoint: 1.5 },
    { min: 4, max: 6, midpoint: 5 },
    { min: 7, max: 10, midpoint: 8.5 },
    { min: 11, max: Number.POSITIVE_INFINITY, midpoint: 12 },
  ],
};

function optionMidpoint(value, optionType, { zeroMeansMissing = false } = {}) {
  const numeric = numberOrNull(value);
  if (numeric === null) return null;
  if (zeroMeansMissing && numeric === 0) return null;
  const ranges = optionRanges[optionType] || [];
  const range = ranges.find(
    (item) => numeric >= item.min && numeric <= item.max,
  );
  return range ? range.midpoint : Number(numeric.toFixed(2));
}

function addOptionValue(target, value, optionType, options) {
  const numeric = optionMidpoint(value, optionType, options);
  if (numeric !== null) target.push(numeric);
}

function avgOptionValues(values, optionType, options) {
  return avg(
    values
      .map((value) => optionMidpoint(value, optionType, options))
      .filter((value) => value !== null),
  );
}

function normalizePosition(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function roleFamily(position) {
  const normalized = normalizePosition(position);
  if (["GK", "GOALKEEPER", "GOAL KEEPER"].includes(normalized)) {
    return "goalkeeper";
  }
  if (
    [
      "ST",
      "CF",
      "LW",
      "RW",
      "LF",
      "RF",
      "FORWARD",
      "STRIKER",
      "WINGER",
      "LEFT WING",
      "RIGHT WING",
      "LEFT WINGER",
      "RIGHT WINGER",
    ].includes(normalized)
  ) {
    return "attack";
  }
  if (
    [
      "CM",
      "CAM",
      "CDM",
      "LM",
      "RM",
      "MIDFIELDER",
      "MIDFIELD",
      "ATTACKING MIDFIELDER",
      "DEFENSIVE MIDFIELDER",
      "CENTRAL MIDFIELDER",
    ].includes(normalized)
  ) {
    return "midfield";
  }
  if (
    [
      "CB",
      "LB",
      "RB",
      "LWB",
      "RWB",
      "DEFENDER",
      "DEFENSE",
      "CENTRE BACK",
      "CENTER BACK",
      "LEFT BACK",
      "RIGHT BACK",
    ].includes(normalized)
  ) {
    return "defense";
  }
  return "unknown";
}

function modelPosition(family) {
  return ({
    attack: "ATTACK",
    midfield: "MIDFIELD",
    defense: "DEFENSE",
    goalkeeper: "GOALKEEPER",
  })[family] || "UNKNOWN";
}

module.exports = {
  addOptionValue,
  addValue,
  avg,
  avgOptionValues,
  avgScore,
  buildContinuousWeekKeys,
  clampScore,
  gradeForScore,
  modelPosition,
  normalizeKey,
  optionMidpoint,
  ratingToScore,
  roleFamily,
  scoreOrZero,
  weekEndKey,
  weightedWeeklyScore,
};
