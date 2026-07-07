const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} = require("../../shared/errors");
const bcrypt = require("bcrypt");
const { createHmac, timingSafeEqual } = require("node:crypto");
const QRCode = require("qrcode");
const env = require("../../config/env");
const {
  MODEL_VERSION: RANKING_MODEL_VERSION,
  runRankingPredictions,
} = require("../ai/ranking-model");
const { invalidateAttendanceCache } = require("../../shared/attendance-cache");
const {
  normalizeAssignmentRole,
  permissionColumnsForRole,
} = require("../coaches/coach-assignment-roles");
const {
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
} = require("./ranking-inputs.helpers");
const { auditAccessDenied } = require("../../shared/access-audit");
const { canParentAccessChild } = require("../../shared/access-policy");
const { normalizePagination } = require("../../shared/pagination");
const PlayerAssignmentsService = require("./services/player-assignments.service");
const InjuryRiskService = require("./services/injury-risk.service");

const uniq = (values) => [...new Set((values || []).filter(Boolean))];
const addHours = (isoValue, hours) =>
  new Date(new Date(isoValue).getTime() + hours * 60 * 60 * 1000);
const pad2 = (value) => String(value).padStart(2, "0");
const DEFAULT_TIME_ZONE = process.env.APP_TIME_ZONE || "Africa/Cairo";
const datePart = (value) =>
  value instanceof Date
    ? `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
    : String(value).slice(0, 10);
const timePart = (value) =>
  value instanceof Date
    ? `${pad2(value.getHours())}:${pad2(value.getMinutes())}`
    : normalizeTime24(value);
const timePartInTimeZone = (
  value = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(value);
    const byType = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${pad2(byType.hour)}:${pad2(byType.minute)}`;
  } catch {
    return timePart(value);
  }
};
const timeZoneOffsetMs = (date, timeZone = DEFAULT_TIME_ZONE) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(date);
    const byType = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const asUtc = Date.UTC(
      Number(byType.year),
      Number(byType.month) - 1,
      Number(byType.day),
      Number(byType.hour),
      Number(byType.minute),
      Number(byType.second),
    );
    return asUtc - date.getTime();
  } catch {
    return -date.getTimezoneOffset() * 60 * 1000;
  }
};
// Date and time form fields are academy wall-clock values, not UTC values.
const combineDateTime = (date, time, timeZone = DEFAULT_TIME_ZONE) => {
  const dateText = datePart(date);
  const timeText = timePart(time);
  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = timeText.split(":").map(Number);
  const localAsUtc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0),
  );
  const firstPass = new Date(
    localAsUtc.getTime() - timeZoneOffsetMs(localAsUtc, timeZone),
  );
  const secondPass = new Date(
    localAsUtc.getTime() - timeZoneOffsetMs(firstPass, timeZone),
  );
  return secondPass.toISOString();
};
const matchKickoffAt = (match) =>
  new Date(combineDateTime(match.match_date, match.match_time));
const MATCH_AUTO_FINISH_HOURS = 3;
const MATCH_EVALUATION_REOPEN_HOURS = 24;
const matchAutoFinishAt = (match) => {
  const finishAt = matchKickoffAt(match);
  finishAt.setHours(finishAt.getHours() + MATCH_AUTO_FINISH_HOURS);
  return finishAt;
};
const matchNoShowDeleteAt = (match) => {
  return matchAutoFinishAt(match);
};
const ensureMatchKickoffIsFuture = (data) => {
  const kickOffAt = matchKickoffAt({
    match_date: data.matchDate,
    match_time: data.matchTime,
  });
  if (!Number.isFinite(kickOffAt.getTime())) {
    throw new BadRequestError("Choose a valid match date and time");
  }
  if (kickOffAt <= new Date()) {
    throw new BadRequestError("Match date and time must be in the future");
  }
};
const isGoalkeeperPosition = (position) => {
  const normalized = String(position || "")
    .trim()
    .toLowerCase();
  return normalized === "gk" || normalized.includes("goalkeeper");
};
const ATTENDANCE_QR_WINDOW_MINUTES = 15;
const DEFAULT_MATCH_DAY_UNLOCK_MINUTES = 5;
const academyMatchDayUnlockMinutes = (academySettings) => {
  const raw =
    academySettings?.matchDayOpenMinutesBeforeKickoff ??
    academySettings?.match_day_open_minutes_before_kickoff;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes)) return DEFAULT_MATCH_DAY_UNLOCK_MINUTES;
  return Math.max(0, Math.min(240, Math.round(minutes)));
};
const matchDayUnlockAt = (match, academySettings = null) => {
  const unlockAt = matchKickoffAt(match);
  unlockAt.setMinutes(
    unlockAt.getMinutes() - academyMatchDayUnlockMinutes(academySettings),
  );
  return unlockAt;
};
const trainingStartsAt = (event) => new Date(event.start_datetime);
const trainingEndsAt = (event) => new Date(event.end_datetime);
const addMinutes = (value, minutes) =>
  new Date(new Date(value).getTime() + minutes * 60 * 1000);
const normalizeTime24 = (time) => {
  if (!time) return "";
  if (time instanceof Date) {
    return `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
  }
  const raw = String(time).trim();
  const period = raw.match(/(AM|PM)\s*$/i)?.[1]?.toUpperCase();
  const clock = raw.replace(/\s*(?:AM|PM)+\s*$/i, "").trim();
  const match = clock.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.slice(0, 5);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return raw.slice(0, 5);
  }
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour < 12) hour += 12;
  return `${pad2(hour)}:${pad2(minute)}`;
};
const toTime = (time) => {
  const normalized = normalizeTime24(time);
  return normalized ? `${normalized}:00` : "";
};
const normalizeTargetType = (targetType) =>
  targetType === "specific_group" || targetType === "multiple_groups"
    ? "specific_groups"
    : targetType;
const eventStatusFromMatch = (status) =>
  ({
    scheduled: "scheduled",
    postponed: "postponed",
    cancelled: "cancelled",
    finished: "finished",
  })[status] || "scheduled";
const calendarEventStatusForDb = (status) =>
  status === "completed" ? "finished" : status;
const matchStatusFromCore = (status) =>
  ({
    scheduled: "scheduled",
    postponed: "postponed",
    cancelled: "cancelled",
    finished: "finished",
  })[status] || "scheduled";

const optionValue = (label, value) =>
  (value || label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QR_ATTENDANCE_TYPE = "goalix_player_attendance";
const QR_ATTENDANCE_VERSION = 1;
const playerCodePattern = /\bPLY-[A-Z0-9-]+\b/i;
const attendanceQrSecrets = () =>
  [env.QR_ATTENDANCE_SECRET, env.JWT_SECRET].filter(Boolean);
const attendanceQrSignatureWithSecret = (
  { academyId, playerId, playerCode },
  secret,
) =>
  createHmac("sha256", secret)
    .update(
      [
        QR_ATTENDANCE_TYPE,
        QR_ATTENDANCE_VERSION,
        academyId,
        playerId,
        playerCode || "",
      ].join(":"),
    )
    .digest("hex");
const attendanceQrSignature = (payload) =>
  attendanceQrSignatureWithSecret(payload, attendanceQrSecrets()[0]);
const safeSignatureEqual = (actual, expected) => {
  const actualBuffer = Buffer.from(String(actual || ""), "hex");
  const expectedBuffer = Buffer.from(String(expected || ""), "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    actualBuffer.length > 0 &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
};
const isValidAttendanceQrSignature = (actual, payload) =>
  attendanceQrSecrets().some((secret) =>
    safeSignatureEqual(
      actual,
      attendanceQrSignatureWithSecret(payload, secret),
    ),
  );

class CalendarService {
  constructor(
    calendarRepository,
    playersService = null,
    customDataService = null,
    redis = null,
  ) {
    this.repo = calendarRepository;
    this.playersService = playersService;
    this.customDataService = customDataService;
    this.redis = redis;
    this.playerAssignments = new PlayerAssignmentsService(calendarRepository, {
      getPlayer: (...args) => this._getPlayer(...args),
    });
    this.injuryRisk = new InjuryRiskService(calendarRepository, {
      getCoach: (...args) => this._getCoach(...args),
      ensureCoachHasPermission: (...args) =>
        this._ensureCoachHasPermission(...args),
      ensureCoachCanAccessPlayers: (...args) =>
        this._ensureCoachCanAccessPlayers(...args),
      playerCustomProfilesByPlayer: (...args) =>
        this._playerCustomProfilesByPlayer(...args),
    });
  }

  async _invalidateAttendanceCache(academyId) {
    await invalidateAttendanceCache(this.redis, academyId);
  }

  async _getCoach(userId, academyId) {
    const coach = await this.repo.findCoachByUserId(userId);
    if (!coach || coach.academy_id !== academyId)
      throw new NotFoundError("Coach profile");
    return coach;
  }

  _customFieldValue(row, optionLabels) {
    if (row.option_label) return row.option_label;
    if (
      typeof row.value_text === "string" &&
      optionLabels.has(row.value_text)
    ) {
      return optionLabels.get(row.value_text);
    }

    if (
      typeof row.value_json === "string" &&
      optionLabels.has(row.value_json)
    ) {
      return optionLabels.get(row.value_json);
    }
    if (typeof row.value_json === "string") {
      try {
        const parsed = JSON.parse(row.value_json);
        if (Array.isArray(parsed)) {
          const labels = parsed
            .map((value) => optionLabels.get(value) || value)
            .filter(Boolean);
          return labels.length ? labels.join(", ") : null;
        }
        if (typeof parsed === "string" && optionLabels.has(parsed)) {
          return optionLabels.get(parsed);
        }
      } catch {
        // Fall through to the raw value below.
      }
    }

    if (Array.isArray(row.value_json)) {
      const labels = row.value_json
        .map((value) => optionLabels.get(value) || value)
        .filter(Boolean);
      return labels.length ? labels.join(", ") : null;
    }
    return (
      row.value_text ??
      row.value_long_text ??
      row.value_number ??
      row.value_decimal ??
      row.value_date ??
      row.value_boolean ??
      row.value_json ??
      null
    );
  }

  async _playerCustomProfilesByPlayer(playerIds) {
    if (!playerIds.length) return new Map();

    const customValues = await this.repo
      .db("player_custom_values as pcv")
      .join("custom_fields as cf", "pcv.field_id", "cf.id")
      .leftJoin("custom_field_options as cfo", "pcv.value_option_id", "cfo.id")
      .whereIn("pcv.player_id", playerIds)
      .select(
        "pcv.player_id",
        "cf.label",
        "cf.key",
        "cf.field_type",
        "cfo.label as option_label",
        "pcv.value_text",
        "pcv.value_long_text",
        "pcv.value_number",
        "pcv.value_decimal",
        "pcv.value_date",
        "pcv.value_boolean",
        "pcv.value_option_id",
        "pcv.value_json",
      );

    const optionIds = new Set();
    customValues.forEach((row) => {
      if (row.value_option_id) optionIds.add(row.value_option_id);
      if (
        typeof row.value_text === "string" &&
        uuidPattern.test(row.value_text)
      ) {
        optionIds.add(row.value_text);
      }
      if (
        typeof row.value_json === "string" &&
        uuidPattern.test(row.value_json)
      ) {
        optionIds.add(row.value_json);
      }
      if (typeof row.value_json === "string") {
        try {
          const parsed = JSON.parse(row.value_json);
          if (Array.isArray(parsed)) {
            parsed
              .filter(
                (value) => typeof value === "string" && uuidPattern.test(value),
              )
              .forEach((value) => optionIds.add(value));
          } else if (typeof parsed === "string" && uuidPattern.test(parsed)) {
            optionIds.add(parsed);
          }
        } catch {
          // Ignore non-JSON strings.
        }
      }
      if (Array.isArray(row.value_json)) {
        row.value_json
          .filter(
            (value) => typeof value === "string" && uuidPattern.test(value),
          )
          .forEach((value) => optionIds.add(value));
      }
    });
    const optionRows = optionIds.size
      ? await this.repo
          .db("custom_field_options")
          .whereIn("id", [...optionIds])
          .select("id", "label")
      : [];
    const optionLabels = new Map(optionRows.map((row) => [row.id, row.label]));

    return customValues.reduce((map, row) => {
      const list = map.get(row.player_id) || [];
      list.push({
        label: row.label,
        key: row.key,
        fieldType: row.field_type,
        value: this._customFieldValue(row, optionLabels),
      });
      map.set(row.player_id, list);
      return map;
    }, new Map());
  }

  async _getPlayer(userId, academyId) {
    const player = await this.repo.findPlayerByUserId(userId);
    if (!player || player.academy_id !== academyId)
      throw new NotFoundError("Player profile");
    return player;
  }

  async _assertParentChild(parentUserId, childId, academyId) {
    const player = await this.repo.findParentChild(
      parentUserId,
      childId,
      academyId,
    );
    if (!player || !canParentAccessChild(parentUserId, player)) {
      await auditAccessDenied(
        this.repo.db,
        { userId: parentUserId, role: "parent", academyId },
        {
          action: "parent_child_access_denied",
          entityType: "player_profiles",
          entityId: childId,
          reason: "not_linked_child",
        },
      );
      throw new ForbiddenError("Parent can only access their linked child");
    }
    return player;
  }

  async _assertParentCanViewProgress(parentUserId, childId, academyId) {
    const player = await this._assertParentChild(
      parentUserId,
      childId,
      academyId,
    );
    if (!canParentAccessChild(parentUserId, player, "progress")) {
      await auditAccessDenied(
        this.repo.db,
        { userId: parentUserId, role: "parent", academyId },
        {
          action: "parent_progress_access_denied",
          entityType: "player_profiles",
          entityId: childId,
          reason: "progress_disabled",
        },
      );
      throw new ForbiddenError("Parent cannot access progress for this child");
    }
    return player;
  }

  async _assertParentCanMessageCoach(parentUserId, childId, academyId) {
    const player = await this._assertParentChild(
      parentUserId,
      childId,
      academyId,
    );
    if (!canParentAccessChild(parentUserId, player, "message_coach")) {
      await auditAccessDenied(
        this.repo.db,
        { userId: parentUserId, role: "parent", academyId },
        {
          action: "parent_message_coach_denied",
          entityType: "player_profiles",
          entityId: childId,
          reason: "message_coach_disabled",
        },
      );
      throw new ForbiddenError("Parent cannot contact coaches for this child");
    }
    return player;
  }

  async _validateAcademyGroups(groupIds, academyId) {
    const uniqueIds = uniq(groupIds);
    const groups = await this.repo.findGroupsByIds(uniqueIds, academyId);
    if (groups.length !== uniqueIds.length) {
      const found = new Set(groups.map((group) => group.id));
      const missing = uniqueIds.find((groupId) => !found.has(groupId));
      throw new NotFoundError("Group", missing);
    }
    return groups;
  }

  async _validateAcademyBirthYears(birthYearIds, academyId) {
    const uniqueIds = uniq(birthYearIds);
    const birthYears = await this.repo.findBirthYearsByIds(
      uniqueIds,
      academyId,
    );
    if (birthYears.length !== uniqueIds.length) {
      const found = new Set(birthYears.map((birthYear) => birthYear.id));
      const missing = uniqueIds.find((birthYearId) => !found.has(birthYearId));
      throw new NotFoundError("Birthday", missing);
    }
    return birthYears;
  }

  async _getCoachAssignments(coachId, academyId) {
    const assignments = await this.repo.findCoachAssignedGroups(
      coachId,
      academyId,
    );
    if (!assignments.length)
      throw new ForbiddenError("Coach has no assigned groups");
    return assignments;
  }

  async _getCoachVisibleGroupIds(coachId, academyId) {
    return this.repo.findCoachVisibleGroupIds(coachId, academyId);
  }

  async _resolveCoachTargetGroups(
    coach,
    academyId,
    { targetType, groupIds },
    permission = "can_create_training",
  ) {
    const assignments = await this._getCoachAssignments(coach.id, academyId);
    const eligible = assignments.filter(
      (assignment) => assignment[permission] === true,
    );
    if (!eligible.length)
      throw new ForbiddenError("Coach does not have this group permission");

    if (normalizeTargetType(targetType) === "all_my_assigned_groups") {
      return eligible.map((assignment) => assignment.group_id);
    }

    const selected = uniq(groupIds);
    const allowed = new Set(eligible.map((assignment) => assignment.group_id));
    const invalid = selected.find((groupId) => !allowed.has(groupId));
    if (invalid)
      throw new ForbiddenError(
        "Coach cannot access one or more selected groups",
      );
    if (!selected.length)
      throw new BadRequestError("At least one assigned group is required");
    return selected;
  }

  async _ensureCoachCanAccessGroups(
    coach,
    academyId,
    groupIds,
    permission = null,
  ) {
    const assignments = await this.repo.findCoachAssignedGroups(
      coach.id,
      academyId,
    );
    const allowed = new Set(
      assignments
        .filter((assignment) => !permission || assignment[permission] === true)
        .map((assignment) => assignment.group_id),
    );
    if (!permission) {
      const visibleGroupIds = await this._getCoachVisibleGroupIds(
        coach.id,
        academyId,
      );
      visibleGroupIds.forEach((groupId) => allowed.add(groupId));
    }
    const invalid = uniq(groupIds).find((groupId) => !allowed.has(groupId));
    if (invalid) throw new ForbiddenError("Coach cannot manage this group");
  }

  async _ensureCoachCanAccessBirthYears(
    coach,
    academyId,
    birthYearIds,
    permission = null,
  ) {
    const accessible = await this.repo.findCoachAccessibleBirthYears(
      coach.id,
      academyId,
      { permission },
    );
    const allowed = new Set(accessible.map((row) => row.id));
    const invalid = uniq(birthYearIds).find(
      (birthYearId) => !allowed.has(birthYearId),
    );
    if (invalid) throw new ForbiddenError("Coach cannot access this birthday");
  }

  async _ensureCoachHasPermission(coach, academyId, permission) {
    const [assignments, birthYears] = await Promise.all([
      this.repo.findCoachAssignedGroups(coach.id, academyId),
      this.repo.findCoachAccessibleBirthYears(coach.id, academyId, {
        permission,
      }),
    ]);
    if (
      !assignments.some((assignment) => assignment[permission] === true) &&
      !birthYears.length
    ) {
      throw new ForbiddenError(
        "Coach does not have this assignment permission",
      );
    }
  }

  async _ensureCoachCanAccessEvent(
    coach,
    academyId,
    eventId,
    permission = null,
  ) {
    const event = await this.repo.findEventById(eventId, academyId);
    if (!event) throw new NotFoundError("Calendar event", eventId);
    const groupIds = (event.groups || []).map((group) => group.id);
    const birthYearIds = (event.birth_years || []).map(
      (birthYear) => birthYear.id,
    );
    const playerIds = (event.players || []).map((player) => player.id);
    await this._ensureCoachCanAccessGroups(
      coach,
      academyId,
      groupIds,
      permission,
    );
    if (birthYearIds.length)
      await this._ensureCoachCanAccessBirthYears(
        coach,
        academyId,
        birthYearIds,
        permission,
      );
    if (playerIds.length)
      await this._ensureCoachCanAccessPlayers(coach, academyId, playerIds, {
        permission,
      });
    return { event, groupIds, birthYearIds, playerIds };
  }

  async _ensureCoachCanAccessMatch(
    coach,
    academyId,
    matchId,
    permission = null,
  ) {
    const match = await this.repo.findMatchById(matchId, academyId);
    if (!match) throw new NotFoundError("Match", matchId);
    const groupIds = await this.repo.getMatchGroupIds(matchId);
    const birthYearIds = await this.repo.getMatchBirthYearIds(matchId);
    if (!groupIds.length && !birthYearIds.length) {
      const linkedRequest = await this.repo
        .db("friendly_match_requests")
        .where({ converted_match_id: matchId, coach_id: coach.id })
        .first();
      const linkedAdminRequest = await this.repo
        .db("admin_match_coach_requests")
        .where({ created_match_id: matchId, coach_id: coach.id })
        .first();
      if (!linkedRequest && !linkedAdminRequest)
        throw new ForbiddenError("Coach cannot access this match");
      if (permission) {
        await this._ensureCoachHasPermission(coach, academyId, permission);
      }
    }
    if (groupIds.length)
      await this._ensureCoachCanAccessGroups(
        coach,
        academyId,
        groupIds,
        permission,
      );
    if (birthYearIds.length)
      await this._ensureCoachCanAccessBirthYears(
        coach,
        academyId,
        birthYearIds,
        permission,
      );
    return { match, groupIds, birthYearIds };
  }

  async _ensurePlayersInGroups(
    playerIds,
    groupIds,
    {
      requireComplete = false,
      customFieldId,
      customValue,
      customOptionId,
    } = {},
  ) {
    const players = await this.repo.findGroupPlayers(groupIds, {
      customFieldId,
      customValue,
      customOptionId,
    });
    const byId = new Map(players.map((player) => [player.id, player]));
    const invalid = uniq(playerIds).find((playerId) => !byId.has(playerId));
    if (invalid)
      throw new ForbiddenError("Player is outside the selected groups");
    if (requireComplete) {
      const incomplete = uniq(playerIds).find(
        (playerId) => byId.get(playerId)?.profile_status !== "complete",
      );
      if (incomplete)
        throw new BadRequestError(
          "Player profile must be complete before this operation",
        );
    }
    return players;
  }

  async _ensureCoachCanAccessPlayers(
    coach,
    academyId,
    playerIds,
    { requireComplete = false, permission = null } = {},
  ) {
    const players = await this.repo.findCoachScopedPlayersByIds(
      coach.id,
      academyId,
      uniq(playerIds),
      { onlyComplete: requireComplete, permission },
    );
    const byId = new Map(players.map((player) => [player.id, player]));
    const invalid = uniq(playerIds).find((playerId) => !byId.has(playerId));
    if (invalid)
      throw new ForbiddenError(
        "Player is outside your assigned groups or birth years",
      );
    if (requireComplete) {
      const incomplete = uniq(playerIds).find(
        (playerId) => byId.get(playerId)?.profile_status !== "complete",
      );
      if (incomplete)
        throw new BadRequestError(
          "Player profile must be complete before this operation",
        );
    }
    return players;
  }

  async _ensurePlayersInMatchTargets(
    playerIds,
    groupIds,
    birthYearIds,
    academyId,
    { requireComplete = false } = {},
  ) {
    const [groupPlayers, birthYearPlayers] = await Promise.all([
      this.repo.findGroupPlayers(groupIds, { onlyComplete: requireComplete }),
      this.repo.findPlayersForBirthYears(academyId, birthYearIds, {
        onlyComplete: requireComplete,
      }),
    ]);
    const byId = new Map(
      [...groupPlayers, ...birthYearPlayers].map((player) => [
        player.id,
        player,
      ]),
    );
    const invalid = uniq(playerIds).find((playerId) => !byId.has(playerId));
    if (invalid)
      throw new ForbiddenError("Player is outside the selected match target");
    if (requireComplete) {
      const incomplete = uniq(playerIds).find(
        (playerId) => byId.get(playerId)?.profile_status !== "complete",
      );
      if (incomplete)
        throw new BadRequestError(
          "Player profile must be complete before this operation",
        );
    }
    return [...byId.values()];
  }

  async _resolveCoachTrainingTargets(
    coach,
    academyId,
    data,
    permission = "can_create_training",
  ) {
    const targetAllGroups =
      data.allGroups ||
      normalizeTargetType(data.targetType) === "all_my_assigned_groups";
    const assignments = await this.repo.findCoachAssignedGroups(
      coach.id,
      academyId,
    );
    const eligibleAssignments = assignments.filter(
      (assignment) => assignment[permission] === true,
    );
    const groupIds = targetAllGroups
      ? eligibleAssignments.map((assignment) => assignment.group_id)
      : uniq(data.groupIds);
    if (groupIds.length) {
      const allowed = new Set(
        eligibleAssignments.map((assignment) => assignment.group_id),
      );
      const invalid = groupIds.find((groupId) => !allowed.has(groupId));
      if (invalid)
        throw new ForbiddenError(
          "Coach cannot access one or more selected groups",
        );
    }

    const accessibleBirthYears = await this.repo.findCoachAccessibleBirthYears(
      coach.id,
      academyId,
      { permission },
    );
    const birthYearIds = data.allBirthYears
      ? accessibleBirthYears.map((row) => row.id)
      : uniq(data.birthYearIds);
    if (birthYearIds.length) {
      const allowedBirthYears = new Set(
        accessibleBirthYears.map((row) => row.id),
      );
      const invalid = birthYearIds.find(
        (birthYearId) => !allowedBirthYears.has(birthYearId),
      );
      if (invalid)
        throw new ForbiddenError("Coach cannot access this birthday");
    }

    let playerIds = uniq(data.playerIds);
    if (data.allPlayers) {
      playerIds = (
        await this.repo.findCoachScopedPlayers(coach.id, academyId, {
          onlyComplete: true,
        })
      ).map((player) => player.id);
    } else if (playerIds.length) {
      await this._ensureCoachCanAccessPlayers(coach, academyId, playerIds, {
        requireComplete: true,
      });
    }

    if (!groupIds.length && !birthYearIds.length && !playerIds.length) {
      throw new BadRequestError(
        "Select at least one group, birthday, or player",
      );
    }
    return { groupIds, birthYearIds, playerIds };
  }

  async _ensurePlayersInEventTargets(
    playerIds,
    { groupIds = [], birthYearIds = [], directPlayerIds = [] },
    academyId,
    { requireComplete = false } = {},
  ) {
    const uniquePlayerIds = uniq(playerIds);
    const [groupPlayers, birthYearPlayers, directPlayers] = await Promise.all([
      this.repo.findGroupPlayers(groupIds, { onlyComplete: requireComplete }),
      this.repo.findPlayersForBirthYears(academyId, birthYearIds, {
        onlyComplete: requireComplete,
      }),
      directPlayerIds.length
        ? this.repo
            .db("player_profiles")
            .whereIn("id", directPlayerIds)
            .where("academy_id", academyId)
            .whereNull("deleted_at")
            .modify((q) => {
              if (requireComplete) q.where("profile_status", "complete");
            })
        : [],
    ]);
    const byId = new Map(
      [...groupPlayers, ...birthYearPlayers, ...directPlayers].map((player) => [
        player.id,
        player,
      ]),
    );
    const invalid = uniquePlayerIds.find((playerId) => !byId.has(playerId));
    if (invalid)
      throw new ForbiddenError(
        "Player is outside the selected training target",
      );
    if (requireComplete) {
      const incomplete = uniquePlayerIds.find(
        (playerId) => byId.get(playerId)?.profile_status !== "complete",
      );
      if (incomplete)
        throw new BadRequestError(
          "Player profile must be complete before this operation",
        );
    }
    return [...byId.values()];
  }

  async _notifyTrainingTargets(
    academyId,
    { groupIds = [], birthYearIds = [], playerIds = [] },
    title,
    body,
    data,
    trx = this.repo.db,
    type = "training",
  ) {
    const userIds = [];
    if (groupIds.length) {
      const users = await this.repo.usersForGroups(groupIds);
      userIds.push(
        ...users.coaches.map((row) => row.user_id),
        ...users.players.map((row) => row.user_id),
        ...users.parents.map((row) => row.user_id),
      );
    }
    if (birthYearIds.length) {
      const users = await this.repo.usersForBirthYears(academyId, birthYearIds);
      userIds.push(
        ...users.coaches.map((row) => row.user_id),
        ...users.players.map((row) => row.user_id),
        ...users.parents.map((row) => row.user_id),
      );
    }
    if (playerIds.length) {
      const players = await trx("player_profiles")
        .whereIn("id", playerIds)
        .whereNotNull("user_id")
        .select("user_id");
      const parents = await this.repo.parentUsersForPlayers(playerIds, trx);
      userIds.push(
        ...players.map((row) => row.user_id),
        ...parents.map((row) => row.user_id),
      );
    }
    return this._notifyUsers(userIds, title, body, type, data, trx);
  }

  _notificationRows(userIds, title, body, type, data = {}) {
    return uniq(userIds).map((userId) => ({
      user_id: userId,
      type,
      title,
      body,
      data,
      is_read: false,
    }));
  }

  async _notifyUsers(
    userIds,
    title,
    body,
    type,
    data = {},
    trx = this.repo.db,
  ) {
    return this.repo.createNotifications(
      this._notificationRows(userIds, title, body, type, data),
      trx,
    );
  }

  async _notifyAdmins(
    academyId,
    title,
    body,
    type,
    data = {},
    trx = this.repo.db,
  ) {
    const admins = await this.repo.adminUsers(academyId);
    return this._notifyUsers(
      admins.map((admin) => admin.user_id),
      title,
      body,
      type,
      data,
      trx,
    );
  }

  async _notifyCoachWeeklyRankingReady(coach, rows) {
    if (!coach?.user_id || !rows?.length) return;

    const { rows: currentWeekRows } = await this.repo.db.raw(
      "SELECT date_trunc('week', now())::date::text AS week_start",
    );
    const currentWeekStart = currentWeekRows[0]?.week_start || null;
    const completedRows = rows.filter((row) => {
      const weekStart = String(row.week_start || "").slice(0, 10);
      const isCarryForward = Boolean(
        row.carry_forward || row.final_api_response?.carry_forward,
      );
      return (
        weekStart &&
        !isCarryForward &&
        (!currentWeekStart || weekStart < currentWeekStart)
      );
    });

    const latestWeekStart = completedRows[0]?.week_start;
    if (!latestWeekStart) return;

    const latestRows = completedRows.filter(
      (row) =>
        String(row.week_start).slice(0, 10) ===
        String(latestWeekStart).slice(0, 10),
    );
    if (!latestRows.length) return;

    const topPlayer = latestRows
      .slice()
      .sort(
        (a, b) =>
          Number(a.rank || Number.POSITIVE_INFINITY) -
          Number(b.rank || Number.POSITIVE_INFINITY),
      )[0];

    const existing = await this.repo
      .db("notification_inbox")
      .where({ user_id: coach.user_id, type: "ranking" })
      .whereRaw("data->>'source' = ?", ["ranking_system_weekly"])
      .whereRaw("data->>'coachId' = ?", [String(coach.id)])
      .whereRaw("data->>'weekStart' = ?", [String(latestWeekStart)])
      .first("id");

    if (existing) return;

    await this._notifyUsers(
      [coach.user_id],
      "Weekly rankings are ready",
      topPlayer?.player_name
        ? `New Ranking System output is available. Overall #1: ${topPlayer.player_name}.`
        : "New Ranking System output is available.",
      "ranking",
      {
        source: "ranking_system_weekly",
        coachId: coach.id,
        weekStart: latestWeekStart,
        weekEnd: topPlayer?.week_end || latestRows[0]?.week_end || null,
        topPlayerId: topPlayer?.player_id || null,
        topPlayerName: topPlayer?.player_name || null,
        modelVersion: RANKING_MODEL_VERSION,
        href: "/coach/rankings",
      },
    );
  }

  _evaluationEditWindow(row) {
    if (
      !row ||
      row.status !== "approved" ||
      row.consumed_at ||
      !row.expires_at
    ) {
      return { active: false };
    }
    return { active: new Date(row.expires_at) > new Date() };
  }

  async _decorateMatchEvaluationAccess(match, coachId) {
    if (!match?.id || !coachId) return match;
    const request = await this.repo.latestEvaluationEditRequest(
      match.id,
      coachId,
    );
    const window = this._evaluationEditWindow(request);
    return {
      ...match,
      evaluation_edit_request: request || null,
      evaluation_edit_unlocked_until: window.active ? request.expires_at : null,
    };
  }

  async _activeEvaluationEditRequest(matchId, coachId, trx = this.repo.db) {
    return this.repo.activeEvaluationEditRequest(matchId, coachId, trx);
  }

  async _notifyGroups(
    groupIds,
    title,
    body,
    type,
    data = {},
    trx = this.repo.db,
    includePlayers = false,
  ) {
    const users = await this.repo.usersForGroups(groupIds);
    const ids = [
      ...users.coaches.map((row) => row.user_id),
      ...(includePlayers ? users.players.map((row) => row.user_id) : []),
      ...(includePlayers ? users.parents.map((row) => row.user_id) : []),
    ];
    return this._notifyUsers(ids, title, body, type, data, trx);
  }

  async _matchSquadRecipients(matchId) {
    const [players, squadPlayersForParents, squadCoachIds, tacticCoachIds] =
      await Promise.all([
        this.repo
          .db("match_squads as ms")
          .join("player_profiles as pp", "ms.player_id", "pp.id")
          .where("ms.match_id", matchId)
          .whereNotNull("pp.user_id")
          .select("pp.user_id", "pp.id as player_id"),
        this.repo
          .db("match_squads")
          .where("match_id", matchId)
          .distinct("player_id"),
        this.repo
          .db("match_squads")
          .where("match_id", matchId)
          .whereNotNull("selected_by_coach_id")
          .distinct("selected_by_coach_id as coach_id"),
        this.repo
          .db("match_tactics")
          .where("match_id", matchId)
          .whereNotNull("coach_id")
          .distinct("coach_id"),
      ]);
    const coachIds = uniq([
      ...squadCoachIds.map((row) => row.coach_id),
      ...tacticCoachIds.map((row) => row.coach_id),
    ]);
    const coaches = coachIds.length
      ? await this.repo
          .db("coach_profiles")
          .whereIn("id", coachIds)
          .whereNotNull("user_id")
          .select("user_id")
      : [];
    const parentUsers = await this.repo.parentUsersForPlayers(
      squadPlayersForParents.map((row) => row.player_id),
    );
    return { players, parents: parentUsers, coaches };
  }

  _matchPlanPayload(match) {
    return {
      match: {
        id: match.id,
        opponentName: match.opponent_name,
        matchType: match.match_type,
        matchDate: datePart(match.match_date),
        matchTime: timePart(match.match_time),
        location: match.location,
        venueType: match.venue_type,
        status: match.status,
        matchStatus: match.match_status,
      },
      tactics: match.tactics
        ? {
            formation: match.tactics.formation,
            tacticalNotes: match.tactics.tactical_notes,
            coachName: match.tactics.coach_name,
          }
        : null,
      squad: (match.squad || []).map((player) => ({
        playerId: player.player_id,
        playerName: player.player_name,
        role: player.squad_role,
        position: player.position,
        instruction: player.player_instruction,
      })),
    };
  }

  async _notifyMatchPlan(
    academyId,
    matchId,
    { updated = false } = {},
    trx = this.repo.db,
  ) {
    const match = await this.repo.findMatchById(matchId, academyId);
    if (!match) return;
    if (!match.tactics || !match.squad?.length) return;
    const data = this._matchPlanPayload(match);
    const title = updated
      ? "Match configuration updated"
      : "Match configuration saved";
    const body = `${match.opponent_name} - ${data.tactics?.formation || "No formation"} on ${datePart(match.match_date)}`;
    await this._notifyAdmins(academyId, title, body, "match", data, trx);

    const recipients = await this._matchSquadRecipients(matchId);
    await this._notifyUsers(
      [...recipients.players, ...recipients.parents, ...recipients.coaches].map(
        (row) => row.user_id,
      ),
      title,
      body,
      "match",
      data,
      trx,
    );
  }

  async _notifyMatchDayOpen(academyId, matchId, trx = this.repo.db) {
    const match = await this.repo.findMatchById(matchId, academyId);
    if (!match || !match.tactics || !match.squad?.length) return;
    const data = {
      ...this._matchPlanPayload(match),
      matchDayUrl: `/coach/matches/match-day/${match.id}`,
    };
    const title = "Match starts soon";
    const body = `${match.opponent_name} starts at ${timePart(match.match_time)}. Match Day Operations are open.`;
    await this._notifyAdmins(academyId, title, body, "match", data, trx);
    const recipients = await this._matchSquadRecipients(matchId);
    await this._notifyUsers(
      [...recipients.players, ...recipients.parents, ...recipients.coaches].map(
        (row) => row.user_id,
      ),
      title,
      body,
      "match",
      data,
      trx,
    );
  }

  async _notifyMatchQrReminderIfDue(academyId, match, trx = this.repo.db) {
    if (!match || !["scheduled", "postponed"].includes(match.status))
      return false;
    if (match.match_status && match.match_status !== "scheduled") return false;
    const kickOffAt = matchKickoffAt(match);
    const now = new Date();
    const reminderStart = addMinutes(kickOffAt, -ATTENDANCE_QR_WINDOW_MINUTES);
    if (now < reminderStart || now >= kickOffAt) return false;

    const existing = await trx("notification_inbox")
      .where("type", "match")
      .whereRaw("data->>'source' = ?", ["attendance_qr_match_reminder"])
      .whereRaw("data->>'matchId' = ?", [String(match.id)])
      .first("id");
    if (existing) return false;

    const recipients = await this._matchSquadRecipients(match.id);
    const userIds = [
      ...recipients.players.map((row) => row.user_id),
      ...recipients.parents.map((row) => row.user_id),
    ];
    if (!userIds.length) return false;

    await this._notifyUsers(
      userIds,
      "Match attendance QR is ready",
      `${match.opponent_name} starts in about ${ATTENDANCE_QR_WINDOW_MINUTES} minutes. Open your matches page for fast QR attendance.`,
      "match",
      {
        source: "attendance_qr_match_reminder",
        matchId: match.id,
        opponentName: match.opponent_name,
        startsAt: kickOffAt.toISOString(),
      },
      trx,
    );
    return true;
  }

  async _trainingReminderRecipients(event, academyId) {
    const participants = await this._trainingParticipants(event, academyId);
    const playerRows = participants
      .filter((player) => player.user_id)
      .map((player) => ({ user_id: player.user_id, player_id: player.id }));
    const parents = participants.length
      ? await this.repo.parentUsersForPlayers(
          participants.map((player) => player.id),
        )
      : [];
    return { players: playerRows, parents };
  }

  async _notifyTrainingQrReminderIfDue(academyId, event, trx = this.repo.db) {
    if (
      !event ||
      event.event_type !== "training" ||
      event.status !== "scheduled"
    ) {
      return false;
    }
    const startsAt = trainingStartsAt(event);
    const now = new Date();
    const reminderStart = addMinutes(startsAt, -ATTENDANCE_QR_WINDOW_MINUTES);
    if (now < reminderStart || now >= startsAt) return false;

    const existing = await trx("notification_inbox")
      .where("type", "training")
      .whereRaw("data->>'source' = ?", ["attendance_qr_training_reminder"])
      .whereRaw("data->>'eventId' = ?", [String(event.id)])
      .first("id");
    if (existing) return false;

    const recipients = await this._trainingReminderRecipients(event, academyId);
    const userIds = [
      ...recipients.players.map((row) => row.user_id),
      ...recipients.parents.map((row) => row.user_id),
    ];
    if (!userIds.length) return false;

    await this._notifyUsers(
      userIds,
      "Training attendance QR is ready",
      `${event.title} starts in about ${ATTENDANCE_QR_WINDOW_MINUTES} minutes. Open your training page for fast QR attendance.`,
      "training",
      {
        source: "attendance_qr_training_reminder",
        eventId: event.id,
        eventTitle: event.title,
        startsAt: startsAt.toISOString(),
      },
      trx,
    );
    return true;
  }

  async _notifyPlayerAttendanceCheckedIn(
    player,
    title,
    body,
    type,
    data = {},
    trx = this.repo.db,
  ) {
    const parents = await this.repo.parentUsersForPlayers([player.id], trx);
    const userIds = [
      player.user_id,
      ...parents.map((row) => row.user_id),
    ].filter(Boolean);
    if (!userIds.length) return [];
    return this._notifyUsers(
      userIds,
      title,
      body,
      type,
      {
        source: "attendance_qr_checked_in",
        playerName: player.full_name,
        ...data,
      },
      trx,
    );
  }

  _matchDayWindowOpen(match) {
    return matchDayUnlockAt(match, match.academy_settings) <= new Date();
  }

  _ensureMatchCanBeConfigured(match) {
    if (["cancelled", "finished", "completed"].includes(match.status)) {
      throw new BadRequestError("This match is closed for configuration");
    }
    if (["finished", "completed"].includes(match.match_status)) {
      throw new BadRequestError("This match is closed for configuration");
    }
  }

  async _playerMatchAccessContext(player) {
    const [groupRows, birthYearRows] = await Promise.all([
      this.repo.findPlayerGroups(player.id),
      this.repo.findBirthYearsForPlayer(player),
    ]);

    return {
      playerId: player.id,
      groupIds: groupRows.map((row) => row.group_id),
      birthYearIds: birthYearRows.map((row) => row.id),
    };
  }

  _configuredMatchQueryForPlayer(academyId, filters, context) {
    const { playerId, groupIds, birthYearIds } = context;
    if (!playerId && !groupIds.length && !birthYearIds.length) return null;

    const query = this.repo
      .matchListQuery(academyId, {
        ...filters,
        ...(!playerId
          ? {
              groupIds,
              birthYearIds,
            }
          : {}),
      })
      .whereExists(function configuredMatch() {
        this.select(1)
          .from("match_tactics as mt")
          .whereRaw("mt.match_id = m.id");
      });

    if (!playerId) return query;

    return query.andWhere((scope) => {
      if (groupIds.length) {
        scope
          .orWhereIn("ceg.group_id", groupIds)
          .orWhereIn("m.team_id", groupIds)
          .orWhereIn("m.age_group_id", groupIds);
      }
      if (birthYearIds.length) {
        scope.orWhereIn("ceby.birth_year_id", birthYearIds);
      }
      scope.orWhereExists(function playerInSquad() {
        this.select(1)
          .from("match_squads as ms_visible")
          .whereRaw("ms_visible.match_id = m.id")
          .where("ms_visible.player_id", playerId);
      });
    });
  }

  async _playerVisibleMatchQuery(player, academyId, filters = {}) {
    const context = await this._playerMatchAccessContext(player);
    return {
      query: this._configuredMatchQueryForPlayer(academyId, filters, context),
    };
  }

  _ensureMatchDayReady(match) {
    if (!match.tactics || !match.squad?.length) {
      throw new BadRequestError(
        "Save match tactics and squad before match-day operations",
      );
    }
    if (!this._matchDayWindowOpen(match)) {
      const minutes = academyMatchDayUnlockMinutes(match.academy_settings);
      throw new ForbiddenError(
        `Match Day Operations open ${minutes} minutes before kick-off`,
      );
    }
  }

  _ensureMatchHasStarted(match) {
    if (!["first_half", "second_half"].includes(match.match_status)) {
      throw new BadRequestError(
        "Start the match before recording match events",
      );
    }
  }

  _matchIsLive(match) {
    return ["first_half", "second_half"].includes(match.match_status);
  }

  _ensureMatchAttendanceEditable(match) {
    if (match.match_status !== "scheduled") {
      throw new BadRequestError(
        "Match attendance can only be marked before the match starts",
      );
    }
  }

  _isPreKickoffAbsenceSubstitution(
    match,
    outPlayer,
    inPlayer,
    attendanceByPlayer,
  ) {
    const outAttendance = attendanceByPlayer.get(outPlayer?.player_id);
    return (
      match.match_status === "scheduled" &&
      outPlayer?.squad_role === "starter" &&
      inPlayer?.squad_role !== "starter" &&
      outAttendance?.status === "absent"
    );
  }

  _currentPlayingPlayerIds(match) {
    const yellowCounts = new Map();
    (match.incidents || [])
      .filter((incident) => incident.incident_type === "yellow_card")
      .forEach((incident) => {
        yellowCounts.set(
          incident.player_id,
          (yellowCounts.get(incident.player_id) || 0) + 1,
        );
      });
    const stoppedByIncident = new Set(
      (match.incidents || [])
        .filter((incident) => incident.incident_type === "red_card")
        .map((incident) => incident.player_id),
    );
    yellowCounts.forEach((count, playerId) => {
      if (count >= 2) stoppedByIncident.add(playerId);
    });
    const current = new Set(
      (match.squad || [])
        .filter(
          (player) =>
            player.squad_role === "starter" &&
            !stoppedByIncident.has(player.player_id),
        )
        .map((player) => player.player_id),
    );
    (match.substitutions || []).forEach((substitution) => {
      current.delete(substitution.out_player_id);
      if (!stoppedByIncident.has(substitution.in_player_id)) {
        current.add(substitution.in_player_id);
      }
    });
    return current;
  }

  _matchMinuteLimit(match) {
    return (
      90 +
      Number(match.first_half_stoppage_minutes || 0) +
      Number(match.second_half_stoppage_minutes || 0)
    );
  }

  _matchElapsedMinute(match, now = new Date()) {
    const firstHalfLimit = 45 + Number(match.first_half_stoppage_minutes || 0);
    const secondHalfLimit =
      45 + Number(match.second_half_stoppage_minutes || 0);
    if (match.match_status === "finished") {
      return firstHalfLimit + secondHalfLimit;
    }
    if (match.match_status === "first_half") {
      const startedAt = match.first_half_started_at || match.started_at;
      if (!startedAt) return 0;
      return Math.min(
        firstHalfLimit,
        Math.max(0, Math.floor((now - new Date(startedAt)) / 60000)),
      );
    }
    if (match.match_status === "second_half") {
      if (!match.second_half_started_at) return firstHalfLimit;
      return (
        firstHalfLimit +
        Math.min(
          secondHalfLimit,
          Math.max(
            0,
            Math.floor((now - new Date(match.second_half_started_at)) / 60000),
          ),
        )
      );
    }
    return 0;
  }

  _calculateMatchMinutes(match, now = new Date()) {
    const endMinute = this._matchElapsedMinute(match, now);
    const maxMinute = this._matchMinuteLimit(match);
    const attendanceByPlayer = new Map(
      (match.attendance || []).map((record) => [record.player_id, record]),
    );
    const playerState = new Map(
      (match.squad || []).map((player) => {
        const attendance = attendanceByPlayer.get(player.player_id);
        const unavailable = ["absent", "injured"].includes(
          attendance?.status || "",
        );
        const starts = player.squad_role === "starter" && !unavailable;
        return [
          player.player_id,
          {
            playerId: player.player_id,
            activeSince: starts ? 0 : null,
            minutes: 0,
            stopped: unavailable,
          },
        ];
      }),
    );

    const stopPlayer = (playerId, minute) => {
      const state = playerState.get(playerId);
      if (!state || state.activeSince === null) return;
      const safeMinute = Math.min(Math.max(Number(minute || 0), 0), endMinute);
      state.minutes += Math.max(0, safeMinute - state.activeSince);
      state.activeSince = null;
    };
    const startPlayer = (playerId, minute) => {
      const state = playerState.get(playerId);
      if (!state || state.stopped || state.activeSince !== null) return;
      const safeMinute = Math.min(Math.max(Number(minute || 0), 0), endMinute);
      state.activeSince = safeMinute;
    };
    const stateYellowCounts = new Map();

    const events = [
      ...(match.substitutions || []).map((substitution) => ({
        type: "substitution",
        minute: Number(substitution.minute || 0),
        substitution,
      })),
      ...(match.incidents || []).map((incident) => ({
        type: "incident",
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
        const previousYellows =
          stateYellowCounts.get(event.incident.player_id) || 0;
        stateYellowCounts.set(event.incident.player_id, previousYellows + 1);
        if (previousYellows + 1 >= 2) {
          stopPlayer(event.incident.player_id, event.minute);
          const state = playerState.get(event.incident.player_id);
          if (state) state.stopped = true;
        }
        return;
      }
      if (event.incident.incident_type !== "red_card") {
        return;
      }
      stopPlayer(event.incident.player_id, event.minute);
      const state = playerState.get(event.incident.player_id);
      if (state) state.stopped = true;
    });

    playerState.forEach((state) => {
      if (state.activeSince !== null) {
        state.minutes += Math.max(0, endMinute - state.activeSince);
      }
      state.minutes = Math.min(
        Math.max(Math.round(state.minutes), 0),
        maxMinute,
      );
    });

    return [...playerState.values()].map((state) => ({
      playerId: state.playerId,
      minutesPlayed: state.minutes,
    }));
  }

  async _syncMatchMinutes(matchId, academyId, coachId, trx = this.repo.db) {
    const match = await this.repo.findMatchById(matchId, academyId);
    if (!match?.squad?.length) return [];
    const minutes = this._calculateMatchMinutes(match);
    if (!minutes.length) return [];

    await trx("match_player_stats")
      .insert(
        minutes.map((record) => ({
          match_id: matchId,
          player_id: record.playerId,
          minutes_played: record.minutesPlayed,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          created_by_coach_id: coachId || null,
        })),
      )
      .onConflict(["match_id", "player_id"])
      .merge({
        minutes_played: this.repo.db.raw("excluded.minutes_played"),
        updated_at: new Date(),
      });

    return minutes;
  }

  _ensureMatchCanStart(match) {
    if (matchKickoffAt(match) > new Date()) {
      throw new BadRequestError("Match can only start at kick-off time");
    }

    const squad = match.squad || [];
    const attendanceByPlayer = new Map(
      (match.attendance || []).map((record) => [record.player_id, record]),
    );
    const unmarked = squad.find(
      (player) => !attendanceByPlayer.has(player.player_id),
    );
    if (unmarked) {
      throw new BadRequestError(
        "Mark attendance for every squad player before starting the match",
      );
    }

    const currentPlaying = this._currentPlayingPlayerIds(match);
    const unavailableCurrentPlayer = squad.find((player) => {
      const attendance = attendanceByPlayer.get(player.player_id);
      return (
        currentPlaying.has(player.player_id) &&
        ["absent", "injured"].includes(attendance?.status)
      );
    });
    if (unavailableCurrentPlayer) {
      throw new BadRequestError(
        "Replace absent or injured players with available substitutes before starting the match",
      );
    }
  }

  _ensureTrainingEventOpen(event) {
    if (event.status === "cancelled")
      throw new BadRequestError("Cancelled events cannot be changed");
    if (
      event.status === "completed" ||
      event.status === "finished" ||
      trainingEndsAt(event) <= new Date()
    )
      throw new BadRequestError("Training session is closed");
    if (trainingStartsAt(event) > new Date())
      throw new BadRequestError("Training session has not started yet");
  }

  _ensureTrainingEventCanReceiveAttendance(event, records = []) {
    if (event.status === "cancelled")
      throw new BadRequestError("Cancelled events cannot be changed");
    if (event.status === "postponed")
      throw new BadRequestError("Postponed events cannot be changed");
    if (trainingStartsAt(event) > new Date())
      throw new BadRequestError("Training session has not started yet");

    const closed =
      event.status === "completed" ||
      event.status === "finished" ||
      trainingEndsAt(event) <= new Date();
    if (!closed) return;

    const missingManualTime = records.find(
      (record) =>
        ["present", "late"].includes(record.status) && !record.arrivalTime,
    );
    if (missingManualTime) {
      throw new BadRequestError(
        "Manual arrival time is required after training is closed",
      );
    }
  }

  _ensureTrainingEventCanReceiveEvaluation(event) {
    if (event.status === "cancelled")
      throw new BadRequestError("Cancelled events cannot be evaluated");
    if (event.status === "postponed")
      throw new BadRequestError("Postponed events cannot be evaluated");
    if (trainingStartsAt(event) > new Date())
      throw new BadRequestError("Training session has not started yet");
  }

  async _refreshInjuryRiskMonthlyAttendance(
    academyId,
    playerIds,
    occurredAt,
    trx = this.repo.db,
  ) {
    const uniquePlayerIds = uniq(playerIds);
    if (!uniquePlayerIds.length || !occurredAt) return;
    const monthStart = `${datePart(occurredAt).slice(0, 7)}-01`;
    const playerArraySql = uniquePlayerIds.map(() => "?::uuid").join(", ");
    await trx.raw(
      `SELECT refresh_injury_risk_monthly_attendance(?::uuid, ARRAY[${playerArraySql}]::uuid[], ?::date)`,
      [academyId, ...uniquePlayerIds, monthStart],
    );
  }

  _matchAttendanceOccurredAt(match) {
    if (!match) return null;
    if (match.finished_at) return match.finished_at;
    if (!match.match_date || !match.match_time) return match.match_date || null;
    return combineDateTime(
      datePart(match.match_date),
      timePart(match.match_time),
    );
  }

  async _matchAffectedPlayerIds(matchId, trx = this.repo.db) {
    const [squadRows, attendanceRows] = await Promise.all([
      trx("match_squads").where({ match_id: matchId }).select("player_id"),
      trx("match_attendance").where({ match_id: matchId }).select("player_id"),
    ]);
    return uniq([
      ...squadRows.map((row) => row.player_id),
      ...attendanceRows.map((row) => row.player_id),
    ]);
  }

  async _refreshMatchInjuryRiskMonthlyAttendance(
    academyId,
    match,
    trx = this.repo.db,
    { playerIds, occurredAts = [] } = {},
  ) {
    const affectedPlayerIds =
      playerIds || (await this._matchAffectedPlayerIds(match.id, trx));
    if (!affectedPlayerIds.length) return;
    const uniqueMonthDates = uniq(
      [this._matchAttendanceOccurredAt(match), ...occurredAts]
        .filter(Boolean)
        .map((occurredAt) => datePart(occurredAt)),
    );
    for (const occurredAt of uniqueMonthDates) {
      await this._refreshInjuryRiskMonthlyAttendance(
        academyId,
        affectedPlayerIds,
        occurredAt,
        trx,
      );
    }
  }

  async _incrementPlayerGoalStat(
    trx,
    matchId,
    playerId,
    coachId,
    field,
    delta,
  ) {
    const insertValue = Math.max(delta, 0);
    const patch =
      delta > 0
        ? {
            [field]: this.repo.db.raw(
              `COALESCE(match_player_stats.${field}, 0) + ?`,
              [delta],
            ),
          }
        : {
            [field]: this.repo.db.raw(
              `GREATEST(COALESCE(match_player_stats.${field}, 0) + ?, 0)`,
              [delta],
            ),
          };
    await trx("match_player_stats")
      .insert({
        match_id: matchId,
        player_id: playerId,
        minutes_played: 0,
        goals: field === "goals" ? insertValue : 0,
        assists: field === "assists" ? insertValue : 0,
        yellow_cards: 0,
        red_cards: 0,
        created_by_coach_id: coachId,
      })
      .onConflict(["match_id", "player_id"])
      .merge({ ...patch, updated_at: new Date() });
  }

  async _notifyMatchDayIfDue(academyId, matches) {
    const notified = new Map();
    const dueMatches = (matches || []).filter((match) => {
      if (
        !["scheduled", "postponed"].includes(match.status) ||
        match.match_status !== "scheduled"
      )
        return false;
      const notifiedAt = match.match_day_notified_at
        ? new Date(match.match_day_notified_at)
        : null;
      if (
        notifiedAt &&
        notifiedAt >= matchDayUnlockAt(match, match.academy_settings)
      )
        return false;
      return this._matchDayWindowOpen(match);
    });
    for (const match of dueMatches) {
      const fullMatch = await this.repo.findMatchById(match.id, academyId);
      if (!fullMatch?.tactics || !fullMatch.squad?.length) continue;
      await this.repo.db.transaction(async (trx) => {
        const notifiedAt = new Date();
        const updated = await trx("matches")
          .where({ id: match.id })
          .where((query) => {
            query
              .whereNull("match_day_notified_at")
              .orWhere(
                "match_day_notified_at",
                "<",
                matchDayUnlockAt(match, match.academy_settings),
              );
          })
          .update({
            match_day_notified_at: notifiedAt,
            updated_at: notifiedAt,
          });
        if (!updated) return;
        notified.set(match.id, notifiedAt);
        await this._notifyMatchDayOpen(academyId, match.id, trx);
      });
    }
    return notified;
  }

  async _deleteNoShowMatches(academyId, matches, trx) {
    const matchIds = matches.map((match) => match.id).filter(Boolean);
    if (!matchIds.length) return;

    const affectedPlayersByMatch = new Map();
    for (const match of matches) {
      affectedPlayersByMatch.set(
        match.id,
        await this._matchAffectedPlayerIds(match.id, trx),
      );
    }

    for (const matchId of matchIds) {
      await this._deleteMatchLinkedRequests(trx, matchId);
    }

    await trx("notification_inbox")
      .where("type", "match")
      .andWhere((query) => {
        query
          .whereIn(trx.raw("data->>'matchId'"), matchIds)
          .orWhereIn(trx.raw("data->'match'->>'id'"), matchIds);
      })
      .del();

    const eventIds = matches.map((match) => match.event_id).filter(Boolean);
    if (eventIds.length) {
      await trx("calendar_events").whereIn("id", eventIds).del();
    }

    const matchesWithoutEvents = matches
      .filter((match) => !match.event_id)
      .map((match) => match.id);
    if (matchesWithoutEvents.length) {
      await trx("matches").whereIn("id", matchesWithoutEvents).del();
    }

    for (const match of matches) {
      await this._refreshMatchInjuryRiskMonthlyAttendance(
        academyId,
        match,
        trx,
        { playerIds: affectedPlayersByMatch.get(match.id) || [] },
      );
    }
  }

  async _finalizeOverdueMatches(academyId, { matchId } = {}) {
    const candidates = await this.repo.findAutoFinishMatchCandidates(
      academyId,
      { matchId },
    );
    const now = new Date();
    const dueMatches = candidates.filter(
      (match) =>
        matchNoShowDeleteAt(match) <= now || matchAutoFinishAt(match) <= now,
    );
    if (!dueMatches.length) return new Set();

    const noShowMatches = dueMatches.filter((match) => {
      const squadCount = Number(match.squad_count || 0);
      const attendanceCount = Number(match.attendance_count || 0);
      return (
        match.match_status === "scheduled" &&
        !match.started_at &&
        (squadCount === 0 || attendanceCount < squadCount) &&
        matchNoShowDeleteAt(match) <= now
      );
    });
    const noShowMatchIds = new Set(noShowMatches.map((match) => match.id));
    const configuredMatches = dueMatches.filter(
      (match) =>
        !noShowMatchIds.has(match.id) && matchAutoFinishAt(match) <= now,
    );

    const targetSnapshots = new Map();
    for (const match of configuredMatches) {
      const [groupIds, birthYearIds] = await Promise.all([
        this.repo.getMatchGroupIds(match.id),
        this.repo.getMatchBirthYearIds(match.id),
      ]);
      targetSnapshots.set(
        match.id,
        await this._buildMatchTargetSnapshot(academyId, {
          groupIds,
          birthYearIds,
          teamId: match.team_id,
          ageGroupId: match.age_group_id,
        }),
      );
    }

    const eventIds = configuredMatches
      .map((match) => match.event_id)
      .filter(Boolean);
    await this.repo.db.transaction(async (trx) => {
      if (noShowMatches.length) {
        await this._deleteNoShowMatches(academyId, noShowMatches, trx);
      }

      for (const match of configuredMatches) {
        const finishedAt = match.finished_at || matchAutoFinishAt(match);
        await trx("matches")
          .where({ id: match.id })
          .whereIn("status", ["scheduled", "postponed"])
          .update({
            status: "completed",
            match_status: "finished",
            finished_at: finishedAt,
            target_snapshot: JSON.stringify(targetSnapshots.get(match.id)),
            updated_at: now,
          });
        await this._refreshMatchSquadSnapshots(match.id, trx);
        await this._refreshMatchInjuryRiskMonthlyAttendance(
          academyId,
          { ...match, finished_at: finishedAt },
          trx,
        );
      }
      if (eventIds.length) {
        await trx("calendar_events").whereIn("id", eventIds).update({
          status: "finished",
          updated_at: now,
        });
      }
    });
    for (const match of configuredMatches) {
      await this._syncMatchMinutes(match.id, academyId, null);
    }
    return new Set(configuredMatches.map((match) => match.id));
  }

  async _completeExpiredTrainingEvents(academyId, { eventId } = {}) {
    const now = new Date();
    const baseQuery = this.repo
      .db("calendar_events")
      .where({
        academy_id: academyId,
        event_type: "training",
        status: "scheduled",
      })
      .where("end_datetime", "<=", now);
    if (eventId) baseQuery.where({ id: eventId });

    const rows = await baseQuery.clone().select("id");
    if (!rows.length) return new Set();

    await this.repo
      .db("calendar_events")
      .whereIn(
        "id",
        rows.map((row) => row.id),
      )
      .update({ status: "finished", updated_at: now });

    return new Set(rows.map((row) => row.id));
  }

  async notifyDueMatchDays() {
    const [candidates, autoFinishAcademies] = await Promise.all([
      this.repo.findDueMatchDayCandidates(),
      this.repo.findAutoFinishCandidateAcademyIds(),
    ]);
    const byAcademy = candidates.reduce((map, match) => {
      if (!map.has(match.academy_id)) map.set(match.academy_id, []);
      map.get(match.academy_id).push(match);
      return map;
    }, new Map());

    let notifiedCount = 0;
    for (const [academyId, matches] of byAcademy.entries()) {
      const notified = await this._notifyMatchDayIfDue(academyId, matches);
      notifiedCount += notified.size;
    }
    for (const row of autoFinishAcademies) {
      await this._finalizeOverdueMatches(row.academy_id);
    }
    return notifiedCount;
  }

  async notifyDueAttendanceQrReminders() {
    const now = new Date();
    const windowStart = addMinutes(now, -1);
    const windowEnd = addMinutes(now, ATTENDANCE_QR_WINDOW_MINUTES);
    const [matches, trainings] = await Promise.all([
      this.repo
        .db("matches as m")
        .leftJoin("calendar_events as ce", "m.event_id", "ce.id")
        .whereNull("m.deleted_at")
        .whereIn("m.status", ["scheduled", "postponed"])
        .where("m.match_status", "scheduled")
        .whereRaw("(m.match_date::date + m.match_time::time) BETWEEN ? AND ?", [
          windowStart,
          windowEnd,
        ])
        .select(
          "m.id",
          "m.status",
          "m.match_status",
          "m.match_date",
          "m.match_time",
          "m.opponent_name",
          this.repo.db.raw(
            "COALESCE(ce.academy_id, (SELECT ab.academy_id FROM academy_groups ag JOIN academy_branches ab ON ag.branch_id = ab.id WHERE ag.id = COALESCE(m.team_id, m.age_group_id) LIMIT 1)) as academy_id",
          ),
        ),
      this.repo
        .db("calendar_events")
        .where({
          event_type: "training",
          status: "scheduled",
        })
        .whereNull("deleted_at")
        .whereBetween("start_datetime", [windowStart, windowEnd])
        .select("*"),
    ]);

    let notifiedCount = 0;
    for (const match of matches) {
      if (!match.academy_id) continue;
      const notified = await this._notifyMatchQrReminderIfDue(
        match.academy_id,
        match,
      );
      if (notified) notifiedCount += 1;
    }
    for (const training of trainings) {
      const event = await this.repo.findEventById(
        training.id,
        training.academy_id,
      );
      const notified = await this._notifyTrainingQrReminderIfDue(
        training.academy_id,
        event,
      );
      if (notified) notifiedCount += 1;
    }
    return notifiedCount;
  }

  async notifyDueMonthlyMeasurementReminders() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const coaches = await this.repo
      .db("coach_profiles as cp")
      .join("auth_users as au", "cp.user_id", "au.id")
      .whereNull("cp.deleted_at")
      .whereNull("au.deleted_at")
      .where("au.is_active", true)
      .select("cp.id", "cp.academy_id", "cp.user_id", "cp.full_name");

    let notifiedCount = 0;
    for (const coach of coaches) {
      const existing = await this.repo
        .db("notification_inbox")
        .where("user_id", coach.user_id)
        .whereRaw("data->>'source' = ?", ["monthly_measurement_reminder"])
        .whereRaw("data->>'month' = ?", [monthKey])
        .first("id");
      if (existing) continue;

      const missing = await this.repo
        .db("player_group_assignments as pga")
        .join("coach_group_assignments as cga", "cga.group_id", "pga.group_id")
        .join("player_profiles as pp", "pp.id", "pga.player_id")
        .where("cga.coach_id", coach.id)
        .whereNull("pga.left_at")
        .whereNull("pp.deleted_at")
        .whereNotExists(function measuredThisMonth() {
          this.select(1)
            .from("player_measurements as pm")
            .whereRaw("pm.player_id = pp.id")
            .where("pm.measured_at", ">=", monthStart)
            .where("pm.measured_at", "<", monthEnd);
        })
        .countDistinct("pp.id as count")
        .first();
      const missingCount = Number(missing?.count || 0);
      if (!missingCount) continue;

      await this._notifyUsers(
        [coach.user_id],
        "Monthly measurements due",
        `${missingCount} player${missingCount === 1 ? "" : "s"} still need measurements for ${monthKey}.`,
        "measurement",
        {
          source: "monthly_measurement_reminder",
          month: monthKey,
          missingCount,
          href: "/coach/measurements",
        },
      );
      notifiedCount += 1;
    }
    return notifiedCount;
  }

  _matchGroupIds(data) {
    return uniq([...(data.groupIds || []), data.teamId, data.ageGroupId]);
  }

  async _resolveAdminMatchGroupIds(academyId, data) {
    const explicitGroupIds = this._matchGroupIds(data);
    const birthYearIds = uniq(data.birthYearIds || []);
    if (!birthYearIds.length) return explicitGroupIds;
    const birthYearGroups = await this.repo.findGroupsForBirthYears(
      academyId,
      birthYearIds,
    );
    return uniq([
      ...explicitGroupIds,
      ...birthYearGroups.map((group) => group.id),
    ]);
  }

  async _resolveAdminMatchTargets(academyId, data) {
    const birthYearIds = uniq(data.birthYearIds || []);
    const groupIds = await this._resolveAdminMatchGroupIds(academyId, data);
    if (groupIds.length) await this._validateAcademyGroups(groupIds, academyId);
    if (birthYearIds.length)
      await this._validateAcademyBirthYears(birthYearIds, academyId);
    return { groupIds, birthYearIds };
  }

  async _buildMatchTargetSnapshot(
    academyId,
    { groupIds = [], birthYearIds = [], teamId = null, ageGroupId = null },
  ) {
    const snapshotGroupIds = uniq([...groupIds, teamId, ageGroupId]);
    const snapshotBirthYearIds = uniq(birthYearIds);
    const [groups, birthYears] = await Promise.all([
      snapshotGroupIds.length
        ? this.repo
            .db("academy_groups as ag")
            .join("academy_branches as ab", "ag.branch_id", "ab.id")
            .whereIn("ag.id", snapshotGroupIds)
            .where("ab.academy_id", academyId)
            .select("ag.id", "ag.name")
        : [],
      snapshotBirthYearIds.length
        ? this.repo
            .db("academy_birth_years as aby")
            .join("academy_branches as ab", "aby.branch_id", "ab.id")
            .whereIn("aby.id", snapshotBirthYearIds)
            .where("ab.academy_id", academyId)
            .select("aby.id", "aby.label", "aby.from_year", "aby.to_year")
        : [],
    ]);
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const birthYearsById = new Map(
      birthYears.map((birthYear) => [birthYear.id, birthYear]),
    );
    const team = teamId ? groupsById.get(teamId) : null;
    const ageGroup = ageGroupId ? groupsById.get(ageGroupId) : null;

    return {
      groups: snapshotGroupIds
        .map((groupId) => groupsById.get(groupId))
        .filter(Boolean)
        .map((group) => ({ id: group.id, name: group.name })),
      birthYears: snapshotBirthYearIds
        .map((birthYearId) => birthYearsById.get(birthYearId))
        .filter(Boolean)
        .map((birthYear) => ({
          id: birthYear.id,
          label:
            birthYear.label || `${birthYear.from_year}-${birthYear.to_year}`,
          fromYear: birthYear.from_year,
          toYear: birthYear.to_year,
        })),
      teamName: team?.name || null,
      ageGroupName: ageGroup?.name || null,
    };
  }

  async _refreshMatchSquadSnapshots(matchId, trx = this.repo.db) {
    await trx.raw(
      `
        UPDATE match_squads AS ms
        SET
          player_name_snapshot = pp.full_name,
          profile_status_snapshot = pp.profile_status::text,
          updated_at = NOW()
        FROM player_profiles AS pp
        WHERE ms.player_id = pp.id
          AND ms.match_id = ?
      `,
      [matchId],
    );
  }

  _matchEventPayload(academyId, data, actorUserId) {
    const start = combineDateTime(data.matchDate, data.matchTime);
    return {
      academy_id: academyId,
      title: `${data.opponentName} (${data.matchType.replace("_", " ")})`,
      event_type: "match",
      start_datetime: start,
      end_datetime: addHours(start, 2),
      location: data.location,
      status: eventStatusFromMatch(data.status || "scheduled"),
      visibility:
        data.groupIds?.length ||
        data.birthYearIds?.length ||
        data.teamId ||
        data.ageGroupId
          ? "selected_groups"
          : "coaches_only",
      created_by_user_id: actorUserId,
      created_by_role: "admin",
      notes: data.organizerNotes || null,
    };
  }

  _matchPayload(data, adminUserId) {
    return {
      team_id: data.teamId || null,
      age_group_id: data.ageGroupId || null,
      opponent_name: data.opponentName,
      match_type: data.matchType,
      match_date: data.matchDate,
      match_time: toTime(data.matchTime),
      location: data.location,
      venue_type: data.venueType,
      referee_name: data.refereeName || null,
      status: data.status || "scheduled",
      match_status: matchStatusFromCore(data.status || "scheduled"),
      organizer_notes: data.organizerNotes || null,
      match_notes: data.matchNotes || null,
      our_score: data.ourScore ?? null,
      opponent_score: data.opponentScore ?? null,
      created_by_admin_id: adminUserId,
    };
  }

  async adminListCalendarEvents(academyId, filters) {
    return this.repo.paginate(
      this.repo.eventListQuery(academyId, filters),
      filters,
      "ce.id",
    );
  }

  async adminGetCalendarEvent(academyId, eventId) {
    const event = await this.repo.findEventById(eventId, academyId);
    if (!event) throw new NotFoundError("Calendar event", eventId);
    return event;
  }

  async adminCreateCalendarEvent(academyId, adminUserId, data) {
    const groupIds =
      data.visibility === "coaches_only" ? [] : uniq(data.groupIds);
    await this._validateAcademyGroups(groupIds, academyId);

    const event = await this.repo.db.transaction(async (trx) => {
      const row = await this.repo.createEventWithGroups(
        {
          academy_id: academyId,
          title: data.title,
          event_type: data.eventType,
          start_datetime: data.startDatetime,
          end_datetime: data.endDatetime,
          location: data.location || null,
          status: calendarEventStatusForDb(data.status),
          visibility: data.visibility,
          created_by_user_id: adminUserId,
          created_by_role: "admin",
          notes: data.notes || null,
        },
        groupIds,
        trx,
      );
      await this._notifyGroups(
        groupIds,
        "New academy event",
        data.title,
        "calendar",
        { eventId: row.id },
        trx,
      );
      return row;
    });

    if (data.eventType === "training") {
      await this._invalidateAttendanceCache(academyId);
    }
    return this.adminGetCalendarEvent(academyId, event.id);
  }

  async adminUpdateCalendarEvent(academyId, eventId, data) {
    const event = await this.adminGetCalendarEvent(academyId, eventId);
    let groupIds = null;
    if (data.groupIds) {
      groupIds = uniq(data.groupIds);
      await this._validateAcademyGroups(groupIds, academyId);
    }

    await this.repo.db.transaction(async (trx) => {
      await trx("calendar_events")
        .where({ id: eventId })
        .update({
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.eventType !== undefined
            ? { event_type: data.eventType }
            : {}),
          ...(data.startDatetime !== undefined
            ? { start_datetime: data.startDatetime }
            : {}),
          ...(data.endDatetime !== undefined
            ? { end_datetime: data.endDatetime }
            : {}),
          ...(data.location !== undefined ? { location: data.location } : {}),
          ...(data.status !== undefined
            ? { status: calendarEventStatusForDb(data.status) }
            : {}),
          ...(data.visibility !== undefined
            ? { visibility: data.visibility }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          updated_at: new Date(),
        });
      if (groupIds) await this.repo.replaceEventGroups(eventId, groupIds, trx);
      const notifyGroupIds =
        groupIds || (event.groups || []).map((group) => group.id);
      await this._notifyGroups(
        notifyGroupIds,
        "Calendar event updated",
        event.title,
        "calendar",
        { eventId, eventTitle: event.title },
        trx,
        true,
      );
    });

    if (event.event_type === "training" || data.eventType === "training") {
      await this._invalidateAttendanceCache(academyId);
    }
    return this.adminGetCalendarEvent(academyId, eventId);
  }

  async adminDeleteCalendarEvent(academyId, eventId) {
    const event = await this.adminGetCalendarEvent(academyId, eventId);
    if (event.event_type === "training") {
      return this.adminHardDeleteTrainingEvent(academyId, eventId);
    }
    await this.repo.db.transaction(async (trx) => {
      const linkedMatches = await trx("matches")
        .where({ event_id: eventId })
        .whereNull("deleted_at")
        .select("id");
      for (const match of linkedMatches) {
        await this._deleteMatchLinkedRequests(trx, match.id);
      }
      if (linkedMatches.length) {
        await trx("matches")
          .whereIn(
            "id",
            linkedMatches.map((match) => match.id),
          )
          .update({
            deleted_at: new Date(),
            status: "cancelled",
            match_status: "cancelled",
          });
      }
      await trx("calendar_events")
        .where({ id: eventId })
        .update({ deleted_at: new Date(), status: "cancelled" });
    });
    return { message: "Calendar event deleted" };
  }

  async _trainingTargetPlayerIds(event, academyId) {
    const groupIds = (event.groups || []).map((group) => group.id);
    const birthYearIds = (event.birth_years || []).map(
      (birthYear) => birthYear.id,
    );
    const directPlayerIds = (event.players || []).map((player) => player.id);
    const [groupPlayers, birthYearPlayers, directPlayers] = await Promise.all([
      this.repo.findGroupPlayers(groupIds),
      this.repo.findPlayersForBirthYears(academyId, birthYearIds),
      directPlayerIds.length
        ? this.repo
            .db("player_profiles")
            .whereIn("id", directPlayerIds)
            .where("academy_id", academyId)
            .whereNull("deleted_at")
            .select("id")
        : [],
    ]);
    return uniq([
      ...groupPlayers.map((player) => player.id),
      ...birthYearPlayers.map((player) => player.id),
      ...directPlayers.map((player) => player.id),
    ]);
  }

  async adminHardDeleteTrainingEvent(academyId, eventId) {
    const event = await this.adminGetCalendarEvent(academyId, eventId);
    if (event.event_type !== "training") {
      throw new BadRequestError(
        "Only training events can be hard deleted here",
      );
    }

    const [targetPlayerIds, attendanceRows] = await Promise.all([
      this._trainingTargetPlayerIds(event, academyId),
      this.repo
        .db("event_attendance")
        .where({ event_id: eventId })
        .select("player_id"),
    ]);
    const affectedPlayerIds = uniq([
      ...targetPlayerIds,
      ...attendanceRows.map((row) => row.player_id),
    ]);

    await this.repo.db.transaction(async (trx) => {
      await trx("notification_inbox")
        .whereRaw("data->>'eventId' = ?", [eventId])
        .orWhereRaw("data->>'trainingEventId' = ?", [eventId])
        .orWhereRaw("data->'event'->>'id' = ?", [eventId])
        .del();

      if (affectedPlayerIds.length) {
        await trx("ai_analyses")
          .where("type", "injury_risk")
          .whereIn("player_id", affectedPlayerIds)
          .del();
      }

      const deleted = await trx("calendar_events")
        .where({
          id: eventId,
          academy_id: academyId,
          event_type: "training",
        })
        .del();
      if (!deleted) throw new NotFoundError("Training event", eventId);

      await this._refreshInjuryRiskMonthlyAttendance(
        academyId,
        affectedPlayerIds,
        event.start_datetime,
        trx,
      );
    });

    await this._invalidateAttendanceCache(academyId);
    return {
      message: "Training event permanently deleted",
      affectedPlayers: affectedPlayerIds.length,
    };
  }

  async _deleteMatchLinkedRequests(trx, matchId) {
    await trx("admin_match_coach_requests")
      .where({ created_match_id: matchId })
      .del();
    await trx("friendly_match_requests")
      .where({ converted_match_id: matchId })
      .del();
  }

  async adminListMatches(academyId, filters) {
    await this._finalizeOverdueMatches(academyId);
    return this.repo.paginate(
      this.repo.matchListQuery(academyId, filters),
      filters,
      "m.id",
    );
  }

  async adminGetMatch(academyId, matchId) {
    await this._finalizeOverdueMatches(academyId, { matchId });
    const match = await this.repo.findMatchById(matchId, academyId);
    if (!match) throw new NotFoundError("Match", matchId);
    return match;
  }

  async adminCreateMatch(academyId, adminUserId, data) {
    ensureMatchKickoffIsFuture(data);
    const { groupIds, birthYearIds } = await this._resolveAdminMatchTargets(
      academyId,
      data,
    );
    const targetSnapshot = await this._buildMatchTargetSnapshot(academyId, {
      groupIds,
      birthYearIds,
      teamId: data.teamId,
      ageGroupId: data.ageGroupId,
    });
    const assignedCoach = data.coachId
      ? await this.repo.findCoachById(data.coachId, academyId)
      : null;
    if (data.coachId && !assignedCoach) {
      throw new NotFoundError("Coach", data.coachId);
    }

    const match = await this.repo.db.transaction(async (trx) => {
      const event = await this.repo.createEventWithTargets(
        this._matchEventPayload(academyId, data, adminUserId),
        { groupIds, birthYearIds },
        trx,
      );
      const [row] = await trx("matches")
        .insert({
          event_id: event.id,
          ...this._matchPayload(data, adminUserId),
          target_snapshot: JSON.stringify(targetSnapshot),
        })
        .returning("*");
      if (assignedCoach) {
        await trx("admin_match_coach_requests").insert({
          academy_id: academyId,
          coach_id: assignedCoach.id,
          requested_by_admin_id: adminUserId,
          opponent_name: data.opponentName,
          match_type: data.matchType,
          match_date: data.matchDate,
          match_time: toTime(data.matchTime),
          location: data.location,
          venue_type: data.venueType,
          referee_name: data.refereeName || null,
          organizer_notes: data.organizerNotes || null,
          status: "accepted",
          selected_group_id: groupIds.length === 1 ? groupIds[0] : null,
          selected_birth_year_id:
            birthYearIds.length === 1 ? birthYearIds[0] : null,
          created_match_id: row.id,
          expires_at: addHours(new Date().toISOString(), 24),
        });
      }
      if (groupIds.length) {
        await this._notifyGroups(
          groupIds,
          "New match scheduled",
          `${data.opponentName} on ${data.matchDate}`,
          "match",
          { matchId: row.id, eventId: event.id },
          trx,
        );
      }
      if (birthYearIds.length) {
        const users = await this.repo.usersForBirthYears(
          academyId,
          birthYearIds,
        );
        await this._notifyUsers(
          users.coaches.map((user) => user.user_id),
          "New match scheduled",
          `${data.opponentName} on ${data.matchDate}`,
          "match",
          { matchId: row.id, eventId: event.id },
          trx,
        );
      }
      if (assignedCoach?.user_id) {
        await this._notifyUsers(
          [assignedCoach.user_id],
          "New match assigned",
          `${data.opponentName} on ${data.matchDate}`,
          "match",
          { matchId: row.id, eventId: event.id },
          trx,
        );
      }
      return row;
    });

    return this.adminGetMatch(academyId, match.id);
  }

  async adminListCoachMatchRequests(academyId, filters) {
    await this.repo.deleteStaleMatchRequests(academyId);
    await this.repo.expireAdminMatchCoachRequests({ academyId });
    return this.repo.paginate(
      this.repo.adminMatchCoachRequestsQuery(academyId, filters),
      filters,
      "amcr.id",
    );
  }

  async adminCreateCoachMatchRequest(academyId, adminUserId, data) {
    const coach = await this.repo.findCoachById(data.coachId, academyId);
    if (!coach) throw new NotFoundError("Coach", data.coachId);
    const [row] = await this.repo
      .db("admin_match_coach_requests")
      .insert({
        academy_id: academyId,
        coach_id: data.coachId,
        requested_by_admin_id: adminUserId,
        opponent_name: data.opponentName,
        match_type: data.matchType,
        match_date: data.matchDate,
        match_time: toTime(data.matchTime),
        location: data.location,
        venue_type: data.venueType,
        referee_name: data.refereeName || null,
        organizer_notes: data.organizerNotes || null,
        status: "pending",
        expires_at: addHours(new Date().toISOString(), 24),
      })
      .returning("*");
    if (coach.user_id) {
      await this._notifyUsers(
        [coach.user_id],
        "Match target required",
        `${data.opponentName} needs a group or birthday within 24 hours.`,
        "match",
        { requestId: row.id },
      );
    }
    return this.repo.findAdminMatchCoachRequestById(row.id, academyId);
  }

  async adminUpdateMatch(academyId, matchId, data) {
    const match = await this.adminGetMatch(academyId, matchId);
    if (
      data.status &&
      data.status !== "finished" &&
      (["completed", "finished"].includes(match.status) ||
        match.match_status === "finished")
    ) {
      throw new BadRequestError(
        "Finished matches cannot be cancelled or postponed",
      );
    }
    const currentGroupIds = await this.repo.getMatchGroupIds(matchId);
    const currentBirthYearIds = await this.repo.getMatchBirthYearIds(matchId);
    const targetsChanged =
      data.groupIds !== undefined ||
      data.teamId !== undefined ||
      data.ageGroupId !== undefined ||
      data.birthYearIds !== undefined;
    const birthYearIds =
      data.birthYearIds !== undefined
        ? uniq(data.birthYearIds || [])
        : currentBirthYearIds;
    const groupIds = targetsChanged
      ? await this._resolveAdminMatchGroupIds(academyId, {
          groupIds:
            data.groupIds !== undefined ? data.groupIds : currentGroupIds,
          teamId: data.teamId !== undefined ? data.teamId : match.team_id,
          ageGroupId:
            data.ageGroupId !== undefined
              ? data.ageGroupId
              : match.age_group_id,
          birthYearIds,
        })
      : currentGroupIds;
    if (groupIds.length) await this._validateAcademyGroups(groupIds, academyId);
    if (birthYearIds.length)
      await this._validateAcademyBirthYears(birthYearIds, academyId);
    const targetSnapshot = targetsChanged
      ? await this._buildMatchTargetSnapshot(academyId, {
          groupIds,
          birthYearIds,
          teamId: data.teamId !== undefined ? data.teamId : match.team_id,
          ageGroupId:
            data.ageGroupId !== undefined
              ? data.ageGroupId
              : match.age_group_id,
        })
      : null;
    const finalTargetSnapshot =
      data.status === "finished" && !targetSnapshot
        ? await this._buildMatchTargetSnapshot(academyId, {
            groupIds,
            birthYearIds,
            teamId: data.teamId !== undefined ? data.teamId : match.team_id,
            ageGroupId:
              data.ageGroupId !== undefined
                ? data.ageGroupId
                : match.age_group_id,
          })
        : null;
    const shouldRefreshAttendance =
      data.status !== undefined ||
      data.matchDate !== undefined ||
      data.matchTime !== undefined;
    const affectedPlayerIds = shouldRefreshAttendance
      ? await this._matchAffectedPlayerIds(matchId)
      : [];
    const previousAttendanceOccurredAt = shouldRefreshAttendance
      ? this._matchAttendanceOccurredAt(match)
      : null;
    if (
      match.match_status === "scheduled" &&
      (data.matchDate !== undefined || data.matchTime !== undefined)
    ) {
      ensureMatchKickoffIsFuture({
        matchDate:
          data.matchDate !== undefined ? data.matchDate : match.match_date,
        matchTime:
          data.matchTime !== undefined ? data.matchTime : match.match_time,
      });
    }

    await this.repo.db.transaction(async (trx) => {
      const updateData = {};
      if (data.teamId !== undefined) updateData.team_id = data.teamId || null;
      if (data.ageGroupId !== undefined)
        updateData.age_group_id = data.ageGroupId || null;
      if (data.opponentName !== undefined)
        updateData.opponent_name = data.opponentName;
      if (data.matchType !== undefined) updateData.match_type = data.matchType;
      if (data.matchDate !== undefined) updateData.match_date = data.matchDate;
      if (data.matchTime !== undefined)
        updateData.match_time = toTime(data.matchTime);
      if (data.location !== undefined) updateData.location = data.location;
      if (data.venueType !== undefined) updateData.venue_type = data.venueType;
      if (data.refereeName !== undefined)
        updateData.referee_name = data.refereeName || null;
      if (data.status !== undefined) {
        updateData.status =
          data.status === "finished" ? "completed" : data.status;
        updateData.match_status = matchStatusFromCore(data.status);
        if (data.status === "finished") {
          updateData.finished_at = match.finished_at || new Date();
        }
      }
      if (data.organizerNotes !== undefined)
        updateData.organizer_notes = data.organizerNotes || null;
      if (data.matchNotes !== undefined)
        updateData.match_notes = data.matchNotes || null;
      if (data.ourScore !== undefined) updateData.our_score = data.ourScore;
      if (data.opponentScore !== undefined)
        updateData.opponent_score = data.opponentScore;
      if (targetSnapshot || finalTargetSnapshot) {
        updateData.target_snapshot = JSON.stringify(
          targetSnapshot || finalTargetSnapshot,
        );
      }
      await trx("matches")
        .where({ id: matchId })
        .update({ ...updateData, updated_at: new Date() });
      if (data.status === "finished") {
        await this._refreshMatchSquadSnapshots(matchId, trx);
      }

      const eventUpdate = {};
      if (data.opponentName || data.matchType)
        eventUpdate.title = `${data.opponentName || match.opponent_name} (${(data.matchType || match.match_type).replace("_", " ")})`;
      if (data.matchDate || data.matchTime) {
        const start = combineDateTime(
          data.matchDate || match.match_date,
          data.matchTime || match.match_time,
        );
        eventUpdate.start_datetime = start;
        eventUpdate.end_datetime = addHours(start, 2);
      }
      if (data.location !== undefined) eventUpdate.location = data.location;
      if (data.status !== undefined)
        eventUpdate.status = eventStatusFromMatch(data.status);
      if (data.organizerNotes !== undefined)
        eventUpdate.notes = data.organizerNotes || null;
      if (Object.keys(eventUpdate).length) {
        await trx("calendar_events")
          .where({ id: match.event_id })
          .update({ ...eventUpdate, updated_at: new Date() });
      }
      if (targetsChanged) {
        await this.repo.replaceEventGroups(match.event_id, groupIds, trx);
        await this.repo.replaceEventBirthYears(
          match.event_id,
          birthYearIds,
          trx,
        );
      }
      await this._notifyGroups(
        groupIds,
        "Match updated",
        `${match.opponent_name} details changed`,
        "match",
        { matchId, opponentName: match.opponent_name },
        trx,
        true,
      );
    });

    if (shouldRefreshAttendance) {
      await this._refreshMatchInjuryRiskMonthlyAttendance(
        academyId,
        {
          ...match,
          match_date: data.matchDate || match.match_date,
          match_time:
            data.matchTime !== undefined
              ? toTime(data.matchTime)
              : match.match_time,
          finished_at:
            data.status === "finished"
              ? match.finished_at || new Date()
              : match.finished_at,
        },
        this.repo.db,
        {
          playerIds: affectedPlayerIds,
          occurredAts: [previousAttendanceOccurredAt],
        },
      );
    }

    return this.adminGetMatch(academyId, matchId);
  }

  async adminPostponeMatch(academyId, adminUserId, matchId, data) {
    const match = await this.adminGetMatch(academyId, matchId);
    if (
      ["completed", "finished"].includes(match.status) ||
      match.match_status === "finished"
    ) {
      throw new BadRequestError("Finished matches cannot be postponed");
    }
    if (match.status === "cancelled" || match.match_status === "cancelled") {
      throw new BadRequestError("Cancelled matches cannot be postponed");
    }
    if (match.match_status !== "scheduled") {
      throw new BadRequestError("Started matches cannot be postponed");
    }
    ensureMatchKickoffIsFuture(data);

    const groupIds = await this.repo.getMatchGroupIds(matchId);
    const birthYearIds = await this.repo.getMatchBirthYearIds(matchId);
    const newLocation =
      data.location !== undefined ? data.location || null : match.location;
    const now = new Date();
    const start = combineDateTime(data.matchDate, data.matchTime);
    const affectedPlayerIds = await this._matchAffectedPlayerIds(matchId);
    const previousAttendanceOccurredAt = this._matchAttendanceOccurredAt(match);

    await this.repo.db.transaction(async (trx) => {
      await trx("match_postponements").insert({
        match_id: matchId,
        previous_date: datePart(match.match_date),
        previous_time: toTime(match.match_time),
        new_date: data.matchDate,
        new_time: toTime(data.matchTime),
        previous_location: match.location || null,
        new_location: newLocation || null,
        reason: data.reason || null,
        postponed_by_user_id: adminUserId,
      });

      await trx("matches")
        .where({ id: matchId })
        .update({
          match_date: data.matchDate,
          match_time: toTime(data.matchTime),
          location: newLocation,
          status: "postponed",
          match_status: "scheduled",
          match_day_notified_at: null,
          started_at: null,
          first_half_started_at: null,
          second_half_started_at: null,
          finished_at: null,
          updated_at: now,
        });

      if (match.event_id) {
        await trx("calendar_events")
          .where({ id: match.event_id })
          .update({
            start_datetime: start,
            end_datetime: addHours(start, 2),
            location: newLocation,
            status: "postponed",
            notes: data.reason || match.organizer_notes || null,
            updated_at: now,
          });
      }

      const notificationBody = `${match.opponent_name} postponed to ${data.matchDate} at ${timePart(data.matchTime)}`;
      await this._notifyGroups(
        groupIds,
        "Match postponed",
        notificationBody,
        "match",
        {
          matchId,
          previousDate: datePart(match.match_date),
          previousTime: timePart(match.match_time),
          newDate: data.matchDate,
          newTime: timePart(data.matchTime),
        },
        trx,
        true,
      );

      if (birthYearIds.length) {
        const users = await this.repo.usersForBirthYears(
          academyId,
          birthYearIds,
        );
        await this._notifyUsers(
          [
            ...users.coaches.map((user) => user.user_id),
            ...users.players.map((user) => user.user_id),
            ...users.parents.map((user) => user.user_id),
          ],
          "Match postponed",
          notificationBody,
          "match",
          {
            matchId,
            previousDate: datePart(match.match_date),
            previousTime: timePart(match.match_time),
            newDate: data.matchDate,
            newTime: timePart(data.matchTime),
          },
          trx,
        );
      }
    });

    await this._refreshMatchInjuryRiskMonthlyAttendance(
      academyId,
      {
        ...match,
        match_date: data.matchDate,
        match_time: toTime(data.matchTime),
        finished_at: null,
      },
      this.repo.db,
      {
        playerIds: affectedPlayerIds,
        occurredAts: [previousAttendanceOccurredAt],
      },
    );

    return this.adminGetMatch(academyId, matchId);
  }

  async adminDeleteMatch(academyId, matchId) {
    const match = await this.adminGetMatch(academyId, matchId);
    const affectedPlayerIds = await this._matchAffectedPlayerIds(matchId);
    await this.repo.db.transaction(async (trx) => {
      await this._deleteMatchLinkedRequests(trx, matchId);
      await trx("matches").where({ id: matchId }).update({
        deleted_at: new Date(),
        status: "cancelled",
        match_status: "cancelled",
      });
      if (match.event_id)
        await trx("calendar_events")
          .where({ id: match.event_id })
          .update({ status: "cancelled", deleted_at: new Date() });
      await this._refreshMatchInjuryRiskMonthlyAttendance(
        academyId,
        match,
        trx,
        { playerIds: affectedPlayerIds },
      );
    });
    return { message: "Match deleted" };
  }

  async adminHardDeleteMatch(academyId, matchId) {
    const match = await this.repo.findMatchForHardDelete(matchId, academyId);
    if (!match) throw new NotFoundError("Match", matchId);
    const affectedPlayerIds = await this._matchAffectedPlayerIds(matchId);

    await this.repo.db.transaction(async (trx) => {
      await this._deleteMatchLinkedRequests(trx, matchId);

      if (match.event_id) {
        await trx("calendar_events").where({ id: match.event_id }).del();
      } else {
        await trx("matches").where({ id: matchId }).del();
      }
      await this._refreshMatchInjuryRiskMonthlyAttendance(
        academyId,
        match,
        trx,
        { playerIds: affectedPlayerIds },
      );
    });

    return { message: "Match permanently deleted" };
  }

  async adminUpdateMatchStatus(academyId, matchId, status) {
    return this.adminUpdateMatch(academyId, matchId, { status });
  }

  async coachListCalendarEvents(userId, academyId, filters) {
    const coach = await this._getCoach(userId, academyId);
    await this._completeExpiredTrainingEvents(academyId);
    const groupIds = await this._getCoachVisibleGroupIds(coach.id, academyId);
    const birthYearIds = (
      await this.repo.findCoachAccessibleBirthYears(coach.id, academyId)
    ).map((row) => row.id);
    const playerIds = (
      await this.repo.findCoachScopedPlayers(coach.id, academyId, {
        onlyComplete: true,
      })
    ).map((player) => player.id);
    if (!groupIds.length && !birthYearIds.length && !playerIds.length)
      return { data: [], total: 0, page: filters.page || 1, totalPages: 1 };
    return this.repo.paginate(
      this.repo.eventListQuery(academyId, {
        ...filters,
        groupIds,
        birthYearIds,
        playerIds,
      }),
      filters,
      "ce.id",
    );
  }

  async coachListGroups(userId, academyId) {
    const coach = await this._getCoach(userId, academyId);
    return this.repo.findCoachAssignedGroups(coach.id, academyId);
  }

  async coachGetPermissions(userId, academyId) {
    const coach = await this._getCoach(userId, academyId);
    return this.repo.findCoachEffectivePermissions(coach.id, academyId);
  }

  async coachListPlayers(userId, academyId, filters) {
    const coach = await this._getCoach(userId, academyId);
    const players = await this.repo.findCoachScopedPlayers(
      coach.id,
      academyId,
      filters,
    );
    const customByPlayer = await this._playerCustomProfilesByPlayer(
      players.map((player) => player.id),
    );
    const playersWithCustomProfile = players.map((player) => ({
      ...player,
      customProfile: customByPlayer.get(player.id) || [],
    }));
    return {
      data: playersWithCustomProfile,
      total: playersWithCustomProfile.length,
      page: filters.page || 1,
      totalPages: 1,
    };
  }

  async coachListInjuryRiskPainDiscomfort(userId, academyId) {
    return this.injuryRisk.listPainDiscomfort(userId, academyId);
  }

  async coachUpsertInjuryRiskPainDiscomfort(userId, academyId, records) {
    return this.injuryRisk.upsertPainDiscomfort(userId, academyId, records);
  }

  async coachListInjuryRiskPredictions(userId, academyId) {
    return this.injuryRisk.listPredictions(userId, academyId);
  }

  async coachRunInjuryRiskModel(userId, academyId) {
    if (this.injuryRisk) {
      return this.injuryRisk.runModel(userId, academyId);
    }

    const coach = await this._getCoach(userId, academyId);
    const scopedPlayers = await this._coachScopedInjuryRiskPlayers(
      coach,
      academyId,
      "can_run_injury_risk",
    );
    const players =
      await this._injuryRiskPlayersWithMainPosition(scopedPlayers);
    const playerIds = players.map((player) => player.id);
    if (!playerIds.length) return [];

    const inputRows = await this._injuryRiskInputRows(academyId, playerIds);
    const inputRowsByPlayer = new Map(
      inputRows.map((row) => [row.player_id, row]),
    );
    const modelInputs = players.map((player) =>
      this._toInjuryRiskModelInput(
        player,
        inputRowsByPlayer.get(player.id) || {},
      ),
    );
    const modelInputsByPlayer = new Map(
      modelInputs.map((input) => [input.player_id, input]),
    );
    const modelResults = await runInjuryRiskPredictions(modelInputs);
    const modelResultsByPlayer = new Map(
      modelResults.map((result) => [result.player_id, result]),
    );
    const successfulResults = modelResults.filter((result) => !result.error);

    const savedAnalyses = successfulResults.length
      ? await this.repo
          .db("ai_analyses")
          .insert(
            successfulResults.map((result) => ({
              player_id: result.player_id,
              type: "injury_risk",
              input_data: modelInputsByPlayer.get(result.player_id) || {},
              result: {
                risk_percentage: result.risk_percentage,
                risk_level: result.risk_level,
                alert_flag: result.alert_flag,
                recommendation: result.recommendation,
              },
              model_version: INJURY_RISK_MODEL_VERSION,
            })),
          )
          .returning("*")
      : [];
    const analysesByPlayer = new Map(
      savedAnalyses.map((analysis) => [analysis.player_id, analysis]),
    );

    return players.map((player) => {
      const prediction = modelResultsByPlayer.get(player.id) || null;
      const analysis = analysesByPlayer.get(player.id);
      return {
        player_id: player.id,
        player_name: player.full_name,
        position: player.injury_risk_position,
        group_id: player.group_id || null,
        analysis_id: analysis?.id || null,
        input: modelInputsByPlayer.get(player.id) || null,
        prediction: prediction?.error
          ? null
          : {
              risk_percentage: prediction?.risk_percentage,
              risk_level: prediction?.risk_level,
              alert_flag: prediction?.alert_flag,
              recommendation: prediction?.recommendation,
            },
        model_version: analysis?.model_version || INJURY_RISK_MODEL_VERSION,
        created_at: analysis?.created_at || null,
        error: prediction?.error || null,
      };
    });
  }

  async runWeeklyInjuryRiskAutomation({ force = false } = {}) {
    return this.injuryRisk.runWeeklyAutomation({ force });
  }

  async _runWeeklyInjuryRiskAutomationLocked(db, { force = false } = {}) {
    return this.injuryRisk.runWeeklyAutomationLocked(db, { force });
  }

  async coachGetPlayerDetail(userId, academyId, playerId) {
    const coach = await this._getCoach(userId, academyId);
    const scopedPlayers = await this.repo.findCoachScopedPlayersByIds(
      coach.id,
      academyId,
      [playerId],
    );
    if (!scopedPlayers.length) throw new NotFoundError("Player", playerId);
    return this._managedPlayerDetail(academyId, playerId);
  }

  async adminGetPlayerDetail(academyId, playerId) {
    const exists = await this.repo
      .db("player_profiles")
      .where({ id: playerId, academy_id: academyId })
      .whereNull("deleted_at")
      .first("id");
    if (!exists) throw new NotFoundError("Player", playerId);
    return this._managedPlayerDetail(academyId, playerId);
  }

  async _listManagedPlayerAssignments(academyId, player) {
    const db = this.repo.db;
    const [groupRows, birthYearRows] = await Promise.all([
      db("player_group_assignments")
        .where({ player_id: player.id })
        .select("group_id", "joined_at", "left_at"),
      this.repo.findBirthYearsForPlayer(player),
    ]);
    const groupIds = [
      ...new Set(groupRows.map((row) => row.group_id).filter(Boolean)),
    ];
    const birthYearIds = birthYearRows.map((row) => row.id).filter(Boolean);
    if (!groupIds.length && !birthYearIds.length) return [];

    const assignmentRows = await db("player_assignments as pa")
      .leftJoin("coach_profiles as cp", "pa.created_by_coach_id", "cp.id")
      .where("pa.academy_id", academyId)
      .whereNull("pa.deleted_at")
      .where((targetScope) => {
        if (groupIds.length) {
          targetScope.orWhereExists((existsQuery) => {
            existsQuery
              .select(db.raw("1"))
              .from("player_assignment_groups as pag_scope")
              .whereRaw("pag_scope.assignment_id = pa.id")
              .whereIn("pag_scope.group_id", groupIds)
              .where((typeScope) => {
                typeScope
                  .whereNull("pa.target_type")
                  .orWhere("pa.target_type", "group");
              });
          });
        }
        if (birthYearIds.length) {
          targetScope.orWhereExists((existsQuery) => {
            existsQuery
              .select(db.raw("1"))
              .from("player_assignment_birth_years as paby_scope")
              .whereRaw("paby_scope.assignment_id = pa.id")
              .whereIn("paby_scope.birth_year_id", birthYearIds);
          });
        }
      })
      .select("pa.*", "cp.full_name as coach_name")
      .orderByRaw("CASE WHEN pa.due_at IS NULL THEN 1 ELSE 0 END")
      .orderBy("pa.due_at", "asc")
      .orderBy("pa.created_at", "desc");

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    if (!assignmentIds.length) return [];

    const [groups, submissions] = await Promise.all([
      db("player_assignment_groups as pag")
        .join("academy_groups as ag", "pag.group_id", "ag.id")
        .leftJoin("academy_branches as ab", "ag.branch_id", "ab.id")
        .whereIn("pag.assignment_id", assignmentIds)
        .select(
          "pag.assignment_id",
          "ag.id",
          "ag.name",
          "ab.name as branch_name",
        ),
      db("player_assignment_submissions")
        .whereIn("assignment_id", assignmentIds)
        .where("player_id", player.id),
    ]);
    const submissionIds = submissions.map((submission) => submission.id);
    const files = submissionIds.length
      ? await db("player_assignment_files")
          .whereIn("submission_id", submissionIds)
          .orderBy("created_at", "desc")
      : [];
    const groupsByAssignment = groups.reduce((acc, group) => {
      if (!acc[group.assignment_id]) acc[group.assignment_id] = [];
      acc[group.assignment_id].push({
        id: group.id,
        name: group.name,
        branchName: group.branch_name,
      });
      return acc;
    }, {});
    const filesBySubmission = files.reduce((acc, file) => {
      if (!acc[file.submission_id]) acc[file.submission_id] = [];
      acc[file.submission_id].push(file);
      return acc;
    }, {});
    const submissionByAssignment = new Map(
      submissions.map((submission) => [
        submission.assignment_id,
        {
          ...submission,
          files: filesBySubmission[submission.id] || [],
        },
      ]),
    );

    return assignmentRows.map((assignment) => {
      const submission = this._shapePlayerAssignmentSubmission(
        submissionByAssignment.get(assignment.id),
      );
      const reviewStatus = submission?.reviewStatus || null;
      const playerStatus = reviewStatus
        ? reviewStatus === "approved"
          ? "approved"
          : reviewStatus === "rejected"
            ? "rejected"
            : "submitted"
        : "not_submitted";

      return {
        id: assignment.id,
        assignmentType: "coach_task",
        title: assignment.title,
        description: assignment.description || "",
        coachName: assignment.coach_name || null,
        openAt: assignment.open_at,
        dueAt: assignment.due_at,
        status: assignment.status,
        isSystemDaily: false,
        acceptedFileTypes: assignment.accepted_file_types || [
          "pdf",
          "word",
          "image",
        ],
        groups: groupsByAssignment[assignment.id] || [],
        submission,
        playerStatus,
        submittedAt: submission?.submittedAt || null,
        reviewStatus,
        filesCount: submission?.files?.length || 0,
      };
    });
  }

  async _managedPlayerDetail(academyId, playerId) {
    const db = this.repo.db;
    const player = await db("player_profiles as pp")
      .leftJoin("auth_users as au", "pp.user_id", "au.id")
      .leftJoin("academy_branches as ab", "pp.branch_id", "ab.id")
      .leftJoin("player_group_assignments as pga", function joinCurrentGroup() {
        this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
      })
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .where("pp.id", playerId)
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        "au.username",
        "au.phone as account_phone",
        "au.is_active as account_is_active",
        "au.is_verified as account_is_verified",
        "ab.name as branch_name",
        "ag.id as group_id",
        "ag.name as group_name",
        "pga.joined_at as group_joined_at",
      )
      .first();

    const [
      groupAssignments,
      measurements,
      injuries,
      healthProfile,
      skillAssessments,
      trainingSummaries,
      matchSummaries,
      customValues,
      trainingAttendance,
      trainingEvaluations,
      matchStats,
      matchAttendance,
      substitutions,
      incidents,
      goals,
      rankings,
      coachRatings,
      subscriptions,
      linkedParent,
      playerAssignments,
      injuryRisk,
    ] = await Promise.all([
      db("player_group_assignments as pga")
        .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
        .leftJoin("academy_branches as ab", "ag.branch_id", "ab.id")
        .where("pga.player_id", playerId)
        .select("pga.*", "ag.name as group_name", "ab.name as branch_name")
        .orderBy("pga.joined_at", "desc"),
      db("player_measurements")
        .where({ player_id: playerId })
        .orderBy("measured_at", "desc"),
      db("player_injury_history")
        .where({ player_id: playerId })
        .orderBy("injury_date", "desc"),
      db("player_health_profiles").where({ player_id: playerId }).first(),
      db("player_skill_assessments as psa")
        .leftJoin("academy_groups as ag", "psa.group_id", "ag.id")
        .where("psa.player_id", playerId)
        .select("psa.*", "ag.name as group_name")
        .orderBy("psa.assessed_at", "desc"),
      db("player_training_summaries as pts")
        .leftJoin("academy_groups as ag", "pts.group_id", "ag.id")
        .where("pts.player_id", playerId)
        .select("pts.*", "ag.name as group_name")
        .orderBy("pts.recorded_at", "desc"),
      db("player_match_summaries as pms")
        .leftJoin("academy_groups as ag", "pms.group_id", "ag.id")
        .where("pms.player_id", playerId)
        .select("pms.*", "ag.name as group_name")
        .orderBy("pms.recorded_at", "desc"),
      db("player_custom_values as pcv")
        .join("custom_fields as cf", "pcv.field_id", "cf.id")
        .join("custom_categories as cc", "cf.category_id", "cc.id")
        .leftJoin(
          "custom_field_options as cfo",
          "pcv.value_option_id",
          "cfo.id",
        )
        .where("pcv.player_id", playerId)
        .select(
          "pcv.*",
          "cf.label",
          "cf.key",
          "cf.field_type",
          "cf.unit",
          "cc.name as category_name",
          "cfo.label as option_label",
        )
        .orderBy("cc.sort_order", "asc")
        .orderBy("cf.sort_order", "asc"),
      db("event_attendance as ea")
        .join("calendar_events as ce", "ea.event_id", "ce.id")
        .leftJoin("training_sessions as ts", "ts.event_id", "ce.id")
        .where("ea.player_id", playerId)
        .where("ce.event_type", "training")
        .select(
          "ea.*",
          "ce.title",
          "ce.start_datetime",
          "ce.end_datetime",
          "ce.location",
          "ce.status as event_status",
          "ts.training_focus",
          "ts.intensity_level",
        )
        .orderBy("ce.start_datetime", "desc"),
      db("player_event_evaluations as pee")
        .join("calendar_events as ce", "pee.event_id", "ce.id")
        .leftJoin("coach_profiles as cp", "pee.coach_id", "cp.id")
        .where("pee.player_id", playerId)
        .select(
          "pee.*",
          "ce.title",
          "ce.start_datetime",
          "cp.full_name as coach_name",
        )
        .orderBy("ce.start_datetime", "desc"),
      db("match_player_stats as mps")
        .join("matches as m", "mps.match_id", "m.id")
        .leftJoin("academy_groups as team", "m.team_id", "team.id")
        .where("mps.player_id", playerId)
        .whereNull("m.deleted_at")
        .select(
          "mps.*",
          "m.opponent_name",
          "m.match_date",
          "m.match_time",
          "m.location",
          "m.status",
          "m.match_status",
          "m.our_score",
          "m.opponent_score",
          "team.name as team_name",
        )
        .orderBy("m.match_date", "desc")
        .orderBy("m.match_time", "desc"),
      db("match_attendance as ma")
        .join("matches as m", "ma.match_id", "m.id")
        .where("ma.player_id", playerId)
        .whereNull("m.deleted_at")
        .select("ma.*", "m.opponent_name", "m.match_date", "m.match_time")
        .orderBy("m.match_date", "desc"),
      db("match_substitutions as sub")
        .join("matches as m", "sub.match_id", "m.id")
        .leftJoin("player_profiles as outp", "sub.out_player_id", "outp.id")
        .leftJoin("player_profiles as inp", "sub.in_player_id", "inp.id")
        .where((q) => {
          q.where("sub.out_player_id", playerId).orWhere(
            "sub.in_player_id",
            playerId,
          );
        })
        .whereNull("m.deleted_at")
        .select(
          "sub.*",
          "m.opponent_name",
          "m.match_date",
          "outp.full_name as out_player_name",
          "inp.full_name as in_player_name",
        )
        .orderBy("m.match_date", "desc")
        .orderBy("sub.minute", "desc"),
      db("match_player_incidents as mpi")
        .join("matches as m", "mpi.match_id", "m.id")
        .where("mpi.player_id", playerId)
        .whereNull("m.deleted_at")
        .select("mpi.*", "m.opponent_name", "m.match_date")
        .orderBy("m.match_date", "desc")
        .orderBy("mpi.minute", "desc"),
      db("match_goal_events as mge")
        .join("matches as m", "mge.match_id", "m.id")
        .where((q) => {
          q.where("mge.scorer_player_id", playerId).orWhere(
            "mge.assist_player_id",
            playerId,
          );
        })
        .whereNull("m.deleted_at")
        .select("mge.*", "m.opponent_name", "m.match_date")
        .orderBy("m.match_date", "desc")
        .orderBy("mge.minute", "desc"),
      db("ranking_snapshots as rs")
        .leftJoin("academy_groups as ag", "rs.group_id", "ag.id")
        .leftJoin("ranking_score_breakdown as rsb", "rsb.ranking_id", "rs.id")
        .where("rs.player_id", playerId)
        .select("rs.*", "ag.name as group_name", "rsb.*")
        .orderBy("rs.period", "desc"),
      db("evaluation_coach_ratings as ecr")
        .leftJoin("coach_profiles as cp", "ecr.coach_id", "cp.id")
        .leftJoin("academy_groups as ag", "ecr.group_id", "ag.id")
        .where("ecr.player_id", playerId)
        .select("ecr.*", "cp.full_name as coach_name", "ag.name as group_name")
        .orderBy("ecr.eval_date", "desc"),
      db("payment_subscriptions as ps")
        .leftJoin("academy_groups as ag", "ps.group_id", "ag.id")
        .where("ps.player_id", playerId)
        .select("ps.*", "ag.name as group_name")
        .orderBy("ps.starts_at", "desc"),
      this.repo.findPrimaryParentForPlayer(playerId, academyId),
      this._listManagedPlayerAssignments(academyId, player),
      db("ai_analyses")
        .where({ player_id: playerId, type: "injury_risk" })
        .orderBy("created_at", "desc")
        .first(),
    ]);

    const subscriptionIds = subscriptions.map((row) => row.id);
    const invoices = subscriptionIds.length
      ? await db("payment_invoices")
          .whereIn("subscription_id", subscriptionIds)
          .orderBy("due_date", "desc")
      : [];
    const invoiceIds = invoices.map((row) => row.id);
    const transactions = invoiceIds.length
      ? await db("payment_transactions")
          .whereIn("invoice_id", invoiceIds)
          .orderBy("created_at", "desc")
      : [];
    const attendancePayload = this._buildAttendanceQrPayload({
      academyId,
      player,
    });
    const attendanceQr = {
      playerId: player.id,
      playerName: player.full_name,
      playerCode: player.player_code || null,
      username: player.username || null,
      payload: attendancePayload,
      qrCodeDataUrl: await QRCode.toDataURL(attendancePayload, {
        errorCorrectionLevel: "H",
        margin: 3,
        width: 420,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }),
    };

    const optionIds = new Set();
    customValues.forEach((row) => {
      if (row.value_option_id) optionIds.add(row.value_option_id);
      if (
        typeof row.value_text === "string" &&
        uuidPattern.test(row.value_text)
      ) {
        optionIds.add(row.value_text);
      }
      if (
        typeof row.value_json === "string" &&
        uuidPattern.test(row.value_json)
      ) {
        optionIds.add(row.value_json);
      }
      if (Array.isArray(row.value_json)) {
        row.value_json
          .filter(
            (value) => typeof value === "string" && uuidPattern.test(value),
          )
          .forEach((value) => optionIds.add(value));
      }
    });
    const optionRows = optionIds.size
      ? await db("custom_field_options")
          .whereIn("id", [...optionIds])
          .select("id", "label")
      : [];
    const optionLabels = new Map(optionRows.map((row) => [row.id, row.label]));

    const valueOf = (row) => {
      if (row.option_label) return row.option_label;
      if (
        typeof row.value_text === "string" &&
        optionLabels.has(row.value_text)
      ) {
        return optionLabels.get(row.value_text);
      }
      if (
        typeof row.value_json === "string" &&
        optionLabels.has(row.value_json)
      ) {
        return optionLabels.get(row.value_json);
      }
      if (Array.isArray(row.value_json)) {
        const labels = row.value_json
          .map((value) => optionLabels.get(value) || value)
          .filter(Boolean);
        return labels.length ? labels.join(", ") : null;
      }
      return (
        row.value_text ??
        row.value_long_text ??
        row.value_number ??
        row.value_decimal ??
        row.value_date ??
        row.value_boolean ??
        row.value_json ??
        null
      );
    };

    const matchTotals = matchStats.reduce(
      (totals, row) => ({
        matches_played:
          totals.matches_played + (Number(row.minutes_played || 0) > 0 ? 1 : 0),
        minutes_played: totals.minutes_played + Number(row.minutes_played || 0),
        goals: totals.goals + Number(row.goals || 0),
        assists: totals.assists + Number(row.assists || 0),
        yellow_cards: totals.yellow_cards + Number(row.yellow_cards || 0),
        red_cards: totals.red_cards + Number(row.red_cards || 0),
      }),
      {
        matches_played: 0,
        minutes_played: 0,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
      },
    );
    const trainingAttendanceTotals = trainingAttendance.reduce(
      (totals, row) => {
        totals.total += 1;
        totals[row.status] = (totals[row.status] || 0) + 1;
        return totals;
      },
      { total: 0, present: 0, late: 0, absent: 0, excused: 0, injured: 0 },
    );
    const matchAttendanceTotals = matchAttendance.reduce(
      (totals, row) => {
        totals.total += 1;
        totals[row.status] = (totals[row.status] || 0) + 1;
        return totals;
      },
      { total: 0, present: 0, late: 0, absent: 0, injured: 0 },
    );
    const attendanceTotals = {
      total: trainingAttendanceTotals.total + matchAttendanceTotals.total,
      present: trainingAttendanceTotals.present + matchAttendanceTotals.present,
      late: trainingAttendanceTotals.late + matchAttendanceTotals.late,
      absent: trainingAttendanceTotals.absent + matchAttendanceTotals.absent,
      excused: trainingAttendanceTotals.excused,
      injured: trainingAttendanceTotals.injured + matchAttendanceTotals.injured,
      trainingTotal: trainingAttendanceTotals.total,
      trainingAttended:
        trainingAttendanceTotals.present + trainingAttendanceTotals.late,
      matchTotal: matchAttendanceTotals.total,
      matchAttended: matchAttendanceTotals.present + matchAttendanceTotals.late,
    };

    const linkedParentPayload = linkedParent
      ? {
          link_id: linkedParent.link_id,
          user_id: linkedParent.user_id,
          name: linkedParent.name,
          full_name: linkedParent.full_name,
          username: linkedParent.username,
          email: linkedParent.email,
          phone: linkedParent.phone,
          address: linkedParent.address,
          relation: linkedParent.relation || "guardian",
          is_primary: Boolean(linkedParent.is_primary),
          is_active: Boolean(linkedParent.is_active),
          can_view_progress: linkedParent.can_view_progress !== false,
          can_view_payments: linkedParent.can_view_payments !== false,
          can_message_coach: linkedParent.can_message_coach !== false,
        }
      : null;
    const playerWithParent = linkedParentPayload
      ? {
          ...player,
          guardian_name: linkedParentPayload.name,
          guardian_phone: linkedParentPayload.phone,
          guardian_relation: linkedParentPayload.relation,
          linked_parent: linkedParentPayload,
        }
      : { ...player, linked_parent: null };

    return {
      player: playerWithParent,
      summary: {
        matchTotals,
        attendanceTotals,
        trainingEvaluationCount: trainingEvaluations.length,
        injuryCount:
          injuries.length +
          (healthProfile?.current_injury_status === "injured" ? 1 : 0),
        latestMeasurement: measurements[0] || null,
        latestRanking: rankings[0] || null,
      },
      customProfile: customValues.map((row) => ({
        ...row,
        value: valueOf(row),
      })),
      groups: groupAssignments,
      measurements,
      injuries,
      healthProfile: healthProfile || null,
      skillAssessments,
      trainingSummaries,
      matchSummaries,
      trainingAttendance,
      trainingEvaluations,
      matchStats,
      matchAttendance,
      substitutions,
      incidents,
      goals,
      rankings,
      coachRatings,
      playerAssignments,
      injuryRisk: injuryRisk
        ? {
            player_id: injuryRisk.player_id,
            analysis_id: injuryRisk.id,
            input: injuryRisk.input_data || null,
            prediction: injuryRisk.result || null,
            model_version: injuryRisk.model_version || null,
            created_at: injuryRisk.created_at || null,
          }
        : null,
      attendanceQr,
      payments: { subscriptions, invoices, transactions },
    };
  }

  async coachListGroupPlayers(userId, academyId, groupId) {
    const coach = await this._getCoach(userId, academyId);
    await this._ensureCoachCanAccessGroups(coach, academyId, [groupId]);
    return this.repo.findGroupPlayers([groupId]);
  }

  async _trainingParticipants(event, academyId) {
    const groupIds = (event.groups || []).map((group) => group.id);
    const birthYearIds = (event.birth_years || []).map(
      (birthYear) => birthYear.id,
    );
    const directPlayerIds = (event.players || []).map((player) => player.id);
    const [groupPlayers, birthYearPlayers, directPlayers] = await Promise.all([
      this.repo.findGroupPlayers(groupIds, { onlyComplete: true }),
      this.repo.findPlayersForBirthYears(academyId, birthYearIds, {
        onlyComplete: true,
      }),
      directPlayerIds.length
        ? this.repo
            .db("player_profiles")
            .whereIn("id", directPlayerIds)
            .where("academy_id", academyId)
            .whereNull("deleted_at")
            .where("profile_status", "complete")
        : [],
    ]);
    const playerIds = [
      ...new Set(
        [...groupPlayers, ...birthYearPlayers, ...directPlayers].map(
          (player) => player.id,
        ),
      ),
    ];
    if (!playerIds.length) return [];

    const [
      players,
      customValues,
      trainingAttendance,
      matchStats,
      injuryCounts,
      monthlyProgress,
    ] = await Promise.all([
      this.repo
        .db("player_profiles as pp")
        .leftJoin("auth_users as au", "pp.user_id", "au.id")
        .leftJoin(
          "player_group_assignments as pga",
          function joinCurrentAssignment() {
            this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
          },
        )
        .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
        .whereIn("pp.id", playerIds)
        .select(
          "pp.*",
          "au.username",
          "au.phone as account_phone",
          "ag.name as group_name",
        )
        .orderBy("pp.full_name", "asc"),
      this.repo
        .db("player_custom_values as pcv")
        .join("custom_fields as cf", "pcv.field_id", "cf.id")
        .leftJoin(
          "custom_field_options as cfo",
          "pcv.value_option_id",
          "cfo.id",
        )
        .whereIn("pcv.player_id", playerIds)
        .select(
          "pcv.player_id",
          "pcv.field_id",
          "cf.label",
          "cf.key",
          "cf.field_type",
          "cfo.label as option_label",
          "pcv.value_text",
          "pcv.value_long_text",
          "pcv.value_number",
          "pcv.value_decimal",
          "pcv.value_date",
          "pcv.value_boolean",
          "pcv.value_option_id",
          "pcv.value_json",
        ),
      this.repo
        .db("event_attendance as ea")
        .join("calendar_events as ce", "ea.event_id", "ce.id")
        .whereIn("ea.player_id", playerIds)
        .where("ce.event_type", "training")
        .groupBy("ea.player_id")
        .select(
          "ea.player_id",
          this.repo.db.raw("COUNT(*)::int as total"),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE ea.status = 'present')::int as present",
          ),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE ea.status = 'late')::int as late",
          ),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE ea.status = 'absent')::int as absent",
          ),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE ea.status = 'injured')::int as injured",
          ),
        ),
      this.repo
        .db("match_player_stats as mps")
        .whereIn("mps.player_id", playerIds)
        .groupBy("mps.player_id")
        .select(
          "mps.player_id",
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE mps.minutes_played > 0)::int as matches_played",
          ),
          this.repo.db.raw(
            "COALESCE(SUM(mps.minutes_played), 0)::int as minutes_played",
          ),
          this.repo.db.raw("COALESCE(SUM(mps.goals), 0)::int as goals"),
          this.repo.db.raw("COALESCE(SUM(mps.assists), 0)::int as assists"),
          this.repo.db.raw(
            "ROUND(AVG(mps.performance_rating), 2) as average_rating",
          ),
          this.repo.db.raw(
            "ROUND(AVG(mps.pass_accuracy_percentage), 2) as pass_accuracy_percentage",
          ),
          this.repo.db.raw("COALESCE(SUM(mps.tackles), 0)::int as tackles"),
        ),
      this.repo
        .db("match_player_incidents")
        .whereIn("player_id", playerIds)
        .where("incident_type", "injury")
        .groupBy("player_id")
        .select("player_id", this.repo.db.raw("COUNT(*)::int as injuries")),
      this.repo
        .db("player_event_evaluations as pee")
        .join("calendar_events as ce", "pee.event_id", "ce.id")
        .whereIn("pee.player_id", playerIds)
        .groupBy(
          "pee.player_id",
          this.repo.db.raw("date_trunc('month', ce.start_datetime)"),
        )
        .select(
          "pee.player_id",
          this.repo.db.raw(
            "to_char(date_trunc('month', ce.start_datetime), 'YYYY-MM') as month",
          ),
          this.repo.db.raw(
            "ROUND(AVG(pee.overall_rating), 2) as average_rating",
          ),
        )
        .orderBy("month", "asc"),
    ]);

    const byPlayer = (rows) =>
      rows.reduce((map, row) => {
        const list = map.get(row.player_id) || [];
        list.push(row);
        map.set(row.player_id, list);
        return map;
      }, new Map());
    const customByPlayer = byPlayer(customValues);
    const progressByPlayer = byPlayer(monthlyProgress);
    const attendanceByPlayer = new Map(
      trainingAttendance.map((row) => [row.player_id, row]),
    );
    const statsByPlayer = new Map(
      matchStats.map((row) => [row.player_id, row]),
    );
    const injuriesByPlayer = new Map(
      injuryCounts.map((row) => [row.player_id, row]),
    );
    const currentAttendance = new Map(
      (event.attendance || []).map((row) => [row.player_id, row]),
    );
    const currentEvaluation = new Map(
      (event.evaluations || []).map((row) => [row.player_id, row]),
    );

    const optionIds = new Set();
    customValues.forEach((row) => {
      if (row.value_option_id) optionIds.add(row.value_option_id);
      if (
        typeof row.value_text === "string" &&
        uuidPattern.test(row.value_text)
      ) {
        optionIds.add(row.value_text);
      }
      if (
        typeof row.value_json === "string" &&
        uuidPattern.test(row.value_json)
      ) {
        optionIds.add(row.value_json);
      }
      if (Array.isArray(row.value_json)) {
        row.value_json
          .filter(
            (value) => typeof value === "string" && uuidPattern.test(value),
          )
          .forEach((value) => optionIds.add(value));
      }
    });
    const optionRows = optionIds.size
      ? await this.repo
          .db("custom_field_options")
          .whereIn("id", [...optionIds])
          .select("id", "label")
      : [];
    const optionLabels = new Map(optionRows.map((row) => [row.id, row.label]));

    const valueOf = (row) => {
      if (row.option_label) return row.option_label;
      if (
        typeof row.value_text === "string" &&
        optionLabels.has(row.value_text)
      ) {
        return optionLabels.get(row.value_text);
      }
      if (
        typeof row.value_json === "string" &&
        optionLabels.has(row.value_json)
      ) {
        return optionLabels.get(row.value_json);
      }
      if (Array.isArray(row.value_json)) {
        const labels = row.value_json
          .map((value) => optionLabels.get(value) || value)
          .filter(Boolean);
        return labels.length ? labels.join(", ") : null;
      }
      return (
        row.value_text ??
        row.value_long_text ??
        row.value_number ??
        row.value_decimal ??
        row.value_date ??
        row.value_boolean ??
        row.value_json ??
        null
      );
    };

    return players.map((player) => ({
      ...player,
      attendance: currentAttendance.get(player.id) || null,
      evaluation: currentEvaluation.get(player.id) || null,
      customProfile: (customByPlayer.get(player.id) || []).map((row) => ({
        label: row.label,
        key: row.key,
        fieldType: row.field_type,
        value: valueOf(row),
      })),
      totals: {
        attendance: attendanceByPlayer.get(player.id) || {
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          injured: 0,
        },
        matches: statsByPlayer.get(player.id) || {
          matches_played: 0,
          minutes_played: 0,
          goals: 0,
          assists: 0,
          average_rating: null,
          pass_accuracy_percentage: null,
          tackles: 0,
        },
        injuries: Number(injuriesByPlayer.get(player.id)?.injuries || 0),
      },
      monthlyProgress: progressByPlayer.get(player.id) || [],
    }));
  }

  async _trainingEventWithParticipants(event, academyId) {
    return {
      ...event,
      participants: await this._trainingParticipants(event, academyId),
    };
  }

  async coachCreateTrainingEvent(userId, academyId, data) {
    const coach = await this._getCoach(userId, academyId);
    const targets = await this._resolveCoachTrainingTargets(
      coach,
      academyId,
      data,
      "can_create_training",
    );
    await this._validateAcademyGroups(targets.groupIds, academyId);
    await this._validateAcademyBirthYears(targets.birthYearIds, academyId);
    const start = combineDateTime(data.date, data.startTime);
    const end = combineDateTime(data.date, data.endTime);
    if (new Date(end) <= new Date(start))
      throw new BadRequestError("End time must be after start time");

    const event = await this.repo.db.transaction(async (trx) => {
      const row = await this.repo.createEventWithTargets(
        {
          academy_id: academyId,
          title: data.title,
          event_type: "training",
          start_datetime: start,
          end_datetime: end,
          location: data.location || null,
          status: "scheduled",
          visibility:
            targets.groupIds.length &&
            !targets.birthYearIds.length &&
            !targets.playerIds.length &&
            (data.allGroups ||
              normalizeTargetType(data.targetType) === "all_my_assigned_groups")
              ? "all_assigned_groups"
              : "selected_groups",
          created_by_user_id: userId,
          created_by_role: "coach",
          notes: data.notes || null,
        },
        targets,
        trx,
      );

      await trx("training_sessions").insert({
        event_id: row.id,
        coach_id: coach.id,
        training_focus: data.trainingFocus,
        intensity_level: data.intensityLevel,
        objectives: data.objectives || null,
        session_plan: data.sessionPlan || null,
        equipment_needed: data.equipmentNeeded || null,
        coach_notes: data.notes || null,
      });
      await this._notifyTrainingTargets(
        academyId,
        targets,
        "New training session",
        data.title,
        { eventId: row.id },
        trx,
      );
      return row;
    });

    await this._invalidateAttendanceCache(academyId);
    return this.repo.findEventById(event.id, academyId);
  }

  async coachGetTrainingEvent(userId, academyId, eventId) {
    const coach = await this._getCoach(userId, academyId);
    const { event } = await this._ensureCoachCanAccessEvent(
      coach,
      academyId,
      eventId,
    );
    if (event.event_type !== "training")
      throw new NotFoundError("Training event", eventId);
    const completed = await this._completeExpiredTrainingEvents(academyId, {
      eventId,
    });
    const activeEvent = completed.has(eventId)
      ? await this.repo.findEventById(eventId, academyId)
      : event;
    return this._trainingEventWithParticipants(activeEvent, academyId);
  }

  async coachUpdateTrainingEvent(userId, academyId, eventId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { event } = await this._ensureCoachCanAccessEvent(
      coach,
      academyId,
      eventId,
      "can_create_training",
    );
    if (event.created_by_user_id !== userId)
      throw new ForbiddenError(
        "Coach can only edit training events he created",
      );
    if (event.status === "cancelled")
      throw new BadRequestError("Cancelled events cannot be edited");
    if (event.status === "finished" || event.status === "completed")
      throw new BadRequestError("Closed training sessions cannot be edited");
    if (
      event.event_type === "training" &&
      data.endTime !== undefined &&
      new Date() >= trainingStartsAt(event) &&
      new Date() < trainingEndsAt(event)
    ) {
      throw new BadRequestError(
        "Use the training extension action to change a live training end time",
      );
    }

    let targets = null;
    if (
      data.targetType ||
      data.groupIds ||
      data.birthYearIds ||
      data.playerIds ||
      data.allGroups !== undefined ||
      data.allBirthYears !== undefined ||
      data.allPlayers !== undefined
    ) {
      targets = await this._resolveCoachTrainingTargets(
        coach,
        academyId,
        {
          targetType: data.targetType,
          groupIds:
            data.groupIds !== undefined
              ? data.groupIds
              : (event.groups || []).map((group) => group.id),
          birthYearIds:
            data.birthYearIds !== undefined
              ? data.birthYearIds
              : (event.birth_years || []).map((birthYear) => birthYear.id),
          playerIds:
            data.playerIds !== undefined
              ? data.playerIds
              : (event.players || []).map((player) => player.id),
          allGroups: data.allGroups,
          allBirthYears: data.allBirthYears,
          allPlayers: data.allPlayers,
        },
        "can_create_training",
      );
    }

    await this.repo.db.transaction(async (trx) => {
      const eventUpdate = {};
      if (data.title !== undefined) eventUpdate.title = data.title;
      if (data.date || data.startTime)
        eventUpdate.start_datetime = combineDateTime(
          data.date || event.start_datetime,
          data.startTime || timePart(event.start_datetime),
        );
      if (data.date || data.endTime)
        eventUpdate.end_datetime = combineDateTime(
          data.date || event.start_datetime,
          data.endTime || timePart(event.end_datetime),
        );
      if (data.location !== undefined)
        eventUpdate.location = data.location || null;
      if (data.notes !== undefined) eventUpdate.notes = data.notes || null;
      if (targets)
        eventUpdate.visibility =
          targets?.groupIds.length &&
          !targets.birthYearIds.length &&
          !targets.playerIds.length &&
          (data.allGroups ||
            normalizeTargetType(data.targetType) === "all_my_assigned_groups")
            ? "all_assigned_groups"
            : "selected_groups";
      if (Object.keys(eventUpdate).length)
        await trx("calendar_events")
          .where({ id: eventId })
          .update({ ...eventUpdate, updated_at: new Date() });

      const trainingUpdate = {};
      if (data.trainingFocus !== undefined)
        trainingUpdate.training_focus = data.trainingFocus;
      if (data.intensityLevel !== undefined)
        trainingUpdate.intensity_level = data.intensityLevel;
      if (data.objectives !== undefined)
        trainingUpdate.objectives = data.objectives || null;
      if (data.sessionPlan !== undefined)
        trainingUpdate.session_plan = data.sessionPlan || null;
      if (data.equipmentNeeded !== undefined)
        trainingUpdate.equipment_needed = data.equipmentNeeded || null;
      if (data.notes !== undefined)
        trainingUpdate.coach_notes = data.notes || null;
      if (Object.keys(trainingUpdate).length)
        await trx("training_sessions")
          .where({ event_id: eventId })
          .update({ ...trainingUpdate, updated_at: new Date() });
      if (targets) await this.repo.replaceEventTargets(eventId, targets, trx);
      const notifyTargets = targets || {
        groupIds: event.groups.map((group) => group.id),
        birthYearIds: (event.birth_years || []).map((row) => row.id),
        playerIds: (event.players || []).map((row) => row.id),
      };
      await this._notifyTrainingTargets(
        academyId,
        notifyTargets,
        "Training updated",
        event.title,
        { eventId },
        trx,
      );
    });

    await this._invalidateAttendanceCache(academyId);
    return this._trainingEventWithParticipants(
      await this.repo.findEventById(eventId, academyId),
      academyId,
    );
  }

  async coachUpdateTrainingEventStatus(userId, academyId, eventId, status) {
    const coach = await this._getCoach(userId, academyId);
    const { event } = await this._ensureCoachCanAccessEvent(
      coach,
      academyId,
      eventId,
      "can_create_training",
    );
    if (event.created_by_user_id !== userId)
      throw new ForbiddenError(
        "Coach can only update training events he created",
      );
    await this.repo
      .db("calendar_events")
      .where({ id: eventId })
      .update({
        status: calendarEventStatusForDb(status),
        updated_at: new Date(),
      });
    await this._notifyTrainingTargets(
      academyId,
      {
        groupIds: event.groups.map((group) => group.id),
        birthYearIds: (event.birth_years || []).map((row) => row.id),
        playerIds: (event.players || []).map((row) => row.id),
      },
      "Training status updated",
      `${event.title}: ${status}`,
      { eventId },
      this.repo.db,
      "attendance",
    );
    await this._invalidateAttendanceCache(academyId);
    return this._trainingEventWithParticipants(
      await this.repo.findEventById(eventId, academyId),
      academyId,
    );
  }

  async coachExtendTrainingEvent(userId, academyId, eventId, minutes) {
    const coach = await this._getCoach(userId, academyId);
    const { event } = await this._ensureCoachCanAccessEvent(
      coach,
      academyId,
      eventId,
      "can_create_training",
    );
    if (event.event_type !== "training")
      throw new NotFoundError("Training event", eventId);
    if (event.created_by_user_id !== userId)
      throw new ForbiddenError(
        "Coach can only extend training events he created",
      );
    if (event.status === "cancelled")
      throw new BadRequestError("Cancelled events cannot be extended");
    if (event.status === "finished" || event.status === "completed")
      throw new BadRequestError("Closed training sessions cannot be extended");

    const now = new Date();
    const startAt = trainingStartsAt(event);
    const currentEndAt = trainingEndsAt(event);
    if (now < startAt || now >= currentEndAt) {
      throw new BadRequestError(
        "Training can only be extended while it is open",
      );
    }

    await this.repo.db.transaction(async (trx) => {
      const training = await trx("training_sessions")
        .where({ event_id: eventId })
        .forUpdate()
        .first();
      if (!training) throw new NotFoundError("Training session", eventId);

      const originalEndAt = training.original_end_datetime
        ? new Date(training.original_end_datetime)
        : currentEndAt;
      const maxEndAt = addMinutes(originalEndAt, 60);
      const requestedEndAt = addMinutes(currentEndAt, minutes);
      const newEndAt = requestedEndAt > maxEndAt ? maxEndAt : requestedEndAt;
      if (newEndAt <= currentEndAt) {
        throw new BadRequestError("Training extension limit is one hour");
      }
      const extendedMinutes = Math.round(
        (newEndAt.getTime() - originalEndAt.getTime()) / 60000,
      );

      await trx("calendar_events").where({ id: eventId }).update({
        end_datetime: newEndAt,
        updated_at: now,
      });
      await trx("training_sessions")
        .where({ event_id: eventId })
        .update({
          original_end_datetime: training.original_end_datetime || currentEndAt,
          extended_minutes: extendedMinutes,
          last_extended_at: now,
          updated_at: now,
        });
    });

    return this._trainingEventWithParticipants(
      await this.repo.findEventById(eventId, academyId),
      academyId,
    );
  }

  _parseAttendanceQrPayload(data = {}) {
    const rawPayload =
      typeof data.payload === "string" ? data.payload.trim() : "";
    const compactPayload = rawPayload.replace(/\s+/g, "");
    let parsed = null;
    if (rawPayload) {
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        parsed = null;
      }
    }
    if (!parsed && rawPayload) {
      try {
        const url = new URL(rawPayload);
        parsed = {
          playerId:
            url.searchParams.get("playerId") ||
            url.searchParams.get("player_id") ||
            url.searchParams.get("id"),
          playerCode:
            url.searchParams.get("playerCode") ||
            url.searchParams.get("player_code") ||
            url.searchParams.get("code"),
          username: url.searchParams.get("username"),
        };
      } catch {
        parsed = null;
      }
    }

    const source =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : data;
    const playerId =
      source.playerId || source.player_id || source.id || data.playerId || null;
    const playerCode =
      source.playerCode ||
      source.player_code ||
      source.code ||
      data.playerCode ||
      null;
    const username = source.username || data.username || null;

    if (compactPayload && !parsed && uuidPattern.test(compactPayload)) {
      return {
        playerId: compactPayload,
        playerCode: null,
        username: null,
        signed: false,
      };
    }
    const visiblePlayerCode =
      !parsed && rawPayload.match(playerCodePattern)?.[0];
    if (visiblePlayerCode) {
      return {
        playerId: null,
        playerCode: visiblePlayerCode.toUpperCase(),
        username: null,
        signed: false,
      };
    }
    if (
      compactPayload &&
      !parsed &&
      compactPayload.toUpperCase().startsWith("PLY-")
    ) {
      return {
        playerId: null,
        playerCode: compactPayload.toUpperCase(),
        username: null,
        signed: false,
      };
    }
    if (rawPayload && !parsed) {
      return {
        playerId: null,
        playerCode: null,
        username: rawPayload,
        signed: false,
      };
    }

    const signed = source.type === QR_ATTENDANCE_TYPE || Boolean(source.sig);
    return {
      playerId: playerId ? String(playerId).trim() : null,
      playerCode: playerCode ? String(playerCode).trim() : null,
      username: username ? String(username).trim() : null,
      signature: source.sig ? String(source.sig).trim() : null,
      academyId: source.academyId || source.academy_id || null,
      type: source.type || null,
      version: source.v || source.version || null,
      signed,
    };
  }

  _buildAttendanceQrPayload({ academyId, player }) {
    const playerCode = player.player_code || null;
    if (playerCode) return playerCode;
    if (player.username) return player.username;
    const payload = {
      type: QR_ATTENDANCE_TYPE,
      v: QR_ATTENDANCE_VERSION,
      academyId,
      playerId: player.id,
      playerCode,
      username: player.username || null,
      sig: attendanceQrSignature({
        academyId,
        playerId: player.id,
        playerCode,
      }),
    };
    return JSON.stringify(payload);
  }

  async _resolveAttendanceQrPlayer(academyId, data) {
    const parsed = this._parseAttendanceQrPayload(data);
    if (!parsed.playerId && !parsed.playerCode && !parsed.username) {
      throw new BadRequestError("QR payload does not identify a player");
    }
    if (parsed.signed && parsed.type !== QR_ATTENDANCE_TYPE) {
      throw new BadRequestError("QR payload is not a Goalix attendance QR");
    }
    if (
      parsed.signed &&
      parsed.version &&
      Number(parsed.version) !== QR_ATTENDANCE_VERSION
    ) {
      throw new BadRequestError("QR payload version is not supported");
    }
    if (parsed.signed && parsed.academyId && parsed.academyId !== academyId) {
      throw new ForbiddenError("QR player belongs to another academy");
    }

    const playerQuery = this.repo
      .db("player_profiles as pp")
      .leftJoin("auth_users as au", "pp.user_id", "au.id")
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .select(
        "pp.id",
        "pp.full_name",
        "pp.player_code",
        "pp.user_id",
        "au.username",
      );

    if (parsed.playerId) playerQuery.where("pp.id", parsed.playerId);
    if (parsed.playerCode)
      playerQuery.where("pp.player_code", parsed.playerCode);
    if (!parsed.playerId && !parsed.playerCode && parsed.username) {
      playerQuery.where("au.username", parsed.username);
    }

    const player = await playerQuery.first();
    if (!player) throw new NotFoundError("QR player");

    if (parsed.signed) {
      const signaturePayload = {
        academyId,
        playerId: player.id,
        playerCode: player.player_code || null,
      };
      if (!isValidAttendanceQrSignature(parsed.signature, signaturePayload)) {
        throw new BadRequestError("QR signature is invalid");
      }
    }

    return player;
  }

  async coachScanEventAttendanceQr(userId, academyId, eventId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { event, groupIds, birthYearIds, playerIds } =
      await this._ensureCoachCanAccessEvent(
        coach,
        academyId,
        eventId,
        "can_take_attendance",
      );
    this._ensureTrainingEventOpen(event);

    const player = await this._resolveAttendanceQrPlayer(academyId, data);
    await this._ensurePlayersInEventTargets(
      [player.id],
      { groupIds, birthYearIds, directPlayerIds: playerIds },
      academyId,
    );

    const existing = await this.repo
      .db("event_attendance")
      .where({ event_id: eventId, player_id: player.id })
      .first();
    const arrivalTime = timePartInTimeZone(new Date());
    const [attendance] = await this.repo
      .db("event_attendance")
      .insert({
        event_id: eventId,
        player_id: player.id,
        status: "present",
        arrival_time: arrivalTime,
        marked_by_coach_id: coach.id,
        reason: null,
        notes: "QR scan",
      })
      .onConflict(["event_id", "player_id"])
      .merge({
        status: "present",
        arrival_time: arrivalTime,
        marked_by_coach_id: coach.id,
        reason: null,
        notes: this.repo.db.raw("excluded.notes"),
        updated_at: new Date(),
      })
      .returning("*");

    await this._refreshInjuryRiskMonthlyAttendance(
      academyId,
      [player.id],
      event.start_datetime,
    );
    await this._invalidateAttendanceCache(academyId);
    if (existing?.status !== "present") {
      await this._notifyPlayerAttendanceCheckedIn(
        player,
        "Training attendance recorded",
        `You are checked in for ${event.title}.`,
        "attendance",
        { eventId },
      );
    }

    return {
      playerId: player.id,
      playerName: player.full_name,
      status: attendance.status,
      arrivalTime: attendance.arrival_time,
      alreadyMarked: existing?.status === "present",
      attendance,
    };
  }

  async coachUpsertEventAttendance(userId, academyId, eventId, records) {
    const coach = await this._getCoach(userId, academyId);
    const { event, groupIds, birthYearIds, playerIds } =
      await this._ensureCoachCanAccessEvent(
        coach,
        academyId,
        eventId,
        "can_take_attendance",
      );
    this._ensureTrainingEventCanReceiveAttendance(event, records);
    await this._ensurePlayersInEventTargets(
      records.map((record) => record.playerId),
      { groupIds, birthYearIds, directPlayerIds: playerIds },
      academyId,
    );

    const rows = records.map((record) => ({
      event_id: eventId,
      player_id: record.playerId,
      status: record.status,
      arrival_time: record.arrivalTime || null,
      marked_by_coach_id: coach.id,
      reason: record.reason || null,
      notes: record.notes || null,
    }));

    const result = await this.repo
      .db("event_attendance")
      .insert(rows)
      .onConflict(["event_id", "player_id"])
      .merge({
        status: this.repo.db.raw("excluded.status"),
        arrival_time: this.repo.db.raw("excluded.arrival_time"),
        marked_by_coach_id: this.repo.db.raw("excluded.marked_by_coach_id"),
        reason: this.repo.db.raw("excluded.reason"),
        notes: this.repo.db.raw("excluded.notes"),
        updated_at: new Date(),
      })
      .returning("*");
    await this._notifyTrainingTargets(
      academyId,
      { groupIds, birthYearIds, playerIds },
      "Attendance marked",
      event.title,
      { eventId },
      this.repo.db,
      "evaluation",
    );
    await this._refreshInjuryRiskMonthlyAttendance(
      academyId,
      records.map((record) => record.playerId),
      event.start_datetime,
    );
    await this._invalidateAttendanceCache(academyId);
    return result;
  }

  async coachUpdateEventAttendance(userId, academyId, eventId, playerId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { event, groupIds, birthYearIds, playerIds } =
      await this._ensureCoachCanAccessEvent(
        coach,
        academyId,
        eventId,
        "can_take_attendance",
      );
    this._ensureTrainingEventCanReceiveAttendance(event, [
      { playerId, status: data.status, arrivalTime: data.arrivalTime },
    ]);
    await this._ensurePlayersInEventTargets(
      [playerId],
      { groupIds, birthYearIds, directPlayerIds: playerIds },
      academyId,
    );
    const [row] = await this.repo
      .db("event_attendance")
      .where({ event_id: eventId, player_id: playerId })
      .update({
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.arrivalTime !== undefined
          ? { arrival_time: data.arrivalTime }
          : {}),
        ...(data.reason !== undefined ? { reason: data.reason } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        marked_by_coach_id: coach.id,
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) throw new NotFoundError("Attendance record");
    await this._refreshInjuryRiskMonthlyAttendance(
      academyId,
      [playerId],
      event.start_datetime,
    );
    await this._invalidateAttendanceCache(academyId);
    return row;
  }

  async coachUpsertEventEvaluations(userId, academyId, eventId, records) {
    const coach = await this._getCoach(userId, academyId);
    const { event, groupIds, birthYearIds, playerIds } =
      await this._ensureCoachCanAccessEvent(
        coach,
        academyId,
        eventId,
        "can_evaluate_players",
      );
    this._ensureTrainingEventCanReceiveEvaluation(event);
    await this._ensurePlayersInEventTargets(
      records.map((record) => record.playerId),
      { groupIds, birthYearIds, directPlayerIds: playerIds },
      academyId,
      { requireComplete: true },
    );

    const rows = records.map((record) => ({
      event_id: eventId,
      player_id: record.playerId,
      coach_id: coach.id,
      overall_rating: record.overallRating ?? null,
      technical_rating: record.technicalRating ?? null,
      tactical_rating: record.tacticalRating ?? null,
      physical_rating: record.physicalRating ?? null,
      fatigue_rating: record.fatigueRating ?? null,
      mentality_rating: record.mentalityRating ?? null,
      discipline_rating: record.disciplineRating ?? null,
      teamwork_rating: record.teamworkRating ?? null,
      impact_rating: record.impactRating ?? null,
      ball_control_rating: record.ballControlRating ?? null,
      passing_accuracy_rating: record.passingAccuracyRating ?? null,
      shooting_rating: record.shootingRating ?? null,
      dribbling_rating: record.dribblingRating ?? null,
      receiving_under_pressure_rating:
        record.receivingUnderPressureRating ?? null,
      speed_rating: record.speedRating ?? null,
      endurance_rating: record.enduranceRating ?? null,
      strength_rating: record.strengthRating ?? null,
      agility_rating: record.agilityRating ?? null,
      strengths: record.strengths || null,
      weaknesses: record.weaknesses || null,
      coach_notes: record.coachNotes || null,
      improvement_plan: record.improvementPlan || null,
      development_notes: record.developmentNotes || null,
      visibility: record.visibility,
    }));
    const result = await this.repo
      .db("player_event_evaluations")
      .insert(rows)
      .onConflict(["event_id", "player_id", "coach_id"])
      .merge()
      .returning("*");
    const publishedPlayerIds = result
      .filter((row) => row.visibility === "player_and_parent")
      .map((row) => row.player_id);
    if (publishedPlayerIds.length) {
      await this._notifyTrainingTargets(
        academyId,
        { playerIds: publishedPlayerIds },
        "Player evaluation published",
        event.title,
        { eventId },
        this.repo.db,
        "evaluation",
      );
    }
    return result;
  }

  async coachUpdateEvaluation(userId, academyId, evaluationId, data) {
    const coach = await this._getCoach(userId, academyId);
    const evaluation = await this.repo
      .db("player_event_evaluations")
      .where({ id: evaluationId, coach_id: coach.id })
      .first("event_id");
    if (!evaluation) throw new NotFoundError("Evaluation", evaluationId);
    await this._ensureCoachCanAccessEvent(
      coach,
      academyId,
      evaluation.event_id,
      "can_evaluate_players",
    );
    const [row] = await this.repo
      .db("player_event_evaluations")
      .where({ id: evaluationId, coach_id: coach.id })
      .update({
        ...(data.overallRating !== undefined
          ? { overall_rating: data.overallRating }
          : {}),
        ...(data.technicalRating !== undefined
          ? { technical_rating: data.technicalRating }
          : {}),
        ...(data.tacticalRating !== undefined
          ? { tactical_rating: data.tacticalRating }
          : {}),
        ...(data.physicalRating !== undefined
          ? { physical_rating: data.physicalRating }
          : {}),
        ...(data.fatigueRating !== undefined
          ? { fatigue_rating: data.fatigueRating }
          : {}),
        ...(data.mentalityRating !== undefined
          ? { mentality_rating: data.mentalityRating }
          : {}),
        ...(data.disciplineRating !== undefined
          ? { discipline_rating: data.disciplineRating }
          : {}),
        ...(data.teamworkRating !== undefined
          ? { teamwork_rating: data.teamworkRating }
          : {}),
        ...(data.impactRating !== undefined
          ? { impact_rating: data.impactRating }
          : {}),
        ...(data.ballControlRating !== undefined
          ? { ball_control_rating: data.ballControlRating }
          : {}),
        ...(data.passingAccuracyRating !== undefined
          ? { passing_accuracy_rating: data.passingAccuracyRating }
          : {}),
        ...(data.shootingRating !== undefined
          ? { shooting_rating: data.shootingRating }
          : {}),
        ...(data.dribblingRating !== undefined
          ? { dribbling_rating: data.dribblingRating }
          : {}),
        ...(data.receivingUnderPressureRating !== undefined
          ? {
              receiving_under_pressure_rating:
                data.receivingUnderPressureRating,
            }
          : {}),
        ...(data.speedRating !== undefined
          ? { speed_rating: data.speedRating }
          : {}),
        ...(data.enduranceRating !== undefined
          ? { endurance_rating: data.enduranceRating }
          : {}),
        ...(data.strengthRating !== undefined
          ? { strength_rating: data.strengthRating }
          : {}),
        ...(data.agilityRating !== undefined
          ? { agility_rating: data.agilityRating }
          : {}),
        ...(data.strengths !== undefined ? { strengths: data.strengths } : {}),
        ...(data.weaknesses !== undefined
          ? { weaknesses: data.weaknesses }
          : {}),
        ...(data.coachNotes !== undefined
          ? { coach_notes: data.coachNotes }
          : {}),
        ...(data.improvementPlan !== undefined
          ? { improvement_plan: data.improvementPlan }
          : {}),
        ...(data.developmentNotes !== undefined
          ? { development_notes: data.developmentNotes }
          : {}),
        ...(data.visibility !== undefined
          ? { visibility: data.visibility }
          : {}),
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) throw new NotFoundError("Evaluation", evaluationId);
    return row;
  }

  async coachListMatches(userId, academyId, filters) {
    const coach = await this._getCoach(userId, academyId);
    await this._finalizeOverdueMatches(academyId);
    const groupIds = await this._getCoachVisibleGroupIds(coach.id, academyId);
    const birthYearIds = (
      await this.repo.findCoachAccessibleBirthYears(coach.id, academyId)
    ).map((row) => row.id);
    if (!groupIds.length && !birthYearIds.length)
      return { data: [], total: 0, page: filters.page || 1, totalPages: 1 };
    const result = await this.repo.paginate(
      this.repo.matchListQuery(academyId, {
        ...filters,
        groupIds,
        birthYearIds,
      }),
      filters,
      "m.id",
    );
    const notifiedMatches = await this._notifyMatchDayIfDue(
      academyId,
      result.data,
    );
    if (notifiedMatches.size) {
      result.data = result.data.map((match) =>
        notifiedMatches.has(match.id)
          ? {
              ...match,
              match_day_notified_at: notifiedMatches.get(match.id),
            }
          : match,
      );
    }
    return result;
  }

  async coachRankingSystemInputs(userId, academyId, filters) {
    const coach = await this._getCoach(userId, academyId);
    const [groupIds, birthYears, scopedPlayers] = await Promise.all([
      this._getCoachVisibleGroupIds(coach.id, academyId),
      this.repo.findCoachAccessibleBirthYears(coach.id, academyId),
      this.repo.findCoachScopedPlayers(coach.id, academyId),
    ]);

    return this._rankingSystemInputsForScope(academyId, filters, {
      coach,
      groupIds,
      birthYearIds: birthYears.map((row) => row.id),
      scopedPlayers,
      requireAssignedScope: true,
      notifyCoach: true,
    });
  }

  async adminRankingSystemInputs(academyId, filters) {
    const scopedPlayers = await this.repo.findAcademyRankingPlayers(academyId, {
      groupId: filters.groupId || null,
    });

    return this._rankingSystemInputsForScope(academyId, filters, {
      groupIds: filters.groupId ? [filters.groupId] : [],
      birthYearIds: [],
      scopedPlayers,
      requireAssignedScope: false,
      notifyCoach: false,
    });
  }

  async playerRankingSystemInputs(userId, academyId, filters) {
    const player = await this.repo.findPlayerByUserId(userId);
    if (!player || player.academy_id !== academyId) {
      throw new NotFoundError("Player profile");
    }
    const assignment = await this.repo
      .db("player_group_assignments")
      .where({ player_id: player.id })
      .whereNull("left_at")
      .first("group_id");
    const groupId = filters.groupId || assignment?.group_id || null;
    const scopedPlayers = groupId
      ? await this.repo.findAcademyRankingPlayers(academyId, { groupId })
      : [player];

    return this._rankingSystemInputsForScope(academyId, filters, {
      groupIds: groupId ? [groupId] : [],
      birthYearIds: [],
      scopedPlayers,
      requireAssignedScope: false,
      notifyCoach: false,
    });
  }

  async parentRankingSystemInputs(userId, academyId, filters) {
    const children = await this.repo.findParentLinkedPlayers(userId, academyId);
    const child = filters.childId
      ? children.find((item) => item.id === filters.childId)
      : children[0];
    if (!child) throw new NotFoundError("Linked player");
    if (child.can_view_progress === false) {
      throw new ForbiddenError("Progress access is not enabled for this child");
    }
    const groupId = child.group_id || null;
    const scopedPlayers = groupId
      ? await this.repo.findAcademyRankingPlayers(academyId, { groupId })
      : [child];

    return this._rankingSystemInputsForScope(academyId, filters, {
      groupIds: groupId ? [groupId] : [],
      birthYearIds: [],
      scopedPlayers,
      requireAssignedScope: false,
      notifyCoach: false,
    });
  }

  async _rankingSystemInputsForScope(academyId, filters, scope = {}) {
    const { page, limit, offset } = normalizePagination({
      page: filters.page,
      limit: filters.limit || 100,
    });
    const matchScoreForRow = (row) => {
      const baseScore = ratingToScore(row.match_base_rating);
      const fallback = () => {
        if (row.role_family === "attack") {
          return (
            Number(row.shots_on_target || 0) * 10 +
            Number(row.key_passes || 0) * 5
          );
        }
        if (row.role_family === "midfield") {
          return (
            scoreOrZero(row.pass_accuracy) * 0.45 +
            Number(row.key_passes || 0) * 4 +
            Number(row.duels || 0) * 2
          );
        }
        if (row.role_family === "defense") {
          return (
            Number(row.defensive_tackles || 0) * 6 +
            Number(row.interceptions || 0) * 6 +
            Number(row.duels || 0) * 2 +
            scoreOrZero(ratingToScore(row.positioning_rating)) * 0.45
          );
        }
        if (row.role_family === "goalkeeper") {
          return (
            Number(row.saves || 0) * 8 +
            scoreOrZero(ratingToScore(row.shot_stopping)) * 0.45 +
            scoreOrZero(row.distribution_accuracy) * 0.3
          );
        }
        return baseScore;
      };
      const base = baseScore ?? fallback() ?? 0;
      if (row.role_family === "attack") {
        return clampScore(
          base + Number(row.goals || 0) * 5 + Number(row.assists || 0) * 4,
        );
      }
      if (row.role_family === "midfield") {
        return clampScore(
          base + Number(row.goals || 0) * 6 + Number(row.assists || 0) * 5,
        );
      }
      if (row.role_family === "defense") {
        return clampScore(
          base + Number(row.goals || 0) * 8 + Number(row.clean_sheets || 0) * 6,
        );
      }
      if (row.role_family === "goalkeeper") {
        return clampScore(
          base +
            Number(row.clean_sheets || 0) * 8 -
            Number(row.handling_errors || 0) * 5,
        );
      }
      return clampScore(base);
    };
    const customMainPosition = (playerId, customByPlayer) => {
      const customProfile = customByPlayer.get(playerId) || [];
      const field = customProfile.find(
        (item) =>
          normalizeKey(item.key) === "main_position" ||
          normalizeKey(item.label) === "main_position",
      );
      const value = field?.value;
      if (value === null || value === undefined) return null;
      if (Array.isArray(value)) return value.filter(Boolean).join(", ") || null;
      return String(value).trim() || null;
    };
    const {
      coach = null,
      groupIds = [],
      birthYearIds = [],
      scopedPlayers = [],
      requireAssignedScope = false,
      notifyCoach = false,
    } = scope;

    if (requireAssignedScope && !groupIds.length && !birthYearIds.length) {
      return { data: [], total: 0, page, totalPages: 1 };
    }

    const accessibleMatchIds = this.repo
      .matchListQuery(academyId, {
        ...(groupIds.length ? { groupIds } : {}),
        ...(birthYearIds.length ? { birthYearIds } : {}),
      })
      .clearSelect()
      .clearOrder()
      .select("m.id");

    const playerIds = scopedPlayers.map((player) => player.id);
    if (!playerIds.length) {
      return { data: [], total: 0, page, totalPages: 1 };
    }
    const customByPlayer = await this._playerCustomProfilesByPlayer(playerIds);
    const playersWithMainPosition = scopedPlayers.map((player) => ({
      ...player,
      main_position: customMainPosition(player.id, customByPlayer),
    }));
    const playerById = new Map(
      playersWithMainPosition.map((player) => [player.id, player]),
    );

    const [
      matchRows,
      trainingRows,
      dailyRows,
      trainingAttendanceRows,
      matchAttendanceRows,
    ] = await Promise.all([
      this.repo
        .db("match_player_stats as mps")
        .join("matches as m", "mps.match_id", "m.id")
        .leftJoin("match_squads as ms", function joinSquadSnapshot() {
          this.on("ms.match_id", "=", "mps.match_id").andOn(
            "ms.player_id",
            "=",
            "mps.player_id",
          );
        })
        .join("player_profiles as pp", "mps.player_id", "pp.id")
        .whereIn("mps.match_id", accessibleMatchIds)
        .whereIn("mps.player_id", playerIds)
        .whereNotNull("m.evaluations_finalized_at")
        .whereNull("m.deleted_at")
        .select(
          "mps.*",
          "m.opponent_name",
          "m.match_date",
          "m.match_time",
          "m.our_score",
          "m.opponent_score",
          "ms.position",
          "ms.squad_role",
          "pp.position as profile_position",
          this.repo.db.raw(
            "COALESCE(ms.player_name_snapshot, pp.full_name) as player_name",
          ),
          this.repo.db.raw(
            "date_trunc('week', m.match_date::timestamp)::date::text as week_start",
          ),
          this.repo.db.raw(
            "(date_trunc('week', m.match_date::timestamp)::date + interval '6 days')::date::text as week_end",
          ),
        ),
      playerIds.length
        ? this.repo
            .db("player_event_evaluations as pee")
            .join("calendar_events as ce", "pee.event_id", "ce.id")
            .join("player_profiles as pp", "pee.player_id", "pp.id")
            .whereIn("pee.player_id", playerIds)
            .where("ce.academy_id", academyId)
            .where("ce.event_type", "training")
            .whereNull("ce.deleted_at")
            .whereNot("ce.status", "cancelled")
            .select(
              "pee.id",
              "pee.event_id",
              "pee.player_id",
              "pp.full_name as player_name",
              "pp.position as profile_position",
              "pee.technical_rating",
              "pee.tactical_rating",
              "pee.physical_rating",
              "pee.mentality_rating",
              "pee.ball_control_rating",
              "pee.passing_accuracy_rating",
              "pee.shooting_rating",
              "pee.dribbling_rating",
              "pee.receiving_under_pressure_rating",
              "pee.speed_rating",
              "pee.endurance_rating",
              "pee.fatigue_rating",
              "pee.strength_rating",
              "pee.agility_rating",
              "ce.title",
              "ce.start_datetime",
              this.repo.db.raw(
                "date_trunc('week', ce.start_datetime)::date::text as week_start",
              ),
              this.repo.db.raw(
                "(date_trunc('week', ce.start_datetime)::date + interval '6 days')::date::text as week_end",
              ),
            )
        : [],
      playerIds.length
        ? this.repo
            .db("player_daily_ai_inputs as pdai")
            .join("player_profiles as pp", "pdai.player_id", "pp.id")
            .whereIn("pdai.player_id", playerIds)
            .where("pdai.academy_id", academyId)
            .select(
              "pdai.id",
              "pdai.player_id",
              "pp.full_name as player_name",
              "pdai.input_date",
              "pdai.sleep_hours",
              "pdai.trained_today",
              "pdai.meals_count",
              "pdai.daily_ai_score",
              this.repo.db.raw(
                "date_trunc('week', pdai.input_date::timestamp)::date::text as week_start",
              ),
              this.repo.db.raw(
                "(date_trunc('week', pdai.input_date::timestamp)::date + interval '6 days')::date::text as week_end",
              ),
            )
        : [],
      playerIds.length
        ? this.repo
            .db("event_attendance as ea")
            .join("calendar_events as ce", "ea.event_id", "ce.id")
            .whereIn("ea.player_id", playerIds)
            .where("ce.academy_id", academyId)
            .where("ce.event_type", "training")
            .whereNull("ce.deleted_at")
            .whereNot("ce.status", "cancelled")
            .select(
              "ea.player_id",
              "ea.status",
              "ce.start_datetime",
              this.repo.db.raw(
                "date_trunc('week', ce.start_datetime)::date::text as week_start",
              ),
              this.repo.db.raw(
                "(date_trunc('week', ce.start_datetime)::date + interval '6 days')::date::text as week_end",
              ),
            )
        : [],
      playerIds.length
        ? this.repo
            .db("match_attendance as ma")
            .join("matches as m", "ma.match_id", "m.id")
            .join("calendar_events as ce", "m.event_id", "ce.id")
            .whereIn("ma.player_id", playerIds)
            .where("ce.academy_id", academyId)
            .whereNull("m.deleted_at")
            .whereNull("ce.deleted_at")
            .whereNot("m.status", "cancelled")
            .whereNot("m.match_status", "cancelled")
            .select(
              "ma.player_id",
              "ma.status",
              "m.match_date",
              this.repo.db.raw(
                "date_trunc('week', m.match_date::timestamp)::date::text as week_start",
              ),
              this.repo.db.raw(
                "(date_trunc('week', m.match_date::timestamp)::date + interval '6 days')::date::text as week_end",
              ),
            )
        : [],
    ]);

    const buckets = new Map();
    const getBucket = ({
      playerId,
      playerName,
      position,
      weekStart,
      weekEnd,
    }) => {
      const key = `${weekStart}:${playerId}`;
      if (!buckets.has(key)) {
        const player = playerById.get(playerId);
        const fallbackPosition =
          position || player?.main_position || player?.position || null;
        buckets.set(key, {
          id: key,
          player_id: playerId,
          player_name: playerName || player?.full_name || "Player",
          week_start: weekStart,
          week_end: weekEnd,
          position: fallbackPosition,
          role_family: roleFamily(fallbackPosition),
          latest_match_at: 0,
          match_ids: new Set(),
          training_event_ids: new Set(),
          daily_input_dates: new Set(),
          clean_sheet_match_ids: new Set(),
          base_values: {
            technical: [],
            tactical: [],
            physical: [],
            mentality: [],
            decision_making: [],
            work_rate: [],
            positioning: [],
          },
          role_values: {
            pass_accuracy: [],
            shot_stopping: [],
            distribution_accuracy: [],
          },
          match_values: {
            performance_rating: [],
          },
          shots_on_target: 0,
          key_passes: 0,
          goals: 0,
          assists: 0,
          duels: 0,
          defensive_tackles: 0,
          interceptions: 0,
          saves: 0,
          handling_errors: 0,
          daily_values: {
            sleep_hours: [],
            trained_today: [],
            meals_count: [],
            daily_ai_score: [],
          },
          attendance_total: 0,
          attendance_attended: 0,
        });
      }
      return buckets.get(key);
    };

    matchRows.forEach((row) => {
      const player = playerById.get(row.player_id);
      const position =
        row.position || row.profile_position || player?.main_position || null;
      const bucket = getBucket({
        playerId: row.player_id,
        playerName: row.player_name,
        position,
        weekStart: row.week_start,
        weekEnd: row.week_end,
      });
      const matchAt = new Date(
        `${datePart(row.match_date)}T${timePart(row.match_time) || "00:00"}:00`,
      ).getTime();
      if (matchAt >= bucket.latest_match_at && position) {
        bucket.position = position;
        bucket.role_family = roleFamily(position);
        bucket.latest_match_at = matchAt;
      }
      bucket.match_ids.add(row.match_id);
      addOptionValue(
        bucket.base_values.technical,
        row.technical_rating,
        "rating10",
        {
          zeroMeansMissing: true,
        },
      );
      addOptionValue(
        bucket.base_values.tactical,
        row.tactical_rating,
        "rating10",
        {
          zeroMeansMissing: true,
        },
      );
      addOptionValue(
        bucket.base_values.physical,
        row.physical_rating,
        "rating10",
        {
          zeroMeansMissing: true,
        },
      );
      addOptionValue(
        bucket.base_values.mentality,
        row.mentality_rating,
        "rating10",
        {
          zeroMeansMissing: true,
        },
      );
      addOptionValue(
        bucket.base_values.decision_making,
        row.decision_making_rating,
        "rating10",
        { zeroMeansMissing: true },
      );
      addOptionValue(
        bucket.base_values.work_rate,
        row.work_rate_rating,
        "rating10",
        {
          zeroMeansMissing: true,
        },
      );
      addOptionValue(
        bucket.base_values.positioning,
        row.positioning_rating,
        "rating10",
        { zeroMeansMissing: true },
      );
      addOptionValue(
        bucket.role_values.pass_accuracy,
        row.pass_accuracy_percentage,
        "percentage",
      );
      addValue(bucket.match_values.performance_rating, row.performance_rating);
      if (roleFamily(position) === "goalkeeper") {
        addOptionValue(
          bucket.role_values.shot_stopping,
          row.technical_rating,
          "rating10",
          { zeroMeansMissing: true },
        );
        addOptionValue(
          bucket.role_values.distribution_accuracy,
          row.pass_accuracy_percentage,
          "percentage",
        );
      }
      bucket.shots_on_target +=
        optionMidpoint(row.shots_on_target, "chance") || 0;
      bucket.key_passes += optionMidpoint(row.key_passes, "chance") || 0;
      bucket.goals += Number(row.goals || 0);
      bucket.assists += Number(row.assists || 0);
      bucket.duels += optionMidpoint(row.duels_won, "duels") || 0;
      bucket.defensive_tackles +=
        optionMidpoint(row.defensive_tackles, "defensiveCount") || 0;
      bucket.interceptions +=
        optionMidpoint(row.interceptions, "defensiveCount") || 0;
      bucket.saves += optionMidpoint(row.saves, "defensiveCount") || 0;
      bucket.handling_errors +=
        optionMidpoint(row.possession_losses, "possessionLoss") || 0;
      if (row.opponent_score !== null && Number(row.opponent_score) === 0) {
        bucket.clean_sheet_match_ids.add(row.match_id);
      }
    });

    trainingRows.forEach((row) => {
      const player = playerById.get(row.player_id);
      const bucket = getBucket({
        playerId: row.player_id,
        playerName: row.player_name,
        position: row.profile_position || player?.main_position || null,
        weekStart: row.week_start,
        weekEnd: row.week_end,
      });
      bucket.training_event_ids.add(row.event_id);
      const trainingTechnical =
        optionMidpoint(row.technical_rating, "rating10", {
          zeroMeansMissing: true,
        }) ??
        avgOptionValues(
          [
            row.ball_control_rating,
            row.passing_accuracy_rating,
            row.shooting_rating,
            row.dribbling_rating,
            row.receiving_under_pressure_rating,
          ],
          "rating10",
          { zeroMeansMissing: true },
        );
      const trainingTactical =
        optionMidpoint(row.tactical_rating, "rating10", {
          zeroMeansMissing: true,
        }) ??
        avgOptionValues(
          [row.passing_accuracy_rating, row.receiving_under_pressure_rating],
          "rating10",
          { zeroMeansMissing: true },
        );
      const trainingPhysical =
        optionMidpoint(row.physical_rating, "rating10", {
          zeroMeansMissing: true,
        }) ??
        avgOptionValues(
          [
            row.speed_rating,
            row.endurance_rating,
            row.strength_rating,
            row.agility_rating,
          ],
          "rating10",
          { zeroMeansMissing: true },
        );
      const trainingMentality =
        optionMidpoint(row.mentality_rating, "rating10", {
          zeroMeansMissing: true,
        }) ??
        avgOptionValues(
          [row.endurance_rating, row.fatigue_rating, row.strength_rating],
          "rating10",
          { zeroMeansMissing: true },
        );
      const trainingDecisionMaking = avgOptionValues(
        [row.receiving_under_pressure_rating, row.passing_accuracy_rating],
        "rating10",
        { zeroMeansMissing: true },
      );
      const trainingWorkRate = avgOptionValues(
        [row.endurance_rating, row.strength_rating],
        "rating10",
        { zeroMeansMissing: true },
      );
      const trainingPositioning = avgOptionValues(
        [row.receiving_under_pressure_rating],
        "rating10",
        { zeroMeansMissing: true },
      );
      addValue(bucket.base_values.technical, trainingTechnical);
      addValue(bucket.base_values.tactical, trainingTactical);
      addValue(bucket.base_values.physical, trainingPhysical);
      addValue(bucket.base_values.mentality, trainingMentality);
      addValue(bucket.base_values.decision_making, trainingDecisionMaking);
      addValue(bucket.base_values.work_rate, trainingWorkRate);
      addValue(bucket.base_values.positioning, trainingPositioning);
    });

    dailyRows.forEach((row) => {
      const player = playerById.get(row.player_id);
      const bucket = getBucket({
        playerId: row.player_id,
        playerName: row.player_name,
        position: player?.main_position || player?.position || null,
        weekStart: row.week_start,
        weekEnd: row.week_end,
      });
      bucket.daily_input_dates.add(datePart(row.input_date));
      addValue(bucket.daily_values.sleep_hours, row.sleep_hours);
      addValue(bucket.daily_values.trained_today, row.trained_today);
      addValue(bucket.daily_values.meals_count, row.meals_count);
      addValue(bucket.daily_values.daily_ai_score, row.daily_ai_score);
    });

    const addAttendance = (row) => {
      const player = playerById.get(row.player_id);
      const bucket = getBucket({
        playerId: row.player_id,
        playerName: player?.full_name,
        position: player?.main_position || player?.position || null,
        weekStart: row.week_start,
        weekEnd: row.week_end,
      });
      bucket.attendance_total += 1;
      if (["present", "late"].includes(String(row.status || ""))) {
        bucket.attendance_attended += 1;
      }
    };
    trainingAttendanceRows.forEach(addAttendance);
    matchAttendanceRows.forEach(addAttendance);

    const inputRows = [...buckets.values()].map((bucket) => ({
      id: bucket.id,
      player_id: bucket.player_id,
      player_name: bucket.player_name,
      week_start: bucket.week_start,
      week_end: bucket.week_end,
      position: bucket.position,
      role_family: bucket.role_family,
      match_evaluation_count: bucket.match_ids.size,
      training_evaluation_count: bucket.training_event_ids.size,
      daily_ai_input_count: bucket.daily_input_dates.size,
      technical_rating: avg(bucket.base_values.technical),
      tactical_rating: avg(bucket.base_values.tactical),
      physical_rating: avg(bucket.base_values.physical),
      mentality_rating: avg(bucket.base_values.mentality),
      decision_making_rating: avg(bucket.base_values.decision_making),
      work_rate_rating: avg(bucket.base_values.work_rate),
      positioning_rating: avg(bucket.base_values.positioning),
      shots_on_target: bucket.shots_on_target,
      key_passes: bucket.key_passes,
      goals: bucket.goals,
      assists: bucket.assists,
      pass_accuracy: avg(bucket.role_values.pass_accuracy),
      duels: bucket.duels,
      defensive_tackles: bucket.defensive_tackles,
      interceptions: bucket.interceptions,
      saves: bucket.saves,
      shot_stopping: avg(bucket.role_values.shot_stopping),
      distribution_accuracy: avg(bucket.role_values.distribution_accuracy),
      match_base_rating: avg(bucket.match_values.performance_rating),
      clean_sheets: bucket.clean_sheet_match_ids.size,
      handling_errors: bucket.handling_errors,
      attendance_record_count: bucket.attendance_total,
      attendance_attended_count: bucket.attendance_attended,
      attendance_score: bucket.attendance_total
        ? clampScore(
            (bucket.attendance_attended / bucket.attendance_total) * 100,
          )
        : null,
      sleep_hours: avg(bucket.daily_values.sleep_hours),
      trained_today: avg(bucket.daily_values.trained_today),
      meals_count: avg(bucket.daily_values.meals_count),
      daily_ai_score: avg(bucket.daily_values.daily_ai_score),
      output: "match_score",
    }));

    const scoredRows = inputRows.map((row) => {
      const coachScore = avgScore([
        row.technical_rating,
        row.tactical_rating,
        row.physical_rating,
        row.mentality_rating,
        row.decision_making_rating,
        row.work_rate_rating,
        row.positioning_rating,
      ]);
      const matchScore = matchScoreForRow(row);
      const weeklyAiScore = clampScore(row.daily_ai_score);
      const attendanceScore = clampScore(row.attendance_score);
      const weeklyScore = weightedWeeklyScore({
        matchScore,
        coachScore,
        attendanceScore,
        weeklyAiScore,
      });
      return {
        ...row,
        coach_score: coachScore,
        match_score: matchScore,
        weekly_ai_score: weeklyAiScore,
        attendance_score: attendanceScore,
        weekly_score: weeklyScore,
        grade: gradeForScore(weeklyScore),
        model_version: RANKING_MODEL_VERSION,
      };
    });

    const rowsByWeek = scoredRows.reduce((acc, row) => {
      const weekKey = String(row.week_start);
      if (!acc.has(weekKey)) acc.set(weekKey, []);
      acc.get(weekKey).push(row);
      return acc;
    }, new Map());
    const { rows: currentWeekRows } = await this.repo.db.raw(
      "SELECT date_trunc('week', now())::date::text AS week_start",
    );
    const currentWeekStart = currentWeekRows[0]?.week_start || null;
    const carryForwardRow = (previous, weekKey) => ({
      ...previous,
      id: `${weekKey}:${previous.player_id}`,
      week_start: weekKey,
      week_end: weekEndKey(weekKey),
      match_evaluation_count: 0,
      training_evaluation_count: 0,
      daily_ai_input_count: 0,
      shots_on_target: 0,
      key_passes: 0,
      goals: 0,
      assists: 0,
      duels: 0,
      defensive_tackles: 0,
      interceptions: 0,
      saves: 0,
      clean_sheets: 0,
      handling_errors: 0,
      attendance_record_count: 0,
      attendance_attended_count: 0,
      carry_forward: true,
      carried_from_week_start: previous.week_start,
    });
    const rankedRows = [];
    const previousByPlayer = new Map();
    buildContinuousWeekKeys([...rowsByWeek.keys()], currentWeekStart).forEach(
      (weekKey) => {
        const actualRows = rowsByWeek.get(weekKey) || [];
        const actualPlayerIds = new Set(actualRows.map((row) => row.player_id));
        const carriedRows = [...previousByPlayer.values()]
          .filter((row) => !actualPlayerIds.has(row.player_id))
          .map((row) => carryForwardRow(row, weekKey));
        const weekRows = [...actualRows, ...carriedRows].sort(
          (a, b) => scoreOrZero(b.weekly_score) - scoreOrZero(a.weekly_score),
        );
        weekRows.forEach((row, index) => {
          const rank = index + 1;
          const previous = previousByPlayer.get(row.player_id);
          const scoreDelta = previous
            ? Number(
                (
                  scoreOrZero(row.weekly_score) -
                  scoreOrZero(previous.weekly_score)
                ).toFixed(2),
              )
            : null;
          const rankChange = previous ? previous.rank - rank : null;
          const trend = !previous
            ? "New"
            : scoreDelta > 1
              ? "Improving"
              : scoreDelta < -1
                ? "Declining"
                : "Stable";
          const rankedRow = {
            ...row,
            rank,
            previous_rank: previous?.rank || null,
            rank_change: rankChange,
            trend,
            score_delta: scoreDelta,
          };
          rankedRows.push(rankedRow);
          previousByPlayer.set(row.player_id, rankedRow);
        });
      },
    );

    const sortedRankedRows = rankedRows.slice().sort((a, b) => {
      const weekSort = String(b.week_start).localeCompare(String(a.week_start));
      if (weekSort) return weekSort;
      return Number(a.rank || 0) - Number(b.rank || 0);
    });
    const total = sortedRankedRows.length;
    const pageRows = sortedRankedRows.slice(offset, offset + limit);
    const toModelInput = (row) => ({
      id: row.id,
      player_id: row.player_id,
      player_name: row.player_name,
      match_score: scoreOrZero(row.match_score),
      coach_score: scoreOrZero(row.coach_score),
      attendance_score: scoreOrZero(row.attendance_score),
      weekly_ai_score: scoreOrZero(row.weekly_ai_score),
      position: modelPosition(row.role_family),
      trend: row.trend,
      rank: row.rank,
    });

    let modelResults = [];
    let modelError = null;
    const modelInputs = pageRows.map(toModelInput);
    try {
      modelResults = await runRankingPredictions(modelInputs);
    } catch (error) {
      modelError = error.message;
    }
    const modelResultById = new Map(
      modelResults.map((result) => [result.id, result]),
    );
    const modelInputById = new Map(
      modelInputs.map((input) => [input.id, input]),
    );

    const data = pageRows.map((row) => {
      const modelResult = modelResultById.get(row.id);
      const weeklyScore = row.carry_forward
        ? row.weekly_score
        : (clampScore(modelResult?.weekly_score) ?? row.weekly_score);
      const grade = row.carry_forward
        ? row.grade
        : modelResult?.grade || row.grade;
      const predictedNextScore = clampScore(modelResult?.predicted_next_score);
      const error = modelResult?.error || modelError || null;
      return {
        ...row,
        weekly_score: weeklyScore,
        grade,
        predicted_next_score: predictedNextScore,
        prediction_status:
          predictedNextScore === null ? "unavailable" : "ready",
        model_error: error,
        model_input: modelInputById.get(row.id) || null,
        final_api_response: {
          weekly_score: weeklyScore,
          grade,
          trend: row.trend,
          rank: row.rank,
          predicted_next_score: predictedNextScore,
          carry_forward: Boolean(row.carry_forward),
          carried_from_week_start: row.carried_from_week_start || null,
        },
      };
    });

    const latestGradeByPlayer = new Map();
    data.forEach((row) => {
      if (
        !latestGradeByPlayer.has(row.player_id) &&
        ["A", "B", "C", "D", "F"].includes(row.grade)
      ) {
        latestGradeByPlayer.set(row.player_id, row.grade);
      }
    });
    await Promise.all(
      [...latestGradeByPlayer].map(([playerId, grade]) =>
        this.repo
          .db("player_profiles")
          .where({ id: playerId, academy_id: academyId })
          .whereNull("deleted_at")
          .where((query) => {
            query.whereNull("level").orWhereNot("level", grade);
          })
          .update({ level: grade, updated_at: new Date() }),
      ),
    );

    if (notifyCoach && coach) {
      await this._notifyCoachWeeklyRankingReady(coach, sortedRankedRows);
    }

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async coachListAdminMatchRequests(userId, academyId, filters) {
    const coach = await this._getCoach(userId, academyId);
    await this.repo.expireAdminMatchCoachRequests({
      academyId,
      coachId: coach.id,
    });
    return this.repo.paginate(
      this.repo.adminMatchCoachRequestsQuery(academyId, {
        ...filters,
        coachId: coach.id,
      }),
      filters,
      "amcr.id",
    );
  }

  async coachAcceptAdminMatchRequest(userId, academyId, requestId, data) {
    const coach = await this._getCoach(userId, academyId);
    await this.repo.expireAdminMatchCoachRequests({
      academyId,
      coachId: coach.id,
    });
    const request = await this.repo.findAdminMatchCoachRequestById(
      requestId,
      academyId,
    );
    if (!request || request.coach_id !== coach.id)
      throw new NotFoundError("Match request", requestId);
    if (request.status !== "pending")
      throw new BadRequestError("This match request is no longer pending");
    if (new Date(request.expires_at) <= new Date())
      throw new BadRequestError("This match request has expired");

    let matchData = {
      opponentName: request.opponent_name,
      matchType: request.match_type,
      matchDate: datePart(request.match_date),
      matchTime: timePart(request.match_time),
      location: request.location,
      venueType: request.venue_type,
      refereeName: request.referee_name || undefined,
      status: "scheduled",
      organizerNotes: request.organizer_notes || undefined,
    };

    let selected = {};
    if (data.groupId) {
      await this._ensureCoachCanAccessGroups(
        coach,
        academyId,
        [data.groupId],
        "can_manage_matches",
      );
      matchData.groupIds = [data.groupId];
      selected = { selected_group_id: data.groupId };
    } else {
      await this._ensureCoachCanAccessBirthYears(
        coach,
        academyId,
        [data.birthYearId],
        "can_manage_matches",
      );
      matchData.birthYearIds = [data.birthYearId];
      selected = { selected_birth_year_id: data.birthYearId };
    }

    const match = await this.adminCreateMatch(
      academyId,
      request.requested_by_admin_id,
      matchData,
    );
    await this.repo
      .db("admin_match_coach_requests")
      .where({ id: requestId })
      .update({
        ...selected,
        created_match_id: match.id,
        status: "accepted",
        updated_at: new Date(),
      });
    return match;
  }

  async coachGetMatch(userId, academyId, matchId) {
    const coach = await this._getCoach(userId, academyId);
    await this._finalizeOverdueMatches(academyId, { matchId });
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(coach, academyId, matchId);
    if (["first_half", "second_half"].includes(match.match_status)) {
      await this._syncMatchMinutes(matchId, academyId, coach.id);
      return this._decorateMatchEvaluationAccess(
        await this.repo.findMatchById(matchId, academyId),
        coach.id,
      );
    }
    if (match.squad?.length) {
      return this._decorateMatchEvaluationAccess(match, coach.id);
    }

    const players = await this._ensurePlayersInMatchTargets(
      [],
      groupIds,
      birthYearIds,
      academyId,
      { requireComplete: true },
    );
    return this._decorateMatchEvaluationAccess(
      {
        ...match,
        evaluation_candidates: players.map((player) => ({
          id: `target-${player.id}`,
          match_id: matchId,
          player_id: player.id,
          player_name: player.full_name,
          squad_role: "reserve",
          position: player.position || null,
          shirt_number: null,
          player_instruction: null,
          profile_status: player.profile_status,
          is_target_fallback: true,
        })),
      },
      coach.id,
    );
  }

  async coachRequestMatchEvaluationEdit(userId, academyId, matchId, data = {}) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_evaluate_players",
    );
    if (!match.evaluations_finalized_at) {
      throw new BadRequestError("Match evaluations are not locked yet");
    }

    const activeRequest = await this._activeEvaluationEditRequest(
      matchId,
      coach.id,
    );
    if (activeRequest) {
      throw new BadRequestError(
        "Match evaluations are already open for editing",
      );
    }

    const pendingRequest = await this.repo
      .db("match_evaluation_edit_requests")
      .where({
        match_id: matchId,
        coach_id: coach.id,
        status: "pending",
      })
      .first();
    if (pendingRequest) return pendingRequest;

    const [request] = await this.repo
      .db("match_evaluation_edit_requests")
      .insert({
        academy_id: academyId,
        match_id: matchId,
        coach_id: coach.id,
        requested_by_user_id: userId,
        reason: data.reason || null,
      })
      .returning("*");

    await this._notifyAdmins(
      academyId,
      "Evaluation edit request",
      `${coach.full_name} requested to reopen ${match.opponent_name} evaluation.`,
      "evaluation",
      { matchId, requestId: request.id },
    );

    return request;
  }

  async adminListEvaluationEditRequests(academyId, filters) {
    return this.repo.paginate(
      this.repo.evaluationEditRequestsQuery(academyId, filters),
      filters,
      "meer.id",
    );
  }

  async adminApproveEvaluationEditRequest(
    academyId,
    adminUserId,
    requestId,
    data = {},
  ) {
    const request = await this.repo.findEvaluationEditRequestById(
      requestId,
      academyId,
    );
    if (!request) throw new NotFoundError("Evaluation edit request", requestId);
    if (request.status !== "pending") {
      throw new BadRequestError(
        "This evaluation edit request is no longer pending",
      );
    }

    const now = new Date();
    const expiresAt = addHours(
      now.toISOString(),
      MATCH_EVALUATION_REOPEN_HOURS,
    );
    await this.repo.db.transaction(async (trx) => {
      await trx("match_evaluation_edit_requests")
        .where({
          match_id: request.match_id,
          coach_id: request.coach_id,
          status: "approved",
        })
        .whereNull("consumed_at")
        .update({ consumed_at: now, updated_at: now });

      await trx("match_evaluation_edit_requests")
        .where({ id: requestId })
        .update({
          status: "approved",
          reviewed_by_admin_id: adminUserId,
          admin_response: data.adminResponse || null,
          approved_at: now,
          expires_at: expiresAt,
          updated_at: now,
        });

      await this._notifyUsers(
        [request.coach_user_id],
        "Evaluation edit approved",
        `${request.opponent_name} evaluation is open for 24 hours.`,
        "evaluation",
        { matchId: request.match_id, requestId, expiresAt },
        trx,
      );
    });

    return this.repo.findEvaluationEditRequestById(requestId, academyId);
  }

  async adminRejectEvaluationEditRequest(
    academyId,
    adminUserId,
    requestId,
    data = {},
  ) {
    const request = await this.repo.findEvaluationEditRequestById(
      requestId,
      academyId,
    );
    if (!request) throw new NotFoundError("Evaluation edit request", requestId);
    if (request.status !== "pending") {
      throw new BadRequestError(
        "This evaluation edit request is no longer pending",
      );
    }

    const [row] = await this.repo
      .db("match_evaluation_edit_requests")
      .where({ id: requestId })
      .update({
        status: "rejected",
        reviewed_by_admin_id: adminUserId,
        admin_response: data.adminResponse || null,
        updated_at: new Date(),
      })
      .returning("*");

    await this._notifyUsers(
      [request.coach_user_id],
      "Evaluation edit rejected",
      `${request.opponent_name} evaluation edit request was rejected.`,
      "evaluation",
      { matchId: request.match_id, requestId },
    );

    return { ...request, ...row };
  }

  async coachUpsertMatchSquad(userId, academyId, matchId, payload) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_manage_matches",
      );
    this._ensureMatchCanBeConfigured(match);
    const players = payload.players || [payload];
    await this._ensurePlayersInMatchTargets(
      players.map((player) => player.playerId),
      groupIds,
      birthYearIds,
      academyId,
      { requireComplete: true },
    );
    const playerProfiles = await this.repo
      .db("player_profiles")
      .whereIn("id", uniq(players.map((player) => player.playerId)))
      .select("id", "full_name", "profile_status");
    const playerSnapshots = new Map(
      playerProfiles.map((player) => [player.id, player]),
    );
    const rows = players.map((player) => ({
      match_id: matchId,
      player_id: player.playerId,
      selected_by_coach_id: coach.id,
      squad_role: player.squadRole,
      position: player.position || null,
      shirt_number: player.shirtNumber || null,
      player_instruction: player.playerInstruction || null,
      player_name_snapshot:
        playerSnapshots.get(player.playerId)?.full_name || null,
      profile_status_snapshot:
        playerSnapshots.get(player.playerId)?.profile_status || null,
    }));
    const result = await this.repo.db.transaction(async (trx) => {
      if (Array.isArray(payload.players)) {
        await trx("match_squads")
          .where({ match_id: matchId })
          .whereNotIn(
            "player_id",
            rows.map((row) => row.player_id),
          )
          .del();
      }
      return trx("match_squads")
        .insert(rows)
        .onConflict(["match_id", "player_id"])
        .merge({
          selected_by_coach_id: this.repo.db.raw(
            "excluded.selected_by_coach_id",
          ),
          squad_role: this.repo.db.raw("excluded.squad_role"),
          position: this.repo.db.raw("excluded.position"),
          shirt_number: this.repo.db.raw("excluded.shirt_number"),
          player_instruction: this.repo.db.raw("excluded.player_instruction"),
          player_name_snapshot: this.repo.db.raw(
            "excluded.player_name_snapshot",
          ),
          profile_status_snapshot: this.repo.db.raw(
            "excluded.profile_status_snapshot",
          ),
          updated_at: new Date(),
        })
        .returning("*");
    });
    await this._syncMatchMinutes(matchId, academyId, coach.id);

    await this._notifyMatchPlan(academyId, matchId, { updated: true });
    return result;
  }

  async coachUpdateMatchSquad(userId, academyId, matchId, playerId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_manage_matches",
      );
    this._ensureMatchCanBeConfigured(match);
    await this._ensurePlayersInMatchTargets(
      [playerId],
      groupIds,
      birthYearIds,
      academyId,
      { requireComplete: true },
    );
    const [row] = await this.repo
      .db("match_squads")
      .where({ match_id: matchId, player_id: playerId })
      .update({
        ...(data.squadRole !== undefined ? { squad_role: data.squadRole } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.shirtNumber !== undefined
          ? { shirt_number: data.shirtNumber }
          : {}),
        ...(data.playerInstruction !== undefined
          ? { player_instruction: data.playerInstruction || null }
          : {}),
        selected_by_coach_id: coach.id,
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) throw new NotFoundError("Squad player");
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    await this._notifyMatchPlan(academyId, matchId, { updated: true });
    return row;
  }

  async coachDeleteMatchSquad(userId, academyId, matchId, playerId) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchCanBeConfigured(match);
    const deleted = await this.repo
      .db("match_squads")
      .where({ match_id: matchId, player_id: playerId })
      .del();
    if (!deleted) throw new NotFoundError("Squad player");
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    await this._notifyMatchPlan(academyId, matchId, { updated: true });
    return { message: "Player removed from squad" };
  }

  async coachUpsertMatchTactics(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchCanBeConfigured(match);
    const existing = await this.repo
      .db("match_tactics")
      .where({ match_id: matchId })
      .first();
    const payload = {
      match_id: matchId,
      coach_id: coach.id,
      ...(data.formation !== undefined ? { formation: data.formation } : {}),
      ...(data.tacticalNotes !== undefined
        ? { tactical_notes: data.tacticalNotes || null }
        : {}),
    };
    const [row] = await this.repo
      .db("match_tactics")
      .insert(payload)
      .onConflict("match_id")
      .merge({ ...payload, updated_at: new Date() })
      .returning("*");
    await this._notifyMatchPlan(academyId, matchId, {
      updated: Boolean(existing),
    });
    return row;
  }

  async coachUpdateMatchTargets(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchCanBeConfigured(match);
    const groupIds = data.groupId ? [data.groupId] : [];
    const birthYearIds = data.birthYearId ? [data.birthYearId] : [];
    if (groupIds.length)
      await this._ensureCoachCanAccessGroups(
        coach,
        academyId,
        groupIds,
        "can_manage_matches",
      );
    if (birthYearIds.length)
      await this._ensureCoachCanAccessBirthYears(
        coach,
        academyId,
        birthYearIds,
        "can_manage_matches",
      );
    const targetSnapshot = await this._buildMatchTargetSnapshot(academyId, {
      groupIds,
      birthYearIds,
      teamId: data.groupId || null,
      ageGroupId: null,
    });

    await this.repo.db.transaction(async (trx) => {
      let eventId = match.event_id;
      if (!eventId) {
        const event = await this.repo.createEventWithTargets(
          this._matchEventPayload(
            academyId,
            {
              opponentName: match.opponent_name,
              matchType: match.match_type,
              matchDate: datePart(match.match_date),
              matchTime: timePart(match.match_time),
              location: match.location || "To be confirmed",
              venueType: match.venue_type,
              status: match.status,
              organizerNotes: match.organizer_notes || undefined,
              groupIds,
              birthYearIds,
            },
            match.created_by_admin_id,
          ),
          { groupIds, birthYearIds },
          trx,
        );
        eventId = event.id;
        await trx("matches")
          .where({ id: matchId })
          .update({
            event_id: eventId,
            team_id: data.groupId || null,
            age_group_id: null,
            target_snapshot: JSON.stringify(targetSnapshot),
            updated_at: new Date(),
          });
      } else {
        await this.repo.replaceEventGroups(eventId, groupIds, trx);
        await this.repo.replaceEventBirthYears(eventId, birthYearIds, trx);
        await trx("matches")
          .where({ id: matchId })
          .update({
            team_id: data.groupId || null,
            age_group_id: null,
            target_snapshot: JSON.stringify(targetSnapshot),
            updated_at: new Date(),
          });
      }
    });

    await this._notifyMatchPlan(academyId, matchId, { updated: true });
    return this.coachGetMatch(userId, academyId, matchId);
  }

  async coachUpdateMatchLiveStatus(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchDayReady(match);
    if (match.match_status === "finished" && data.matchStatus !== "finished") {
      throw new BadRequestError("Finished matches cannot be restarted");
    }
    if (
      data.matchStatus === "first_half" &&
      match.match_status === "scheduled"
    ) {
      this._ensureMatchCanStart(match);
    }
    let targetSnapshot = null;
    if (data.matchStatus === "finished") {
      const [groupIds, birthYearIds] = await Promise.all([
        this.repo.getMatchGroupIds(matchId),
        this.repo.getMatchBirthYearIds(matchId),
      ]);
      targetSnapshot = await this._buildMatchTargetSnapshot(academyId, {
        groupIds,
        birthYearIds,
        teamId: match.team_id,
        ageGroupId: match.age_group_id,
      });
    }
    const now = new Date();
    const updateData = {
      match_status: data.matchStatus,
      updated_at: now,
    };
    if (data.firstHalfStoppageMinutes !== undefined)
      updateData.first_half_stoppage_minutes = data.firstHalfStoppageMinutes;
    if (data.secondHalfStoppageMinutes !== undefined)
      updateData.second_half_stoppage_minutes = data.secondHalfStoppageMinutes;
    if (data.matchStatus === "first_half") {
      updateData.started_at = match.started_at || now;
      updateData.first_half_started_at = match.first_half_started_at || now;
      updateData.status = "scheduled";
    }
    if (data.matchStatus === "second_half") {
      updateData.second_half_started_at = match.second_half_started_at || now;
      updateData.status = "scheduled";
    }
    if (data.matchStatus === "finished") {
      updateData.finished_at = now;
      updateData.status = "completed";
      updateData.target_snapshot = JSON.stringify(targetSnapshot);
    }

    const [row] = await this.repo.db.transaction(async (trx) => {
      const [updatedMatch] = await trx("matches")
        .where({ id: matchId })
        .update(updateData)
        .returning("*");
      if (data.matchStatus === "finished") {
        await this._refreshMatchSquadSnapshots(matchId, trx);
      }
      return [updatedMatch];
    });
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    if (
      ["first_half", "second_half"].includes(data.matchStatus) &&
      match.event_id
    ) {
      await this.repo
        .db("calendar_events")
        .where({ id: match.event_id })
        .update({ status: "scheduled", updated_at: now });
    }
    if (data.matchStatus === "finished" && match.event_id) {
      await this.repo
        .db("calendar_events")
        .where({ id: match.event_id })
        .update({ status: "finished", updated_at: now });
    }
    if (data.matchStatus === "finished") {
      await this._refreshMatchInjuryRiskMonthlyAttendance(academyId, {
        ...match,
        ...row,
      });
    }
    const statusLabel = data.matchStatus.replace("_", " ");
    await this._notifyAdmins(
      academyId,
      "Match status updated",
      `${match.opponent_name} is now ${statusLabel}`,
      "match",
      { matchId, matchStatus: data.matchStatus },
    );
    if (data.matchStatus === "first_half" || data.matchStatus === "finished") {
      await this._notifyMatchPlan(academyId, matchId, { updated: true });
    }
    return row;
  }

  async coachRecordMatchIncident(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_manage_matches",
      );
    this._ensureMatchDayReady(match);
    this._ensureMatchHasStarted(match);
    await this._ensurePlayersInMatchTargets(
      [data.playerId],
      groupIds,
      birthYearIds,
      academyId,
      { requireComplete: true },
    );

    const injuryDate = datePart(new Date());
    const minute = data.minute ?? this._matchElapsedMinute(match);
    const result = await this.repo.db.transaction(async (trx) => {
      const [incident] = await trx("match_player_incidents")
        .insert({
          match_id: matchId,
          player_id: data.playerId,
          coach_id: coach.id,
          incident_type: data.incidentType,
          minute,
          body_part: data.incidentType === "injury" ? data.bodyPart : null,
          injury_date: data.incidentType === "injury" ? injuryDate : null,
          notes: data.notes || null,
        })
        .returning("*");

      const statPatch =
        data.incidentType === "yellow_card"
          ? {
              yellow_cards: this.repo.db.raw(
                "LEAST(COALESCE(match_player_stats.yellow_cards, 0) + 1, 2)",
              ),
            }
          : data.incidentType === "red_card"
            ? { red_cards: 1 }
            : { injuries: data.bodyPart };

      await trx("match_player_stats")
        .insert({
          match_id: matchId,
          player_id: data.playerId,
          minutes_played: 0,
          goals: 0,
          assists: 0,
          yellow_cards: data.incidentType === "yellow_card" ? 1 : 0,
          red_cards: data.incidentType === "red_card" ? 1 : 0,
          injuries: data.incidentType === "injury" ? data.bodyPart : null,
          created_by_coach_id: coach.id,
        })
        .onConflict(["match_id", "player_id"])
        .merge({ ...statPatch, updated_at: new Date() });

      if (data.incidentType === "injury") {
        await trx("player_injury_history").insert({
          player_id: data.playerId,
          injury_type: data.bodyPart,
          injury_date: injuryDate,
          notes: data.notes || `Injured during ${match.opponent_name}`,
          reported_by: userId,
        });
      }

      return incident;
    });
    await this._syncMatchMinutes(matchId, academyId, coach.id);

    const player = await this.repo
      .db("player_profiles")
      .where({ id: data.playerId })
      .first();
    await this._notifyAdmins(
      academyId,
      "Match incident recorded",
      `${player?.full_name || "Player"} - ${data.incidentType.replace("_", " ")} in ${match.opponent_name}`,
      "match",
      {
        matchId,
        playerId: data.playerId,
        incidentType: data.incidentType,
        minute,
        bodyPart: data.bodyPart || null,
      },
    );
    return result;
  }

  async coachRecordMatchGoal(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_manage_matches",
      );
    this._ensureMatchDayReady(match);
    this._ensureMatchHasStarted(match);

    const playerIds = uniq([data.scorerPlayerId, data.assistPlayerId]);
    if (playerIds.length) {
      await this._ensurePlayersInMatchTargets(
        playerIds,
        groupIds,
        birthYearIds,
        academyId,
        { requireComplete: true },
      );
    }

    const minute = data.minute ?? 0;
    await this.repo.db.transaction(async (trx) => {
      await trx("match_goal_events").insert({
        match_id: matchId,
        team: data.team,
        scorer_player_id: data.team === "our" ? data.scorerPlayerId : null,
        assist_player_id:
          data.team === "our" ? data.assistPlayerId || null : null,
        coach_id: coach.id,
        minute,
        notes: data.notes || null,
      });

      await trx("matches")
        .where({ id: matchId })
        .update({
          ...(data.team === "our"
            ? {
                our_score: trx.raw("COALESCE(our_score, 0) + 1"),
              }
            : {
                opponent_score: trx.raw("COALESCE(opponent_score, 0) + 1"),
              }),
          updated_at: new Date(),
        });

      if (data.team === "our" && data.scorerPlayerId) {
        await this._incrementPlayerGoalStat(
          trx,
          matchId,
          data.scorerPlayerId,
          coach.id,
          "goals",
          1,
        );
      }
      if (data.team === "our" && data.assistPlayerId) {
        await this._incrementPlayerGoalStat(
          trx,
          matchId,
          data.assistPlayerId,
          coach.id,
          "assists",
          1,
        );
      }
    });

    return this.coachGetMatch(userId, academyId, matchId);
  }

  async coachDeleteMatchGoal(userId, academyId, matchId, goalId) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchDayReady(match);

    await this.repo.db.transaction(async (trx) => {
      const goal = await trx("match_goal_events")
        .where({ id: goalId, match_id: matchId })
        .first();
      if (!goal) throw new NotFoundError("Match goal", goalId);

      await trx("match_goal_events").where({ id: goalId }).del();
      await trx("matches")
        .where({ id: matchId })
        .update({
          ...(goal.team === "our"
            ? {
                our_score: trx.raw("GREATEST(COALESCE(our_score, 0) - 1, 0)"),
              }
            : {
                opponent_score: trx.raw(
                  "GREATEST(COALESCE(opponent_score, 0) - 1, 0)",
                ),
              }),
          updated_at: new Date(),
        });

      if (goal.scorer_player_id) {
        await this._incrementPlayerGoalStat(
          trx,
          matchId,
          goal.scorer_player_id,
          coach.id,
          "goals",
          -1,
        );
      }
      if (goal.assist_player_id) {
        await this._incrementPlayerGoalStat(
          trx,
          matchId,
          goal.assist_player_id,
          coach.id,
          "assists",
          -1,
        );
      }
    });

    return this.coachGetMatch(userId, academyId, matchId);
  }

  async coachRecordMatchSubstitution(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchDayReady(match);
    if (match.match_status === "finished") {
      throw new BadRequestError("Finished matches cannot accept substitutions");
    }
    if (data.outPlayerId === data.inPlayerId) {
      throw new BadRequestError("Substitution players must be different");
    }

    const squadByPlayer = new Map(
      (match.squad || []).map((player) => [player.player_id, player]),
    );
    const outPlayer = squadByPlayer.get(data.outPlayerId);
    const inPlayer = squadByPlayer.get(data.inPlayerId);
    if (!outPlayer || !inPlayer) {
      throw new BadRequestError("Both players must be in the match squad");
    }

    const attendanceByPlayer = new Map(
      (match.attendance || []).map((record) => [record.player_id, record]),
    );
    const matchLive = this._matchIsLive(match);
    const preKickoffAbsenceSubstitution = this._isPreKickoffAbsenceSubstitution(
      match,
      outPlayer,
      inPlayer,
      attendanceByPlayer,
    );
    if (!matchLive && !preKickoffAbsenceSubstitution) {
      throw new BadRequestError(
        "Substitutions before match start are only allowed for absent starting players",
      );
    }

    const currentPlaying = this._currentPlayingPlayerIds(match);
    const outPlayerWasInjured = (match.incidents || []).some(
      (incident) =>
        incident.player_id === data.outPlayerId &&
        incident.incident_type === "injury",
    );
    const outPlayerWasSubbedOut = (match.substitutions || []).some(
      (substitution) => substitution.out_player_id === data.outPlayerId,
    );
    if (
      !currentPlaying.has(data.outPlayerId) &&
      (!outPlayerWasInjured || outPlayerWasSubbedOut)
    ) {
      throw new BadRequestError(
        "The player going out is not currently playing",
      );
    }
    if (currentPlaying.has(data.inPlayerId)) {
      throw new BadRequestError("The substitute is already playing");
    }

    const replacementAttendance = attendanceByPlayer.get(data.inPlayerId);
    if (
      !replacementAttendance ||
      ["absent", "injured"].includes(replacementAttendance.status)
    ) {
      throw new BadRequestError(
        "Replacement player must be marked present or late before substitution",
      );
    }

    const minute = preKickoffAbsenceSubstitution
      ? 0
      : (data.minute ?? this._matchElapsedMinute(match));
    await this.repo.db("match_substitutions").insert({
      match_id: matchId,
      out_player_id: data.outPlayerId,
      in_player_id: data.inPlayerId,
      coach_id: coach.id,
      minute,
      reason: data.reason || null,
    });
    await this._syncMatchMinutes(matchId, academyId, coach.id);

    await this._notifyAdmins(
      academyId,
      "Match substitution recorded",
      `${inPlayer.player_name || "Player"} replaced ${outPlayer.player_name || "player"} in ${match.opponent_name}`,
      "match",
      {
        matchId,
        outPlayerId: data.outPlayerId,
        inPlayerId: data.inPlayerId,
        minute,
      },
    );

    return this.coachGetMatch(userId, academyId, matchId);
  }

  async coachDeleteMatchSubstitution(
    userId,
    academyId,
    matchId,
    substitutionId,
  ) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchDayReady(match);
    if (match.match_status === "finished") {
      throw new BadRequestError("Finished matches cannot be changed");
    }

    const deleted = await this.repo
      .db("match_substitutions")
      .where({ id: substitutionId, match_id: matchId })
      .del();
    if (!deleted) throw new NotFoundError("Match substitution", substitutionId);
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    return this.coachGetMatch(userId, academyId, matchId);
  }

  async coachDeleteMatchIncident(userId, academyId, matchId, incidentId) {
    const coach = await this._getCoach(userId, academyId);
    const { match } = await this._ensureCoachCanAccessMatch(
      coach,
      academyId,
      matchId,
      "can_manage_matches",
    );
    this._ensureMatchDayReady(match);

    const deleted = await this.repo.db.transaction(async (trx) => {
      const incident = await trx("match_player_incidents")
        .where({ id: incidentId, match_id: matchId })
        .first();
      if (!incident) throw new NotFoundError("Match incident", incidentId);

      await trx("match_player_incidents").where({ id: incidentId }).del();

      const remaining = await trx("match_player_incidents")
        .where({
          match_id: matchId,
          player_id: incident.player_id,
        })
        .orderBy("created_at", "desc");
      const yellowCards = Math.min(
        2,
        remaining.filter((item) => item.incident_type === "yellow_card").length,
      );
      const redCards = remaining.some(
        (item) => item.incident_type === "red_card",
      )
        ? 1
        : 0;
      const latestInjury = remaining.find(
        (item) => item.incident_type === "injury",
      );

      await trx("match_player_stats")
        .where({ match_id: matchId, player_id: incident.player_id })
        .update({
          yellow_cards: yellowCards,
          red_cards: redCards,
          injuries: latestInjury?.body_part || null,
          updated_at: new Date(),
        });

      if (incident.incident_type === "injury") {
        const injuryQuery = trx("player_injury_history").where({
          player_id: incident.player_id,
          injury_type: incident.body_part,
          injury_date: incident.injury_date,
        });
        if (incident.notes) {
          injuryQuery.where("notes", incident.notes);
        } else {
          injuryQuery.where("notes", `Injured during ${match.opponent_name}`);
        }
        const injury = await injuryQuery.first();
        if (injury) {
          await trx("player_injury_history").where({ id: injury.id }).del();
        }
      }

      return incident;
    });
    await this._syncMatchMinutes(matchId, academyId, coach.id);

    const player = await this.repo
      .db("player_profiles")
      .where({ id: deleted.player_id })
      .first();
    await this._notifyAdmins(
      academyId,
      "Match incident removed",
      `${player?.full_name || "Player"} - ${deleted.incident_type.replace("_", " ")} removed from ${match.opponent_name}`,
      "match",
      {
        matchId,
        playerId: deleted.player_id,
        incidentType: deleted.incident_type,
      },
    );
    return this.coachGetMatch(userId, academyId, matchId);
  }

  async coachUpsertMatchAttendance(userId, academyId, matchId, records) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_take_attendance",
      );
    this._ensureMatchDayReady(match);
    this._ensureMatchAttendanceEditable(match);
    await this._ensurePlayersInMatchTargets(
      records.map((record) => record.playerId),
      groupIds,
      birthYearIds,
      academyId,
    );
    const rows = records.map((record) => ({
      match_id: matchId,
      player_id: record.playerId,
      status: record.status,
      marked_by_coach_id: coach.id,
      notes: record.notes || null,
    }));
    const result = await this.repo
      .db("match_attendance")
      .insert(rows)
      .onConflict(["match_id", "player_id"])
      .merge({
        status: this.repo.db.raw("excluded.status"),
        marked_by_coach_id: this.repo.db.raw("excluded.marked_by_coach_id"),
        notes: this.repo.db.raw("excluded.notes"),
        updated_at: new Date(),
      })
      .returning("*");
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    await this._refreshInjuryRiskMonthlyAttendance(
      academyId,
      records.map((record) => record.playerId),
      match.finished_at || match.match_date,
    );
    return result;
  }

  async coachScanMatchAttendanceQr(userId, academyId, matchId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_take_attendance",
      );
    this._ensureMatchDayReady(match);
    this._ensureMatchAttendanceEditable(match);

    const player = await this._resolveAttendanceQrPlayer(academyId, data);
    const squadPlayer = await this.repo
      .db("match_squads")
      .where({ match_id: matchId, player_id: player.id })
      .first();
    if (!squadPlayer) {
      throw new ForbiddenError("Player is not in this match squad");
    }
    if (groupIds.length || birthYearIds.length) {
      await this._ensurePlayersInMatchTargets(
        [player.id],
        groupIds,
        birthYearIds,
        academyId,
      );
    }

    const existing = await this.repo
      .db("match_attendance")
      .where({ match_id: matchId, player_id: player.id })
      .first();
    const [attendance] = await this.repo
      .db("match_attendance")
      .insert({
        match_id: matchId,
        player_id: player.id,
        status: "present",
        marked_by_coach_id: coach.id,
        notes: "QR scan",
      })
      .onConflict(["match_id", "player_id"])
      .merge({
        status: "present",
        marked_by_coach_id: coach.id,
        notes: this.repo.db.raw("excluded.notes"),
        updated_at: new Date(),
      })
      .returning("*");

    await this._syncMatchMinutes(matchId, academyId, coach.id);
    await this._refreshInjuryRiskMonthlyAttendance(
      academyId,
      [player.id],
      match.finished_at || match.match_date,
    );
    if (existing?.status !== "present") {
      await this._notifyPlayerAttendanceCheckedIn(
        player,
        "Match attendance recorded",
        `You are checked in for ${match.opponent_name}.`,
        "attendance",
        { matchId },
      );
    }

    return {
      playerId: player.id,
      playerName: player.full_name,
      status: attendance.status,
      alreadyMarked: existing?.status === "present",
      attendance,
    };
  }

  async _matchSquadPositionByPlayer(matchId, match) {
    if (match?.squad?.length) {
      return new Map(
        match.squad.map((player) => [player.player_id, player.position]),
      );
    }
    const rows = await this.repo
      .db("match_squads")
      .where({ match_id: matchId })
      .select("player_id", "position");
    return new Map(rows.map((player) => [player.player_id, player.position]));
  }

  _statsRows(matchId, coachId, records, positionByPlayer = new Map()) {
    return records.map((record) => ({
      match_id: matchId,
      player_id: record.playerId,
      minutes_played: record.minutesPlayed ?? 0,
      goals: record.goals ?? 0,
      assists: record.assists ?? 0,
      passes_completed: record.passesCompleted ?? 0,
      pass_accuracy_percentage: record.passAccuracyPercentage ?? null,
      shots_total: record.shotsTotal ?? 0,
      shots_on_target: record.shotsOnTarget ?? 0,
      key_passes: record.keyPasses ?? 0,
      tackles: record.tackles ?? 0,
      defensive_tackles: record.defensiveTackles ?? 0,
      interceptions: record.interceptions ?? 0,
      duels_won: record.duelsWon ?? 0,
      duels_lost: record.duelsLost ?? 0,
      possession_losses: record.possessionLosses ?? 0,
      saves: isGoalkeeperPosition(positionByPlayer.get(record.playerId))
        ? (record.saves ?? 0)
        : 0,
      yellow_cards: record.yellowCards ?? 0,
      red_cards: record.redCards ?? 0,
      fouls: record.fouls ?? 0,
      injuries: record.injuries || null,
      performance_rating: record.performanceRating ?? null,
      performance_score: record.performanceRating ?? null,
      technical_rating: record.technicalRating ?? null,
      tactical_rating: record.tacticalRating ?? null,
      physical_rating: record.physicalRating ?? null,
      fatigue_rating: record.fatigueRating ?? null,
      mentality_rating: record.mentalityRating ?? null,
      decision_making_rating: record.decisionMakingRating ?? null,
      work_rate_rating: record.workRateRating ?? null,
      positioning_rating: record.positioningRating ?? null,
      strengths: record.strengths || null,
      weaknesses: record.weaknesses || null,
      improvement_plan: record.improvementPlan || null,
      coach_notes: record.coachNotes || null,
      created_by_coach_id: coachId,
    }));
  }

  async coachUpsertPlayerStats(userId, academyId, matchId, payload) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_evaluate_players",
      );
    const activeEditRequest = match.evaluations_finalized_at
      ? await this._activeEvaluationEditRequest(matchId, coach.id)
      : null;
    if (match.evaluations_finalized_at && !activeEditRequest) {
      throw new BadRequestError("Match evaluations are locked");
    }
    if (payload.finalize && match.match_status !== "finished") {
      throw new BadRequestError(
        "Finish the match before saving final evaluations",
      );
    }
    const records = payload.records || [payload];
    await this._ensurePlayersInMatchTargets(
      records.map((record) => record.playerId),
      groupIds,
      birthYearIds,
      academyId,
      { requireComplete: true },
    );
    const positionByPlayer = await this._matchSquadPositionByPlayer(
      matchId,
      match,
    );
    const result = await this.repo.db.transaction(async (trx) => {
      const rows = await trx("match_player_stats")
        .insert(this._statsRows(matchId, coach.id, records, positionByPlayer))
        .onConflict(["match_id", "player_id"])
        .merge()
        .returning("*");

      if (payload.finalize) {
        await trx("matches").where({ id: matchId }).update({
          evaluations_finalized_at: new Date(),
          evaluations_finalized_by_coach_id: coach.id,
          updated_at: new Date(),
        });
        if (activeEditRequest) {
          await trx("match_evaluation_edit_requests")
            .where({ id: activeEditRequest.id })
            .update({ consumed_at: new Date(), updated_at: new Date() });
        }
      }

      return rows;
    });
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    return result;
  }

  async coachUpdatePlayerStats(userId, academyId, matchId, playerId, data) {
    const coach = await this._getCoach(userId, academyId);
    const { match, groupIds, birthYearIds } =
      await this._ensureCoachCanAccessMatch(
        coach,
        academyId,
        matchId,
        "can_evaluate_players",
      );
    const activeEditRequest = match.evaluations_finalized_at
      ? await this._activeEvaluationEditRequest(matchId, coach.id)
      : null;
    if (match.evaluations_finalized_at && !activeEditRequest) {
      throw new BadRequestError("Match evaluations are locked");
    }
    await this._ensurePlayersInMatchTargets(
      [playerId],
      groupIds,
      birthYearIds,
      academyId,
      { requireComplete: true },
    );
    const positionByPlayer = await this._matchSquadPositionByPlayer(
      matchId,
      match,
    );
    const [row] = await this.repo
      .db("match_player_stats")
      .where({ match_id: matchId, player_id: playerId })
      .update({
        ...this._statsRows(
          matchId,
          coach.id,
          [{ ...data, playerId }],
          positionByPlayer,
        )[0],
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) throw new NotFoundError("Match player stats");
    await this._syncMatchMinutes(matchId, academyId, coach.id);
    return row;
  }

  async coachCreateFriendlyRequest(userId, academyId, data) {
    const coach = await this._getCoach(userId, academyId);
    const groupIds = uniq([data.teamId, data.ageGroupId]);
    if (groupIds.length)
      await this._ensureCoachCanAccessGroups(
        coach,
        academyId,
        groupIds,
        "can_manage_matches",
      );
    if (data.birthYearId)
      await this._ensureCoachCanAccessBirthYears(
        coach,
        academyId,
        [data.birthYearId],
        "can_manage_matches",
      );
    const [row] = await this.repo
      .db("friendly_match_requests")
      .insert({
        coach_id: coach.id,
        team_id: data.teamId || null,
        age_group_id: data.ageGroupId || null,
        birth_year_id: data.birthYearId || null,
        preferred_date: data.preferredDate,
        preferred_time: toTime(data.preferredTime),
        opponent_level: data.opponentLevel,
        suggested_opponent_name: data.suggestedOpponentName || null,
        reason: data.reason,
        notes: data.notes || null,
        status: "pending",
      })
      .returning("*");
    return row;
  }

  async coachListFriendlyRequests(userId, academyId, filters) {
    const coach = await this._getCoach(userId, academyId);
    return this.repo.paginate(
      this.repo.friendlyRequestsQuery(academyId, {
        ...filters,
        coachId: coach.id,
      }),
      filters,
      "fmr.id",
    );
  }

  async adminListFriendlyRequests(academyId, filters) {
    await this.repo.deleteStaleMatchRequests(academyId);
    return this.repo.paginate(
      this.repo.friendlyRequestsQuery(academyId, filters),
      filters,
      "fmr.id",
    );
  }

  async adminApproveFriendlyRequest(
    academyId,
    adminUserId,
    requestId,
    adminResponse,
  ) {
    const request = await this.repo.findFriendlyRequestById(
      requestId,
      academyId,
    );
    if (!request) throw new NotFoundError("Friendly match request", requestId);
    const [row] = await this.repo
      .db("friendly_match_requests")
      .where({ id: requestId })
      .update({
        status: "approved",
        admin_response: adminResponse || null,
        reviewed_by_admin_id: adminUserId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    if (request.coach_user_id)
      await this._notifyUsers(
        [request.coach_user_id],
        "Friendly request approved",
        adminResponse || "Your friendly match request was approved.",
        "match",
        { requestId },
      );
    return row;
  }

  async adminRejectFriendlyRequest(
    academyId,
    adminUserId,
    requestId,
    adminResponse,
  ) {
    const request = await this.repo.findFriendlyRequestById(
      requestId,
      academyId,
    );
    if (!request) throw new NotFoundError("Friendly match request", requestId);
    const [row] = await this.repo
      .db("friendly_match_requests")
      .where({ id: requestId })
      .update({
        status: "rejected",
        admin_response: adminResponse,
        reviewed_by_admin_id: adminUserId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    if (request.coach_user_id)
      await this._notifyUsers(
        [request.coach_user_id],
        "Friendly request rejected",
        adminResponse,
        "match",
        { requestId },
      );
    return row;
  }

  async adminConvertFriendlyRequest(academyId, adminUserId, requestId, data) {
    const request = await this.repo.findFriendlyRequestById(
      requestId,
      academyId,
    );
    if (!request) throw new NotFoundError("Friendly match request", requestId);
    if (request.status !== "approved")
      throw new BadRequestError("Only approved requests can be converted");
    if (request.converted_match_id)
      throw new ConflictError("Friendly request already converted");

    const match = await this.adminCreateMatch(academyId, adminUserId, {
      teamId: request.team_id,
      ageGroupId: request.age_group_id,
      birthYearIds: request.birth_year_id ? [request.birth_year_id] : undefined,
      opponentName:
        request.suggested_opponent_name || `${request.opponent_level} opponent`,
      matchType: "friendly",
      matchDate: request.preferred_date,
      matchTime: request.preferred_time,
      location: data.location || "To be confirmed",
      venueType: data.venueType || "neutral",
      refereeName: data.refereeName,
      status: "scheduled",
      organizerNotes: data.organizerNotes || request.notes || request.reason,
    });

    await this.repo
      .db("friendly_match_requests")
      .where({ id: requestId })
      .update({ converted_match_id: match.id, updated_at: new Date() });
    return match;
  }

  async listPlayerOptions(academyId, fieldKey) {
    return this.repo.listPlayerOptions(academyId, fieldKey);
  }

  async createPlayerOption(user, data) {
    const coach =
      user.role === "coach"
        ? await this._getCoach(user.userId, user.academyId)
        : null;
    if (coach) {
      await this._ensureCoachHasPermission(
        coach,
        user.academyId,
        "can_manage_groups",
      );
    }
    const [row] = await this.repo
      .db("player_field_options")
      .insert({
        academy_id: user.academyId,
        field_key: data.fieldKey,
        label: data.label,
        value: optionValue(data.label, data.value),
        created_by_user_id: user.userId,
        created_by_role: user.role === "coach" ? "coach" : "admin",
        created_by_coach_id: coach?.id || null,
        is_active: data.isActive ?? true,
      })
      .returning("*");
    return row;
  }

  async updatePlayerOption(user, optionId, data) {
    const option = await this.repo
      .db("player_field_options")
      .where({ id: optionId, academy_id: user.academyId })
      .whereNull("deleted_at")
      .first();
    if (!option) throw new NotFoundError("Player option", optionId);
    if (user.role === "coach") {
      const coach = await this._getCoach(user.userId, user.academyId);
      await this._ensureCoachHasPermission(
        coach,
        user.academyId,
        "can_manage_groups",
      );
      if (
        option.created_by_role !== "coach" ||
        option.created_by_coach_id !== coach.id
      ) {
        throw new ForbiddenError(
          "Coach can only edit options created by himself",
        );
      }
    }
    const [row] = await this.repo
      .db("player_field_options")
      .where({ id: optionId })
      .update({
        ...(data.fieldKey !== undefined ? { field_key: data.fieldKey } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.value !== undefined || data.label !== undefined
          ? { value: optionValue(data.label || option.label, data.value) }
          : {}),
        ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
        updated_at: new Date(),
      })
      .returning("*");
    return row;
  }

  async deletePlayerOption(user, optionId) {
    await this.updatePlayerOption(user, optionId, {});
    await this.repo
      .db("player_field_options")
      .where({ id: optionId })
      .update({ deleted_at: new Date(), is_active: false });
    return { message: "Player option deleted" };
  }

  async adminListCoachGroups(academyId, filters) {
    return this.repo.listCoachGroupAssignments(academyId, filters);
  }

  async adminCreateCoachGroup(academyId, data) {
    const coach = await this.repo
      .db("coach_profiles")
      .where({ id: data.coachId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
    if (!coach) throw new NotFoundError("Coach", data.coachId);
    await this._validateAcademyGroups([data.groupId], academyId);
    const role = normalizeAssignmentRole(data.role);
    const permissions = permissionColumnsForRole(role);
    if (!permissions)
      throw new BadRequestError("Unsupported coach assignment role");
    const [row] = await this.repo
      .db("coach_group_assignments")
      .insert({
        coach_id: data.coachId,
        group_id: data.groupId,
        role,
        ...permissions,
        assigned_at: new Date(),
      })
      .onConflict(["coach_id", "group_id"])
      .merge()
      .returning("*");
    return row;
  }

  async adminUpdateCoachGroup(academyId, assignmentId, data) {
    const current = await this.repo
      .db("coach_group_assignments as cga")
      .join("coach_profiles as cp", "cga.coach_id", "cp.id")
      .where("cga.id", assignmentId)
      .where("cp.academy_id", academyId)
      .select("cga.*")
      .first();
    if (!current)
      throw new NotFoundError("Coach group assignment", assignmentId);
    const role = normalizeAssignmentRole(data.role || current.role);
    const permissions = permissionColumnsForRole(role);
    if (!permissions)
      throw new BadRequestError("Unsupported coach assignment role");
    const [row] = await this.repo
      .db("coach_group_assignments")
      .where({ id: assignmentId })
      .update({
        role,
        ...permissions,
      })
      .returning("*");
    return row;
  }

  async adminDeleteCoachGroup(academyId, assignmentId) {
    const current = await this.repo
      .db("coach_group_assignments as cga")
      .join("coach_profiles as cp", "cga.coach_id", "cp.id")
      .where("cga.id", assignmentId)
      .where("cp.academy_id", academyId)
      .select("cga.id")
      .first();
    if (!current)
      throw new NotFoundError("Coach group assignment", assignmentId);
    await this.repo
      .db("coach_group_assignments")
      .where({ id: assignmentId })
      .del();
    return { message: "Coach group assignment deleted" };
  }

  async adminAttendanceReport(academyId, filters) {
    const rows = await this.repo
      .db("event_attendance as ea")
      .join("calendar_events as ce", "ea.event_id", "ce.id")
      .leftJoin("calendar_event_groups as ceg", "ce.id", "ceg.event_id")
      .leftJoin("academy_groups as ag", "ceg.group_id", "ag.id")
      .where("ce.academy_id", academyId)
      .whereNull("ce.deleted_at")
      .modify((q) => {
        if (filters.groupId) q.where("ceg.group_id", filters.groupId);
        if (filters.eventType) q.where("ce.event_type", filters.eventType);
        if (filters.dateFrom)
          q.whereRaw("ce.start_datetime >= ?::date", [filters.dateFrom]);
        if (filters.dateTo)
          q.whereRaw("ce.start_datetime < (?::date + interval '1 day')", [
            filters.dateTo,
          ]);
      })
      .groupBy("ag.id", "ag.name")
      .select(
        "ag.id as group_id",
        "ag.name as group_name",
        this.repo.db.raw("COUNT(ea.id)::int as total_marks"),
        this.repo.db.raw(
          "COUNT(ea.id) FILTER (WHERE ea.status IN ('present','late'))::int as attended",
        ),
        this.repo.db.raw(
          "ROUND(100.0 * COUNT(ea.id) FILTER (WHERE ea.status IN ('present','late')) / NULLIF(COUNT(ea.id), 0))::int as attendance_rate",
        ),
      );
    return rows;
  }

  async adminPerformanceReport(academyId, filters) {
    return this.repo
      .db("player_event_evaluations as pee")
      .join("calendar_events as ce", "pee.event_id", "ce.id")
      .join("player_profiles as pp", "pee.player_id", "pp.id")
      .where("ce.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .modify((q) => {
        if (filters.groupId) {
          q.whereIn(
            "pee.player_id",
            this.repo
              .db("player_group_assignments")
              .where({ group_id: filters.groupId })
              .whereNull("left_at")
              .select("player_id"),
          );
        }
      })
      .groupBy("pp.id", "pp.full_name")
      .select(
        "pp.id as player_id",
        "pp.full_name as player_name",
        this.repo.db.raw("ROUND(AVG(pee.overall_rating), 2) as average_rating"),
        this.repo.db.raw("COUNT(pee.id)::int as evaluations_count"),
      )
      .orderBy("average_rating", "desc");
  }

  async _playerVisibleEvents(playerId, academyId, filters = {}) {
    const player = await this.repo
      .db("player_profiles")
      .where({ id: playerId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
    if (!player) throw new NotFoundError("Player", playerId);
    const groupRows = await this.repo.findPlayerGroups(playerId);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearRows = await this.repo.findBirthYearsForPlayer(player);
    const birthYearIds = birthYearRows.map((row) => row.id);
    const result = await this.repo.paginate(
      this.repo
        .eventListQuery(academyId, {
          ...filters,
          groupIds,
          birthYearIds,
          playerIds: [playerId],
        })
        .whereNot("ce.visibility", "coaches_only"),
      filters,
      "ce.id",
    );
    const trainingEventIds = result.data
      .filter((event) => event.event_type === "training")
      .map((event) => event.id);
    if (!trainingEventIds.length) return result;

    const [trainingRows, attendanceRows] = await Promise.all([
      this.repo.db("training_sessions").whereIn("event_id", trainingEventIds),
      this.repo
        .db("event_attendance as ea")
        .join("player_profiles as pp", "ea.player_id", "pp.id")
        .whereIn("ea.event_id", trainingEventIds)
        .where("ea.player_id", playerId)
        .select("ea.*", this.repo.db.raw("pp.full_name as player_name")),
    ]);
    const trainingByEvent = new Map(
      trainingRows.map((row) => [row.event_id, row]),
    );
    const attendanceByEvent = new Map(
      attendanceRows.map((row) => [row.event_id, row]),
    );
    return {
      ...result,
      data: result.data.map((event) => ({
        ...event,
        training: trainingByEvent.get(event.id) || null,
        attendance: attendanceByEvent.has(event.id)
          ? [attendanceByEvent.get(event.id)]
          : [],
      })),
    };
  }

  async playerListCalendarEvents(userId, academyId, filters) {
    const player = await this._getPlayer(userId, academyId);
    return this._playerVisibleEvents(player.id, academyId, filters);
  }

  async playerGetProfile(userId, academyId) {
    const currentPlayer = await this._getPlayer(userId, academyId);
    const player = await this.repo
      .db("player_profiles as pp")
      .leftJoin("auth_users as au", "pp.user_id", "au.id")
      .leftJoin("academy_branches as ab", "pp.branch_id", "ab.id")
      .leftJoin("player_group_assignments as pga", function joinCurrentGroup() {
        this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
      })
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .where("pp.id", currentPlayer.id)
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        "au.username",
        "au.phone as account_phone",
        "ab.name as branch_name",
        "ag.id as group_id",
        "ag.name as group_name",
      )
      .first();
    if (!player) throw new NotFoundError("Player", currentPlayer.id);

    const [
      customByPlayer,
      latestMeasurement,
      latestTrainingSummary,
      latestCoachRating,
      healthProfile,
    ] = await Promise.all([
      this._playerCustomProfilesByPlayer([player.id]),
      this.repo
        .db("player_measurements")
        .where({ player_id: player.id })
        .orderBy("measured_at", "desc")
        .first(),
      this.repo
        .db("player_training_summaries")
        .where({ player_id: player.id })
        .orderBy("recorded_at", "desc")
        .first(),
      this.repo
        .db("evaluation_coach_ratings")
        .where({ player_id: player.id })
        .orderBy("eval_date", "desc")
        .first(),
      this.repo
        .db("player_health_profiles")
        .where({ player_id: player.id })
        .first(),
    ]);

    return {
      ...player,
      latestMeasurement: latestMeasurement || null,
      latestTrainingSummary: latestTrainingSummary || null,
      latestCoachRating: latestCoachRating || null,
      healthProfile: healthProfile || null,
      height_cm: latestMeasurement?.height_cm || null,
      weight_kg: latestMeasurement?.weight_kg || null,
      coach_notes: latestTrainingSummary?.coach_notes || null,
      improvement_notes: latestTrainingSummary?.improvement_notes || null,
      strengths: latestCoachRating?.strengths || null,
      weaknesses: latestCoachRating?.weaknesses || null,
      development_plan: latestCoachRating?.development_plan || null,
      final_notes:
        latestCoachRating?.final_notes || latestCoachRating?.notes || null,
      recommended_position: latestCoachRating?.recommended_position || null,
      medical_notes: healthProfile?.medical_notes || null,
      injury_history: healthProfile?.injury_history || null,
      customProfile: customByPlayer.get(player.id) || [],
    };
  }

  async playerGetAttendanceQr(userId, academyId) {
    const currentPlayer = await this._getPlayer(userId, academyId);
    const player = await this.repo
      .db("player_profiles as pp")
      .leftJoin("auth_users as au", "pp.user_id", "au.id")
      .where("pp.id", currentPlayer.id)
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .select("pp.id", "pp.full_name", "pp.player_code", "au.username")
      .first();
    if (!player) throw new NotFoundError("Player", currentPlayer.id);

    const payload =
      player.player_code ||
      player.username ||
      this._buildAttendanceQrPayload({ academyId, player });
    const qrCodeDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "H",
      margin: 3,
      width: 420,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    return {
      playerId: player.id,
      playerName: player.full_name,
      playerCode: player.player_code || null,
      username: player.username || null,
      payload,
      qrCodeDataUrl,
    };
  }

  async playerListTrainings(userId, academyId, filters) {
    return this.playerListCalendarEvents(userId, academyId, {
      ...filters,
      eventType: "training",
    });
  }

  async playerListMatches(userId, academyId, filters) {
    const player = await this._getPlayer(userId, academyId);
    await this._finalizeOverdueMatches(academyId);
    const { query: visibleMatchesQuery } = await this._playerVisibleMatchQuery(
      player,
      academyId,
      filters,
    );
    if (!visibleMatchesQuery) {
      return { data: [], total: 0, page: filters.page || 1, totalPages: 1 };
    }
    const result = await this.repo.paginate(
      visibleMatchesQuery,
      filters,
      "m.id",
    );
    const matchIds = result.data.map((match) => match.id);
    if (!matchIds.length) return result;

    const [squadRows, tacticRows, statRows, attendanceRows] = await Promise.all(
      [
        this.repo
          .db("match_squads as ms")
          .join("player_profiles as pp", "ms.player_id", "pp.id")
          .whereIn("ms.match_id", matchIds)
          .where("ms.player_id", player.id)
          .select(
            "ms.*",
            this.repo.db.raw(
              "COALESCE(ms.player_name_snapshot, pp.full_name) as player_name",
            ),
            this.repo.db.raw(
              "COALESCE(ms.profile_status_snapshot, pp.profile_status::text) as profile_status",
            ),
          ),
        this.repo
          .db("match_tactics as mt")
          .leftJoin("coach_profiles as cp", "mt.coach_id", "cp.id")
          .whereIn("mt.match_id", matchIds)
          .select("mt.*", "cp.full_name as coach_name"),
        this.repo
          .db("match_player_stats as mps")
          .join("matches as m", "mps.match_id", "m.id")
          .join("player_profiles as pp", "mps.player_id", "pp.id")
          .whereIn("mps.match_id", matchIds)
          .where("mps.player_id", player.id)
          .whereNotNull("m.evaluations_finalized_at")
          .select("mps.*", this.repo.db.raw("pp.full_name as player_name")),
        this.repo
          .db("match_attendance as ma")
          .join("player_profiles as pp", "ma.player_id", "pp.id")
          .whereIn("ma.match_id", matchIds)
          .where("ma.player_id", player.id)
          .select("ma.*", this.repo.db.raw("pp.full_name as player_name")),
      ],
    );

    const squadByMatch = new Map(squadRows.map((row) => [row.match_id, row]));
    const tacticsByMatch = new Map(
      tacticRows.map((row) => [row.match_id, row]),
    );
    const statsByMatch = new Map(statRows.map((row) => [row.match_id, row]));
    const attendanceByMatch = new Map(
      attendanceRows.map((row) => [row.match_id, row]),
    );

    return {
      ...result,
      data: result.data.map((match) => ({
        ...match,
        squad: squadByMatch.has(match.id) ? [squadByMatch.get(match.id)] : [],
        tactics: tacticsByMatch.get(match.id) || null,
        stats: statsByMatch.has(match.id) ? [statsByMatch.get(match.id)] : [],
        attendance: attendanceByMatch.has(match.id)
          ? [attendanceByMatch.get(match.id)]
          : [],
      })),
    };
  }

  async playerGetMatch(userId, academyId, matchId) {
    const player = await this._getPlayer(userId, academyId);
    const match = await this.adminGetMatch(academyId, matchId);
    const { query: visibleMatchesQuery } = await this._playerVisibleMatchQuery(
      player,
      academyId,
      {},
    );
    const visibleMatch = visibleMatchesQuery
      ? await visibleMatchesQuery.where("m.id", matchId).first()
      : null;
    if (!visibleMatch)
      throw new ForbiddenError("Player cannot access this match");
    return {
      ...match,
      squad: (match.squad || []).filter((row) => row.player_id === player.id),
      stats: match.evaluations_finalized_at
        ? (match.stats || []).filter((row) => row.player_id === player.id)
        : [],
      attendance: (match.attendance || []).filter(
        (row) => row.player_id === player.id,
      ),
      incidents: (match.incidents || []).filter(
        (row) => row.player_id === player.id,
      ),
    };
  }

  async playerGetMatchStats(userId, academyId, matchId) {
    const player = await this._getPlayer(userId, academyId);
    const match = await this.playerGetMatch(userId, academyId, matchId);
    if (!match.evaluations_finalized_at) {
      return null;
    }
    return this.repo
      .db("match_player_stats")
      .where({ match_id: matchId, player_id: player.id })
      .first();
  }

  async _combinedPlayerAttendanceHistory(playerId, academyId, filters = {}) {
    const { page, limit } = normalizePagination({
      page: filters.page,
      limit: filters.limit || 50,
    });
    const db = this.repo.db;
    const player = await db("player_profiles")
      .where({ id: playerId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
    if (!player) throw new NotFoundError("Player", playerId);

    const [groupRows, birthYearRows] = await Promise.all([
      this.repo.findPlayerGroups(player.id),
      this.repo.findBirthYearsForPlayer(player),
    ]);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearIds = birthYearRows.map((row) => row.id);

    const visiblePastTrainingsQuery = this.repo
      .eventListQuery(academyId, {
        eventType: "training",
        groupIds,
        birthYearIds,
        playerIds: [player.id],
      })
      .whereNot("ce.visibility", "coaches_only")
      .whereNotIn("ce.status", ["cancelled", "postponed"])
      .whereRaw("ce.start_datetime <= CURRENT_TIMESTAMP");
    const visiblePastMatchesQuery = this._configuredMatchQueryForPlayer(
      academyId,
      {},
      { playerId: player.id, groupIds, birthYearIds },
    )?.andWhere((scope) => {
      scope
        .where("m.match_status", "finished")
        .orWhere("m.status", "completed")
        .orWhereRaw("m.match_date <= CURRENT_DATE");
    });

    const [trainingRows, matchRows, visiblePastTrainings, visiblePastMatches] =
      await Promise.all([
        db("event_attendance as ea")
          .join("calendar_events as ce", "ea.event_id", "ce.id")
          .where("ea.player_id", playerId)
          .where("ce.academy_id", academyId)
          .whereNull("ce.deleted_at")
          .whereNot("ce.status", "cancelled")
          .select(
            db.raw("'training' as record_type"),
            db.raw("CONCAT('training:', ea.id) as id"),
            "ea.id as source_id",
            "ea.event_id",
            "ea.player_id",
            "ea.status",
            "ea.arrival_time",
            "ea.reason",
            "ea.notes",
            "ce.title",
            "ce.event_type",
            "ce.start_datetime",
            "ce.location",
            db.raw("ce.start_datetime as sort_datetime"),
          ),
        db("match_attendance as ma")
          .join("matches as m", "ma.match_id", "m.id")
          .join("calendar_events as ce", "ce.id", "m.event_id")
          .where("ma.player_id", playerId)
          .where("ce.academy_id", academyId)
          .whereNull("m.deleted_at")
          .whereNull("ce.deleted_at")
          .whereNot("m.status", "cancelled")
          .whereNot("m.match_status", "cancelled")
          .select(
            db.raw("'match' as record_type"),
            db.raw("CONCAT('match:', ma.id) as id"),
            "ma.id as source_id",
            "ma.match_id",
            "ma.player_id",
            "ma.status",
            "ma.notes",
            "m.opponent_name",
            "m.match_date",
            "m.match_time",
            "m.location",
            db.raw("'match' as event_type"),
            db.raw("CONCAT('Match vs ', m.opponent_name) as title"),
            db.raw(
              "(m.match_date::timestamp + COALESCE(m.match_time, '00:00:00'::time)) as start_datetime",
            ),
            db.raw(
              "(m.match_date::timestamp + COALESCE(m.match_time, '00:00:00'::time)) as sort_datetime",
            ),
          ),
        visiblePastTrainingsQuery
          .clone()
          .clearOrder()
          .select(db.raw("ce.start_datetime as sort_datetime")),
        visiblePastMatchesQuery
          ? visiblePastMatchesQuery
              .clone()
              .clearOrder()
              .select(
                db.raw(
                  "(m.match_date::timestamp + COALESCE(m.match_time, '00:00:00'::time)) as sort_datetime",
                ),
              )
          : Promise.resolve([]),
      ]);

    const attendedTrainingEventIds = new Set(
      trainingRows.map((row) => String(row.event_id)),
    );
    const attendedMatchIds = new Set(
      matchRows.map((row) => String(row.match_id)),
    );
    const syntheticTrainingRows = visiblePastTrainings
      .filter((event) => !attendedTrainingEventIds.has(String(event.id)))
      .map((event) => ({
        record_type: "training",
        id: `training-missing:${event.id}`,
        source_id: null,
        event_id: event.id,
        player_id: playerId,
        status: "absent",
        arrival_time: null,
        reason: null,
        notes: "No attendance was recorded for this scheduled training.",
        title: event.title,
        event_type: event.event_type,
        start_datetime: event.start_datetime,
        location: event.location,
        sort_datetime: event.sort_datetime || event.start_datetime,
        inferred_absence: true,
      }));
    const syntheticMatchRows = visiblePastMatches
      .filter((match) => !attendedMatchIds.has(String(match.id)))
      .map((match) => ({
        record_type: "match",
        id: `match-missing:${match.id}`,
        source_id: null,
        match_id: match.id,
        player_id: playerId,
        status: "absent",
        notes: "No attendance was recorded for this scheduled match.",
        opponent_name: match.opponent_name,
        match_date: match.match_date,
        match_time: match.match_time,
        location: match.location,
        event_type: "match",
        title: `Match vs ${match.opponent_name}`,
        start_datetime:
          match.start_datetime ||
          `${match.match_date}T${String(match.match_time || "00:00:00").slice(0, 8)}`,
        sort_datetime:
          match.sort_datetime ||
          match.start_datetime ||
          `${match.match_date}T${String(match.match_time || "00:00:00").slice(0, 8)}`,
        inferred_absence: true,
      }));

    const rows = [
      ...trainingRows,
      ...matchRows,
      ...syntheticTrainingRows,
      ...syntheticMatchRows,
    ].sort((a, b) => {
      const aTime = Date.parse(String(a.sort_datetime || ""));
      const bTime = Date.parse(String(b.sort_datetime || ""));
      return (
        (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
      );
    });
    const total = rows.length;
    const offset = (page - 1) * limit;
    return {
      data: rows.slice(offset, offset + limit).map((item) => {
        const row = { ...item };
        delete row.sort_datetime;
        return row;
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async playerAttendanceHistory(userId, academyId, filters) {
    const player = await this._getPlayer(userId, academyId);
    return this._combinedPlayerAttendanceHistory(player.id, academyId, filters);
  }

  async playerEvaluations(userId, academyId, filters) {
    const player = await this._getPlayer(userId, academyId);
    const query = this.repo
      .db("player_event_evaluations as pee")
      .join("calendar_events as ce", "pee.event_id", "ce.id")
      .where("pee.player_id", player.id)
      .where("ce.academy_id", academyId)
      .whereNull("ce.deleted_at")
      .whereNot("ce.status", "cancelled")
      .where("pee.visibility", "player_and_parent")
      .select("pee.*", "ce.title", "ce.event_type", "ce.start_datetime")
      .orderBy("ce.start_datetime", "desc");
    return this.repo.paginate(query, filters, "pee.id");
  }

  async playerProgress(userId, academyId, playerId = null) {
    await this._finalizeOverdueMatches(academyId);
    const player = playerId
      ? await this.repo
          .db("player_profiles")
          .where({ id: playerId, academy_id: academyId })
          .whereNull("deleted_at")
          .first()
      : await this._getPlayer(userId, academyId);
    if (!player) throw new NotFoundError("Player", playerId);

    const groupRows = await this.repo.findPlayerGroups(player.id);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearRows = await this.repo.findBirthYearsForPlayer(player);
    const birthYearIds = birthYearRows.map((row) => row.id);
    const matchAccessContext = { playerId: player.id, groupIds, birthYearIds };
    const countRows = async (query) => {
      const { count } = await this.repo.db
        .from(query.clone().clearOrder().as("counted_rows"))
        .count("* as count")
        .first();
      return Number(count || 0);
    };
    const visiblePastTrainingsQuery = this.repo
      .eventListQuery(academyId, {
        eventType: "training",
        groupIds,
        birthYearIds,
        playerIds: [player.id],
      })
      .whereNot("ce.visibility", "coaches_only")
      .whereNotIn("ce.status", ["cancelled", "postponed"])
      .whereRaw("ce.start_datetime >= date_trunc('month', CURRENT_DATE)")
      .whereRaw(
        "ce.start_datetime < date_trunc('month', CURRENT_DATE) + interval '1 month'",
      )
      .whereRaw("ce.start_datetime <= CURRENT_TIMESTAMP");
    const visiblePastMatchesQuery = this._configuredMatchQueryForPlayer(
      academyId,
      {},
      matchAccessContext,
    )
      .andWhere((scope) => {
        scope
          .where("m.match_status", "finished")
          .orWhere("m.status", "completed")
          .orWhereRaw("m.match_date <= CURRENT_DATE");
      })
      .whereRaw("m.match_date >= date_trunc('month', CURRENT_DATE)::date")
      .whereRaw(
        "m.match_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date",
      );

    const [
      trainingAttendance,
      matchAttendance,
      squadFinishedMatches,
      visiblePastTrainings,
      visiblePastMatches,
      evaluations,
      matchRatings,
      stats,
      monthlyMinutes,
    ] = await Promise.all([
      this.repo
        .db("event_attendance as ea")
        .join("calendar_events as ce", "ea.event_id", "ce.id")
        .where("ea.player_id", player.id)
        .where("ce.academy_id", academyId)
        .where("ce.event_type", "training")
        .whereNull("ce.deleted_at")
        .whereNot("ce.status", "cancelled")
        .whereRaw("ce.start_datetime >= date_trunc('month', CURRENT_DATE)")
        .whereRaw(
          "ce.start_datetime < date_trunc('month', CURRENT_DATE) + interval '1 month'",
        )
        .select(
          this.repo.db.raw("COUNT(*)::int as total"),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE ea.status IN ('present','late'))::int as attended",
          ),
        )
        .first(),
      this.repo
        .db("match_attendance as ma")
        .join("matches as m", "ma.match_id", "m.id")
        .join("calendar_events as ce", "ce.id", "m.event_id")
        .where("ma.player_id", player.id)
        .whereNull("m.deleted_at")
        .whereNull("ce.deleted_at")
        .whereNot("m.status", "cancelled")
        .whereNot("m.match_status", "cancelled")
        .whereRaw("m.match_date >= date_trunc('month', CURRENT_DATE)::date")
        .whereRaw(
          "m.match_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date",
        )
        .select(
          this.repo.db.raw("COUNT(*)::int as total"),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE ma.status IN ('present','late'))::int as attended",
          ),
        )
        .first(),
      this.repo
        .db("match_squads as ms")
        .join("matches as m", "ms.match_id", "m.id")
        .join("calendar_events as ce", "ce.id", "m.event_id")
        .where("ms.player_id", player.id)
        .andWhere((scope) => {
          scope
            .where("m.status", "completed")
            .orWhere("m.match_status", "finished");
        })
        .whereNull("m.deleted_at")
        .whereNull("ce.deleted_at")
        .whereNot("m.status", "cancelled")
        .whereNot("m.match_status", "cancelled")
        .whereRaw("m.match_date >= date_trunc('month', CURRENT_DATE)::date")
        .whereRaw(
          "m.match_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date",
        )
        .count("ms.id as count")
        .first(),
      countRows(visiblePastTrainingsQuery),
      countRows(visiblePastMatchesQuery),
      this.repo
        .db("player_event_evaluations as pee")
        .join("calendar_events as ce", "pee.event_id", "ce.id")
        .where("pee.player_id", player.id)
        .where("ce.academy_id", academyId)
        .where("pee.visibility", "player_and_parent")
        .whereNull("ce.deleted_at")
        .whereNot("ce.status", "cancelled")
        .whereRaw("ce.start_datetime >= date_trunc('month', CURRENT_DATE)")
        .whereRaw(
          "ce.start_datetime < date_trunc('month', CURRENT_DATE) + interval '1 month'",
        )
        .select(
          this.repo.db.raw("AVG(pee.overall_rating) as average"),
          this.repo.db.raw("COUNT(pee.overall_rating)::int as count"),
        )
        .first(),
      this.repo
        .db("match_player_stats as mps")
        .join("matches as m", "mps.match_id", "m.id")
        .join("calendar_events as ce", "ce.id", "m.event_id")
        .where("mps.player_id", player.id)
        .whereNull("m.deleted_at")
        .whereNull("ce.deleted_at")
        .whereNot("m.status", "cancelled")
        .whereNot("m.match_status", "cancelled")
        .whereNotNull("m.evaluations_finalized_at")
        .whereRaw("m.match_date >= date_trunc('month', CURRENT_DATE)::date")
        .whereRaw(
          "m.match_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date",
        )
        .select(
          this.repo.db.raw("AVG(mps.performance_rating) as average"),
          this.repo.db.raw("COUNT(mps.performance_rating)::int as count"),
        )
        .first(),
      this.repo
        .db("match_player_stats as mps")
        .join("matches as m", "mps.match_id", "m.id")
        .join("calendar_events as ce", "ce.id", "m.event_id")
        .where("mps.player_id", player.id)
        .whereNull("m.deleted_at")
        .whereNull("ce.deleted_at")
        .whereNot("m.status", "cancelled")
        .whereNot("m.match_status", "cancelled")
        .whereNotNull("m.evaluations_finalized_at")
        .whereRaw("m.match_date >= date_trunc('month', CURRENT_DATE)::date")
        .whereRaw(
          "m.match_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date",
        )
        .sum({
          goals: "mps.goals",
          assists: "mps.assists",
          yellow_cards: "mps.yellow_cards",
          red_cards: "mps.red_cards",
        })
        .first(),
      this.repo
        .db("match_player_stats as mps")
        .join("matches as m", "mps.match_id", "m.id")
        .join("calendar_events as ce", "ce.id", "m.event_id")
        .where("mps.player_id", player.id)
        .whereNull("m.deleted_at")
        .whereNull("ce.deleted_at")
        .whereNot("m.status", "cancelled")
        .whereNot("m.match_status", "cancelled")
        .whereNotNull("m.evaluations_finalized_at")
        .whereRaw("m.match_date >= date_trunc('month', CURRENT_DATE)::date")
        .whereRaw(
          "m.match_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date",
        )
        .select(
          this.repo.db.raw(
            "COALESCE(SUM(mps.minutes_played), 0)::int as minutes",
          ),
          this.repo.db.raw(
            "COUNT(*) FILTER (WHERE mps.minutes_played > 0)::int as matches",
          ),
          this.repo.db.raw(
            "date_trunc('month', CURRENT_DATE)::date as month_start",
          ),
          this.repo.db.raw(
            "(date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date as month_end",
          ),
        )
        .first(),
    ]);

    const recordedTrainingTotal = Number(trainingAttendance?.total || 0);
    const recordedTrainingAttended = Number(trainingAttendance?.attended || 0);
    const recordedMatchTotal = Number(matchAttendance?.total || 0);
    const recordedMatchAttended = Number(matchAttendance?.attended || 0);
    const trainingTotal = Math.max(recordedTrainingTotal, visiblePastTrainings);
    const trainingAttended = recordedTrainingTotal
      ? recordedTrainingAttended
      : visiblePastTrainings;
    const matchTotal = Math.max(recordedMatchTotal, visiblePastMatches);
    const matchAttended = recordedMatchTotal
      ? recordedMatchAttended
      : visiblePastMatches;
    const matchesPlayed = Math.max(
      Number(squadFinishedMatches?.count || 0),
      recordedMatchAttended,
      visiblePastMatches,
    );
    const total = trainingTotal + matchTotal;
    const attended = trainingAttended + matchAttended;
    const trainingRatingCount = Number(evaluations?.count || 0);
    const matchRatingCount = Number(matchRatings?.count || 0);
    const trainingRatingAverage = Number(evaluations?.average || 0);
    const matchRatingAverage = Number(matchRatings?.average || 0);
    const ratingCount = trainingRatingCount + matchRatingCount;
    const averageOverallRating = ratingCount
      ? (trainingRatingAverage * trainingRatingCount +
          matchRatingAverage * matchRatingCount) /
        ratingCount
      : 0;
    return {
      playerId: player.id,
      playerName: player.full_name,
      attendancePercentage: total ? Math.round((attended / total) * 100) : 0,
      trainingAttendancePercentage: trainingTotal
        ? Math.round((trainingAttended / trainingTotal) * 100)
        : 0,
      matchAttendancePercentage: matchTotal
        ? Math.round((matchAttended / matchTotal) * 100)
        : 0,
      trainingsAttended: trainingAttended,
      trainingsRecorded: trainingTotal,
      matchesPlayed,
      matchesAttended: matchAttended,
      matchesRecorded: matchTotal,
      averageOverallRating,
      averageTrainingRating: trainingRatingAverage,
      averageMatchRating: matchRatingAverage,
      goals: Number(stats?.goals || 0),
      assists: Number(stats?.assists || 0),
      monthlyMinutesPlayed: Number(monthlyMinutes?.minutes || 0),
      monthlyMatchesPlayed: Number(monthlyMinutes?.matches || 0),
      monthStart: monthlyMinutes?.month_start || null,
      monthEnd: monthlyMinutes?.month_end || null,
      weeklyMinutesPlayed: Number(monthlyMinutes?.minutes || 0),
      weeklyMatchesPlayed: Number(monthlyMinutes?.matches || 0),
      weekStart: monthlyMinutes?.month_start || null,
      weekEnd: monthlyMinutes?.month_end || null,
      disciplineRecord: {
        yellowCards: Number(stats?.yellow_cards || 0),
        redCards: Number(stats?.red_cards || 0),
      },
      attendanceTotals: {
        total,
        attended,
        trainingTotal,
        trainingAttended,
        matchTotal,
        matchAttended,
      },
      monthlyProgressSummary:
        "Generated from training attendance, match attendance, evaluations, and match stats.",
    };
  }

  _shapePlayerAssignmentSubmission(row) {
    return this.playerAssignments.shapeSubmission(row);
  }

  async storePlayerAssignmentUpload(user, { originalName, mimeType, buffer }) {
    return this.playerAssignments.storeUpload(user, {
      originalName,
      mimeType,
      buffer,
    });
  }

  async playerListAssignments(userId, academyId, filters = {}) {
    if (this.playerAssignments) {
      return this.playerAssignments.listForPlayer(userId, academyId, filters);
    }

    const player = await this._getPlayer(userId, academyId);
    const { page, limit, offset } = normalizePagination({
      page: filters.page,
      limit: filters.limit || 50,
    });
    const db = this.repo.db;
    const [{ today }] = await db
      .raw("SELECT current_date::text AS today")
      .then((result) => result.rows);
    const [groupRows, birthYearRows] = await Promise.all([
      this.repo.findPlayerGroups(player.id),
      this.repo.findBirthYearsForPlayer(player),
    ]);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearIds = birthYearRows.map((row) => row.id);

    const [dailyInput, assignmentRows] = await Promise.all([
      db("player_daily_ai_inputs")
        .where({
          academy_id: academyId,
          player_id: player.id,
          input_date: today,
        })
        .first(),
      groupIds.length || birthYearIds.length
        ? db("player_assignments as pa")
            .join(
              "player_assignment_groups as pag",
              "pa.id",
              "pag.assignment_id",
            )
            .join("coach_profiles as cp", "pa.created_by_coach_id", "cp.id")
            .where("pa.academy_id", academyId)
            .where((targetScope) => {
              if (groupIds.length) {
                targetScope.orWhere((groupScope) => {
                  groupScope
                    .where((typeScope) => {
                      typeScope
                        .whereNull("pa.target_type")
                        .orWhere("pa.target_type", "group");
                    })
                    .whereIn("pag.group_id", groupIds);
                });
              }
              if (birthYearIds.length) {
                targetScope.orWhereExists((existsQuery) => {
                  existsQuery
                    .select(db.raw("1"))
                    .from("player_assignment_birth_years as paby")
                    .whereRaw("paby.assignment_id = pa.id")
                    .whereIn("paby.birth_year_id", birthYearIds);
                });
              }
            })
            .whereNull("pa.deleted_at")
            .where("pa.status", "active")
            .where((scope) => {
              scope
                .whereNull("pa.open_at")
                .orWhere("pa.open_at", "<=", new Date());
            })
            .groupBy("pa.id", "cp.full_name")
            .select("pa.*", "cp.full_name as coach_name")
            .orderBy("pa.due_at", "asc")
            .orderBy("pa.created_at", "desc")
        : [],
    ]);

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    const [groups, submissions] = await Promise.all([
      assignmentIds.length
        ? db("player_assignment_groups as pag")
            .join("academy_groups as ag", "pag.group_id", "ag.id")
            .whereIn("pag.assignment_id", assignmentIds)
            .select("pag.assignment_id", "ag.id", "ag.name")
        : [],
      assignmentIds.length
        ? db("player_assignment_submissions")
            .whereIn("assignment_id", assignmentIds)
            .where("player_id", player.id)
        : [],
    ]);
    const submissionIds = submissions.map((submission) => submission.id);
    const files = submissionIds.length
      ? await db("player_assignment_files").whereIn(
          "submission_id",
          submissionIds,
        )
      : [];
    const groupsByAssignment = groups.reduce((acc, group) => {
      if (!acc[group.assignment_id]) acc[group.assignment_id] = [];
      acc[group.assignment_id].push({ id: group.id, name: group.name });
      return acc;
    }, {});
    const filesBySubmission = files.reduce((acc, file) => {
      if (!acc[file.submission_id]) acc[file.submission_id] = [];
      acc[file.submission_id].push(file);
      return acc;
    }, {});
    const submissionByAssignment = new Map(
      submissions.map((submission) => [
        submission.assignment_id,
        {
          ...submission,
          files: filesBySubmission[submission.id] || [],
        },
      ]),
    );

    const dailyAssignment = {
      id: "daily-ai-score",
      assignmentType: "daily_ai",
      title: "Daily AI Score Module",
      description:
        "Daily model input: sleep_hours, trained_today, meals_count.",
      openAt: `${today}T00:00:00`,
      dueAt: `${today}T23:59:59`,
      status: "active",
      isSystemDaily: true,
      acceptedFileTypes: [],
      groups: [],
      submission: this._shapeDailyAiInput(dailyInput),
      scoringRules: {
        sleep: ["sleep >= 8h = 40", "sleep >= 7h = 30", "otherwise = 20"],
        training: ["trained_today 1 = 40", "trained_today 0 = 0"],
        meals: ["4+ meals = 20", "3 meals = 15", "less than 3 meals = 10"],
        output: "daily_ai_score",
      },
    };

    const normalAssignments = assignmentRows.map((assignment) => ({
      id: assignment.id,
      assignmentType: "coach_task",
      title: assignment.title,
      description: assignment.description || "",
      coachName: assignment.coach_name || null,
      openAt: assignment.open_at,
      dueAt: assignment.due_at,
      status: assignment.status,
      isSystemDaily: false,
      acceptedFileTypes: assignment.accepted_file_types || [
        "pdf",
        "word",
        "image",
      ],
      groups: groupsByAssignment[assignment.id] || [],
      submission: this._shapePlayerAssignmentSubmission(
        submissionByAssignment.get(assignment.id),
      ),
    }));
    const rows =
      page === 1
        ? [dailyAssignment, ...normalAssignments].slice(offset, offset + limit)
        : normalAssignments.slice(offset - 1, offset - 1 + limit);
    const total = normalAssignments.length + 1;

    return {
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async _getVisiblePlayerAssignment(player, academyId, assignmentId) {
    const [groupRows, birthYearRows] = await Promise.all([
      this.repo.findPlayerGroups(player.id),
      this.repo.findBirthYearsForPlayer(player),
    ]);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearIds = birthYearRows.map((row) => row.id);
    if (!groupIds.length && !birthYearIds.length) return null;
    return this.repo
      .db("player_assignments as pa")
      .join("player_assignment_groups as pag", "pa.id", "pag.assignment_id")
      .where("pa.id", assignmentId)
      .where("pa.academy_id", academyId)
      .where((targetScope) => {
        if (groupIds.length) {
          targetScope.orWhere((groupScope) => {
            groupScope
              .where((typeScope) => {
                typeScope
                  .whereNull("pa.target_type")
                  .orWhere("pa.target_type", "group");
              })
              .whereIn("pag.group_id", groupIds);
          });
        }
        if (birthYearIds.length) {
          targetScope.orWhereExists((existsQuery) => {
            existsQuery
              .select(this.repo.db.raw("1"))
              .from("player_assignment_birth_years as paby")
              .whereRaw("paby.assignment_id = pa.id")
              .whereIn("paby.birth_year_id", birthYearIds);
          });
        }
      })
      .whereNull("pa.deleted_at")
      .where("pa.status", "active")
      .select("pa.*")
      .first();
  }

  async playerSubmitAssignment(userId, academyId, assignmentId, data) {
    return this.playerAssignments.submit(userId, academyId, assignmentId, data);
  }

  async playerSubmitDailyAiInput(userId, academyId, data) {
    return this.playerAssignments.submitDailyAiInput(userId, academyId, data);
  }

  async playerListParentNotes(userId, academyId, filters) {
    const player = await this._getPlayer(userId, academyId);
    return this.repo.listPlayerVisibleParentNotes(
      academyId,
      player.id,
      filters,
    );
  }

  async adminListParentLinks(academyId, filters = {}) {
    return this.repo.listAdminParentLinks(academyId, filters);
  }

  async adminListParentAccounts(academyId, filters = {}) {
    return this.repo.listAdminParentAccounts(academyId, filters);
  }

  async adminListLinkablePlayers(academyId, filters = {}) {
    return this.repo.listAdminLinkablePlayers(academyId, filters);
  }

  async adminGetParentProfile(academyId, parentUserId) {
    const parent = await this.repo.findParentAccountById(
      parentUserId,
      academyId,
    );
    if (!parent) throw new NotFoundError("Parent account", parentUserId);

    const links = await this.repo.listAdminParentLinks(academyId, {
      parentUserId,
      page: 1,
      limit: 500,
    });
    const children = await Promise.all(
      links.data.map((link) =>
        this._managedPlayerDetail(academyId, link.player_id),
      ),
    );
    return { parent, links: links.data, children };
  }

  async _scopedCoachPlayerIds(userId, academyId) {
    const coach = await this._getCoach(userId, academyId);
    const players = await this.repo.findCoachScopedPlayers(coach.id, academyId);
    return {
      coach,
      playerIds: players.map((player) => player.id),
    };
  }

  emptyPage(filters = {}) {
    return {
      data: [],
      total: 0,
      page: filters.page || 1,
      totalPages: 1,
    };
  }

  async createParentAccount(academyId, actorUserId, data) {
    const username = data.username.trim().toLowerCase();
    const phone = data.phone.trim();

    const conflict = await this.repo.findParentIdentityConflict({
      username,
      phone,
    });
    if (conflict) {
      throw new ConflictError(
        `${conflict.field} is already used by another user. Choose a different ${conflict.field}.`,
      );
    }

    try {
      const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
      const parent = await this.repo.createParentAccount({
        academyId,
        actorUserId,
        fullName: data.fullName.trim(),
        username,
        phone,
        passwordHash,
        address: data.address.trim(),
      });

      return {
        ...parent,
        relationship: data.relationship || "guardian",
      };
    } catch (err) {
      if (err.code === "23505") {
        throw new ConflictError(
          "User with this username or phone already exists",
        );
      }
      throw err;
    }
  }

  async adminCreateParentAccount(academyId, actorUserId, data) {
    return this.createParentAccount(academyId, actorUserId, data);
  }

  async adminCreateParentLink(academyId, actorUserId, data) {
    const [parent, player] = await Promise.all([
      this.repo.findParentUser(data.parentUserId, academyId),
      this.repo.findPlayerForParentLink(data.playerId, academyId),
    ]);

    if (!parent) throw new NotFoundError("Parent account", data.parentUserId);
    if (!player) throw new NotFoundError("Player", data.playerId);

    const existing = await this.repo.listAdminParentLinks(academyId, {
      parentUserId: data.parentUserId,
      playerId: data.playerId,
      page: 1,
      limit: 1,
    });
    if (existing.total > 0) {
      throw new ConflictError("This parent is already linked to this player");
    }

    return this.repo.createParentPlayerLink({
      academy_id: academyId,
      parent_user_id: data.parentUserId,
      player_id: data.playerId,
      relation: data.relation || "guardian",
      is_primary: Boolean(data.isPrimary),
      can_view_progress: data.canViewProgress !== false,
      can_view_payments: data.canViewPayments !== false,
      can_message_coach: data.canMessageCoach !== false,
      created_by_user_id: actorUserId,
    });
  }

  async adminCreateParentLinkByQr(academyId, actorUserId, data) {
    const player = await this._resolveAttendanceQrPlayer(academyId, data);
    return this.adminCreateParentLink(academyId, actorUserId, {
      ...data,
      playerId: player.id,
    });
  }

  async adminUpdateParentLink(academyId, linkId, data) {
    const link = await this.repo.findParentPlayerLink(linkId, academyId);
    if (!link) throw new NotFoundError("Parent link", linkId);

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(data, "relation")) {
      patch.relation = data.relation || "guardian";
    }
    if (Object.prototype.hasOwnProperty.call(data, "isPrimary")) {
      patch.is_primary = Boolean(data.isPrimary);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canViewProgress")) {
      patch.can_view_progress = Boolean(data.canViewProgress);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canViewPayments")) {
      patch.can_view_payments = Boolean(data.canViewPayments);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canMessageCoach")) {
      patch.can_message_coach = Boolean(data.canMessageCoach);
    }

    return this.repo.updateParentPlayerLink(linkId, academyId, patch);
  }

  async adminDeleteParentLink(academyId, linkId) {
    const deleted = await this.repo.deleteParentPlayerLink(linkId, academyId);
    if (!deleted) throw new NotFoundError("Parent link", linkId);
    return { deleted: true, id: linkId };
  }

  async coachListParentLinks(userId, academyId, filters = {}) {
    const { playerIds } = await this._scopedCoachPlayerIds(userId, academyId);
    if (!playerIds.length) return this.emptyPage(filters);
    return this.repo.listAdminParentLinks(academyId, {
      ...filters,
      playerIds,
    });
  }

  async coachListParentAccounts(userId, academyId, filters = {}) {
    await this._getCoach(userId, academyId);
    return this.repo.listAdminParentAccounts(academyId, filters);
  }

  async coachListLinkablePlayers(userId, academyId, filters = {}) {
    const { playerIds } = await this._scopedCoachPlayerIds(userId, academyId);
    if (!playerIds.length) return this.emptyPage(filters);
    return this.repo.listAdminLinkablePlayers(academyId, {
      ...filters,
      playerIds,
    });
  }

  async coachGetParentProfile(userId, academyId, parentUserId) {
    const { playerIds } = await this._scopedCoachPlayerIds(userId, academyId);
    const parent = await this.repo.findParentAccountById(
      parentUserId,
      academyId,
    );
    if (!parent) throw new NotFoundError("Parent account", parentUserId);

    const links = await this.repo.listAdminParentLinks(academyId, {
      parentUserId,
      playerIds,
      page: 1,
      limit: 500,
    });
    const children = await Promise.all(
      links.data.map((link) =>
        this._managedPlayerDetail(academyId, link.player_id),
      ),
    );
    return { parent, links: links.data, children };
  }

  async coachCreateParentAccount(userId, academyId, data) {
    await this._getCoach(userId, academyId);
    return this.createParentAccount(academyId, userId, data);
  }

  async coachCreateParentLink(userId, academyId, data) {
    const coach = await this._getCoach(userId, academyId);
    await this._ensureCoachCanAccessPlayers(coach, academyId, [data.playerId]);
    return this.adminCreateParentLink(academyId, userId, data);
  }

  async coachCreateParentLinkByQr(userId, academyId, data) {
    const coach = await this._getCoach(userId, academyId);
    const player = await this._resolveAttendanceQrPlayer(academyId, data);
    await this._ensureCoachCanAccessPlayers(coach, academyId, [player.id]);
    return this.adminCreateParentLink(academyId, userId, {
      ...data,
      playerId: player.id,
    });
  }

  async coachUpdateParentLink(userId, academyId, linkId, data) {
    const coach = await this._getCoach(userId, academyId);
    const link = await this.repo.findParentPlayerLink(linkId, academyId);
    if (!link) throw new NotFoundError("Parent link", linkId);
    await this._ensureCoachCanAccessPlayers(coach, academyId, [link.player_id]);
    return this.adminUpdateParentLink(academyId, linkId, data);
  }

  async coachDeleteParentLink(userId, academyId, linkId) {
    const coach = await this._getCoach(userId, academyId);
    const link = await this.repo.findParentPlayerLink(linkId, academyId);
    if (!link) throw new NotFoundError("Parent link", linkId);
    await this._ensureCoachCanAccessPlayers(coach, academyId, [link.player_id]);
    return this.adminDeleteParentLink(academyId, linkId);
  }

  _shapeParentChild(row, coaches = []) {
    return {
      id: row.id,
      full_name: row.full_name,
      player_code: row.player_code || null,
      position: row.position || null,
      level: row.level || null,
      date_of_birth: row.date_of_birth || null,
      height_cm: row.height_cm || null,
      weight_kg: row.weight_kg || null,
      preferred_foot: row.preferred_foot || null,
      profile_status: row.profile_status || null,
      branch_id: row.branch_id || null,
      branch_name: row.branch_name || null,
      group_id: row.group_id || null,
      group_name: row.group_name || null,
      relation: row.relation || "guardian",
      is_primary: Boolean(row.is_primary),
      can_view_progress: row.can_view_progress !== false,
      can_view_payments: row.can_view_payments !== false,
      can_message_coach: row.can_message_coach !== false,
      coaches: coaches.map((coach) => ({
        id: coach.id,
        user_id: coach.user_id,
        full_name: coach.full_name,
        specialization: coach.specialization || null,
      })),
    };
  }

  async parentListChildren(parentUserId, academyId) {
    const children = await this.repo.findParentLinkedPlayers(
      parentUserId,
      academyId,
    );
    const coachesByChild = await Promise.all(
      children.map(async (child) => [
        child.id,
        await this.repo.findCoachesForPlayer(child, academyId),
      ]),
    );
    const coachMap = new Map(coachesByChild);
    return children.map((child) =>
      this._shapeParentChild(child, coachMap.get(child.id) || []),
    );
  }

  async _latestParentAiInsights(academyId, childId) {
    const [injuryRisk, performance, ranking, latestCoachEvaluation] =
      await Promise.all([
        this.repo
          .db("ai_analyses as aia")
          .join("player_profiles as pp", "aia.player_id", "pp.id")
          .where("aia.player_id", childId)
          .where("pp.academy_id", academyId)
          .where("aia.type", "injury_risk")
          .whereNull("pp.deleted_at")
          .select("aia.*")
          .orderBy("aia.created_at", "desc")
          .first(),
        this.repo
          .db("ai_analyses as aia")
          .join("player_profiles as pp", "aia.player_id", "pp.id")
          .where("aia.player_id", childId)
          .where("pp.academy_id", academyId)
          .where("aia.type", "performance")
          .whereNull("pp.deleted_at")
          .select("aia.*")
          .orderBy("aia.created_at", "desc")
          .first(),
        this.repo
          .db("ranking_snapshots as rs")
          .join("player_profiles as pp", "rs.player_id", "pp.id")
          .leftJoin("ranking_score_breakdown as rsb", "rsb.ranking_id", "rs.id")
          .where("rs.player_id", childId)
          .where("pp.academy_id", academyId)
          .whereNull("pp.deleted_at")
          .select(
            "rs.*",
            "rsb.coach_eval_score",
            "rsb.attendance_score",
            "rsb.discipline_score",
            "rsb.match_score",
            "rsb.ai_score",
          )
          .orderBy("rs.period", "desc")
          .orderBy("rs.calculated_at", "desc")
          .first(),
        this.repo
          .db("player_event_evaluations as pee")
          .join("calendar_events as ce", "pee.event_id", "ce.id")
          .leftJoin("coach_profiles as cp", "pee.coach_id", "cp.id")
          .where("pee.player_id", childId)
          .where("ce.academy_id", academyId)
          .where("pee.visibility", "player_and_parent")
          .whereNull("ce.deleted_at")
          .whereNot("ce.status", "cancelled")
          .select(
            "pee.*",
            "ce.title",
            "ce.event_type",
            "ce.start_datetime",
            "cp.full_name as coach_name",
          )
          .orderBy("ce.start_datetime", "desc")
          .first(),
      ]);

    return {
      injuryRisk: injuryRisk
        ? {
            player_id: injuryRisk.player_id,
            analysis_id: injuryRisk.id,
            input: injuryRisk.input_data || null,
            prediction: injuryRisk.result || null,
            model_version: injuryRisk.model_version || null,
            created_at: injuryRisk.created_at || null,
          }
        : null,
      aiEvaluation: performance
        ? {
            player_id: performance.player_id,
            analysis_id: performance.id,
            input: performance.input_data || null,
            result: performance.result || null,
            model_version: performance.model_version || null,
            created_at: performance.created_at || null,
          }
        : null,
      coachEvaluation: latestCoachEvaluation
        ? {
            id: latestCoachEvaluation.id,
            player_id: latestCoachEvaluation.player_id,
            event_id: latestCoachEvaluation.event_id,
            event_title: latestCoachEvaluation.title || null,
            event_type: latestCoachEvaluation.event_type || null,
            start_datetime: latestCoachEvaluation.start_datetime || null,
            coach_id: latestCoachEvaluation.coach_id || null,
            coach_name: latestCoachEvaluation.coach_name || null,
            overall_rating: latestCoachEvaluation.overall_rating,
            technical_rating: latestCoachEvaluation.technical_rating,
            tactical_rating: latestCoachEvaluation.tactical_rating,
            physical_rating: latestCoachEvaluation.physical_rating,
            mentality_rating: latestCoachEvaluation.mentality_rating,
            fatigue_rating: latestCoachEvaluation.fatigue_rating,
            coach_notes: latestCoachEvaluation.coach_notes || null,
            improvement_plan: latestCoachEvaluation.improvement_plan || null,
            created_at: latestCoachEvaluation.created_at || null,
          }
        : null,
      ranking: ranking
        ? {
            id: ranking.id,
            player_id: ranking.player_id,
            group_id: ranking.group_id || null,
            total_score: ranking.total_score,
            rank: ranking.rank,
            period: ranking.period,
            trend: ranking.trend,
            calculated_at: ranking.calculated_at,
            breakdown: {
              coach_eval_score: ranking.coach_eval_score,
              attendance_score: ranking.attendance_score,
              discipline_score: ranking.discipline_score,
              match_score: ranking.match_score,
              ai_score: ranking.ai_score,
            },
          }
        : null,
    };
  }

  async parentDashboard(parentUserId, academyId, childId = null) {
    const rawChildren = await this.repo.findParentLinkedPlayers(
      parentUserId,
      academyId,
    );
    const selectedRaw = childId
      ? rawChildren.find((child) => child.id === childId)
      : rawChildren.find((child) => child.is_primary) || rawChildren[0] || null;

    if (childId && !selectedRaw) {
      throw new ForbiddenError("Parent can only access their linked child");
    }
    if (!selectedRaw) {
      return {
        children: [],
        selectedChild: null,
        progress: null,
        calendarEvents: { data: [], total: 0, page: 1, totalPages: 1 },
        trainings: { data: [], total: 0, page: 1, totalPages: 1 },
        matches: { data: [], total: 0, page: 1, totalPages: 1 },
        attendance: { data: [], total: 0, page: 1, totalPages: 1 },
        evaluations: { data: [], total: 0, page: 1, totalPages: 1 },
        notes: { data: [], total: 0, page: 1, totalPages: 1 },
        coaches: [],
        payments: null,
        weeklyReport: null,
        aiInsights: {
          injuryRisk: null,
          aiEvaluation: null,
          coachEvaluation: null,
          ranking: null,
        },
      };
    }

    const selectedChildId = selectedRaw.id;
    const coachesByChild = await Promise.all(
      rawChildren.map(async (child) => [
        child.id,
        await this.repo.findCoachesForPlayer(child, academyId),
      ]),
    );
    const coachMap = new Map(coachesByChild);
    const selectedCoaches = coachMap.get(selectedChildId) || [];
    const canViewProgress = selectedRaw.can_view_progress !== false;

    const [
      progress,
      calendarEvents,
      trainings,
      matches,
      attendance,
      evaluations,
      notes,
      payments,
      weeklyReport,
      aiInsights,
    ] = await Promise.all([
      canViewProgress
        ? this.playerProgress(parentUserId, academyId, selectedChildId)
        : Promise.resolve(null),
      this.parentListCalendarEvents(parentUserId, academyId, selectedChildId, {
        page: 1,
        limit: 8,
      }),
      this.parentListTrainings(parentUserId, academyId, selectedChildId, {
        page: 1,
        limit: 5,
      }),
      this.parentListMatches(parentUserId, academyId, selectedChildId, {
        page: 1,
        limit: 5,
      }),
      this.parentAttendanceHistory(parentUserId, academyId, selectedChildId, {
        page: 1,
        limit: 8,
      }),
      canViewProgress
        ? this.parentEvaluations(parentUserId, academyId, selectedChildId, {
            page: 1,
            limit: 5,
          })
        : Promise.resolve({ data: [], total: 0, page: 1, totalPages: 1 }),
      this.parentListNotes(parentUserId, academyId, selectedChildId, {
        page: 1,
        limit: 5,
      }),
      selectedRaw.can_view_payments === false
        ? Promise.resolve(null)
        : this.repo.parentPaymentSummary(academyId, selectedChildId),
      canViewProgress
        ? this.parentWeeklyReport(parentUserId, academyId, selectedChildId)
        : Promise.resolve(null),
      canViewProgress
        ? this._latestParentAiInsights(academyId, selectedChildId)
        : Promise.resolve({
            injuryRisk: null,
            aiEvaluation: null,
            coachEvaluation: null,
            ranking: null,
          }),
    ]);

    return {
      children: rawChildren.map((child) =>
        this._shapeParentChild(child, coachMap.get(child.id) || []),
      ),
      selectedChild: this._shapeParentChild(selectedRaw, selectedCoaches),
      progress,
      calendarEvents,
      trainings,
      matches,
      attendance,
      evaluations,
      notes,
      coaches: selectedCoaches,
      payments,
      weeklyReport,
      aiInsights,
    };
  }

  async parentListCalendarEvents(parentUserId, academyId, childId, filters) {
    await this._assertParentChild(parentUserId, childId, academyId);
    return this._playerVisibleEvents(childId, academyId, filters);
  }

  async parentListTrainings(parentUserId, academyId, childId, filters) {
    return this.parentListCalendarEvents(parentUserId, academyId, childId, {
      ...filters,
      eventType: "training",
    });
  }

  async parentListMatches(parentUserId, academyId, childId, filters) {
    const player = await this._assertParentChild(
      parentUserId,
      childId,
      academyId,
    );
    await this._finalizeOverdueMatches(academyId);
    const { query: visibleMatchesQuery } = await this._playerVisibleMatchQuery(
      player,
      academyId,
      filters,
    );
    if (!visibleMatchesQuery) {
      return { data: [], total: 0, page: filters.page || 1, totalPages: 1 };
    }
    return this.repo.paginate(visibleMatchesQuery, filters, "m.id");
  }

  async parentGetMatch(parentUserId, academyId, childId, matchId) {
    const player = await this._assertParentChild(
      parentUserId,
      childId,
      academyId,
    );
    const canViewProgress = player.can_view_progress !== false;
    const { query: visibleMatchesQuery } = await this._playerVisibleMatchQuery(
      player,
      academyId,
      {},
    );
    const visibleMatch = visibleMatchesQuery
      ? await visibleMatchesQuery.where("m.id", matchId).first()
      : null;
    if (!visibleMatch)
      throw new ForbiddenError("Parent cannot access this match");
    const match = await this.adminGetMatch(academyId, matchId);
    return {
      ...match,
      squad: (match.squad || []).filter((row) => row.player_id === childId),
      stats:
        canViewProgress && match.evaluations_finalized_at
          ? (match.stats || []).filter((row) => row.player_id === childId)
          : [],
      attendance: (match.attendance || []).filter(
        (row) => row.player_id === childId,
      ),
      incidents: (match.incidents || []).filter(
        (row) => row.player_id === childId,
      ),
    };
  }

  async parentGetMatchStats(parentUserId, academyId, childId, matchId) {
    await this._assertParentCanViewProgress(parentUserId, childId, academyId);
    const match = await this.parentGetMatch(
      parentUserId,
      academyId,
      childId,
      matchId,
    );
    if (!match.evaluations_finalized_at) {
      return null;
    }
    return this.repo
      .db("match_player_stats")
      .where({ match_id: matchId, player_id: childId })
      .first();
  }

  async parentAttendanceHistory(parentUserId, academyId, childId, filters) {
    await this._assertParentChild(parentUserId, childId, academyId);
    return this._combinedPlayerAttendanceHistory(childId, academyId, filters);
  }

  async parentEvaluations(parentUserId, academyId, childId, filters) {
    await this._assertParentCanViewProgress(parentUserId, childId, academyId);
    const query = this.repo
      .db("player_event_evaluations as pee")
      .join("calendar_events as ce", "pee.event_id", "ce.id")
      .where("pee.player_id", childId)
      .where("ce.academy_id", academyId)
      .whereNull("ce.deleted_at")
      .whereNot("ce.status", "cancelled")
      .where("pee.visibility", "player_and_parent")
      .select("pee.*", "ce.title", "ce.event_type", "ce.start_datetime")
      .orderBy("ce.start_datetime", "desc");
    return this.repo.paginate(query, filters, "pee.id");
  }

  async parentMeasurements(parentUserId, academyId, childId, filters) {
    await this._assertParentCanViewProgress(parentUserId, childId, academyId);
    return this.repo.listParentPlayerMeasurements(academyId, childId, filters);
  }

  async parentProgress(parentUserId, academyId, childId) {
    await this._assertParentCanViewProgress(parentUserId, childId, academyId);
    return this.playerProgress(parentUserId, academyId, childId);
  }

  async parentPayments(parentUserId, academyId, childId) {
    const player = await this._assertParentChild(
      parentUserId,
      childId,
      academyId,
    );
    if (player.can_view_payments === false) {
      throw new ForbiddenError("Parent cannot access payments for this child");
    }
    return this.repo.parentPaymentSummary(academyId, childId);
  }

  async parentWeeklyReport(parentUserId, academyId, childId) {
    await this._assertParentCanViewProgress(parentUserId, childId, academyId);
    const [progress, attendance, evaluations, matches, trainings, notes] =
      await Promise.all([
        this.playerProgress(parentUserId, academyId, childId),
        this.parentAttendanceHistory(parentUserId, academyId, childId, {
          page: 1,
          limit: 20,
        }),
        this.parentEvaluations(parentUserId, academyId, childId, {
          page: 1,
          limit: 5,
        }),
        this.parentListMatches(parentUserId, academyId, childId, {
          page: 1,
          limit: 3,
        }),
        this.parentListTrainings(parentUserId, academyId, childId, {
          page: 1,
          limit: 5,
        }),
        this.parentListNotes(parentUserId, academyId, childId, {
          page: 1,
          limit: 3,
        }),
      ]);

    const attendanceRecords = attendance.data || [];
    const attended = attendanceRecords.filter((row) =>
      ["present", "late"].includes(row.status),
    ).length;
    const attendanceRate = attendanceRecords.length
      ? Math.round((attended / attendanceRecords.length) * 100)
      : (progress?.attendancePercentage ?? 0);
    const latestEvaluation = evaluations.data?.[0] || null;

    const highlights = [
      `${attendanceRate}% attendance across recent sessions and matches`,
      latestEvaluation
        ? `Latest visible coach rating: ${latestEvaluation.overall_rating || latestEvaluation.rating || "-"}`
        : "No new coach evaluation published yet",
      `${matches.total || matches.data?.length || 0} visible match record(s) available`,
    ];

    const actionItems = [];
    if (attendanceRate < 85) {
      actionItems.push("Review attendance consistency with the coach");
    }
    if (!latestEvaluation) {
      actionItems.push(
        "Ask the coach when the next evaluation will be published",
      );
    }
    if ((notes.data || []).some((note) => note.status === "new")) {
      actionItems.push("Follow up on open parent notes");
    }

    return {
      generatedAt: new Date().toISOString(),
      progress,
      attendanceRate,
      latestEvaluation,
      upcomingTrainings: trainings.data || [],
      recentMatches: matches.data || [],
      recentNotes: notes.data || [],
      highlights,
      actionItems: actionItems.length
        ? actionItems
        : ["Keep the same routine and monitor next week changes"],
    };
  }

  async parentListNotes(parentUserId, academyId, childId, filters) {
    await this._assertParentChild(parentUserId, childId, academyId);
    const result = await this.repo.listParentPlayerNotesForParent(
      parentUserId,
      academyId,
      childId,
      filters,
    );
    return {
      ...result,
      data: result.data.map((note) =>
        note.visibility === "coach_only"
          ? { ...note, coach_response: null }
          : note,
      ),
    };
  }

  async parentCreateNote(parentUserId, academyId, childId, data) {
    const player = await this._assertParentCanMessageCoach(
      parentUserId,
      childId,
      academyId,
    );
    let coachUserId = data.coachUserId || null;
    let coaches = [];
    if (coachUserId) {
      coaches = await this.repo.findCoachesForPlayer(player, academyId);
      if (!coaches.some((coach) => coach.user_id === coachUserId)) {
        throw new ForbiddenError("Selected coach cannot access this child");
      }
    } else {
      coaches = await this.repo.findCoachesForPlayer(player, academyId);
    }
    const note = await this.repo.createParentPlayerNote({
      academy_id: academyId,
      parent_user_id: parentUserId,
      player_id: childId,
      coach_user_id: coachUserId,
      category: data.category || "general",
      title: data.title || null,
      body: data.body,
      visibility: data.visibility || "parent_and_coach",
      status: "new",
    });

    const targetCoachUserIds = coachUserId
      ? [coachUserId]
      : coaches.map((coach) => coach.user_id);
    await this._notifyUsers(
      targetCoachUserIds,
      "New parent note",
      `${note.parent_name || "A parent"} sent a note about ${player.full_name}.`,
      "parent_note_created",
      {
        href: "/coach/home",
        noteId: note.id,
        playerId: childId,
        playerName: player.full_name,
        parentName: note.parent_name || null,
      },
    );

    return note;
  }

  async coachListParentNotes(user, filters) {
    const coach = await this._getCoach(user.userId, user.academyId);
    return this.repo.listCoachParentNotes(coach.id, user.academyId, {
      ...filters,
      coachUserId: user.userId,
    });
  }

  async coachRespondParentNote(user, noteId, data) {
    const coach = await this._getCoach(user.userId, user.academyId);
    const note = await this.repo.findParentNoteById(noteId, user.academyId);
    if (!note) throw new NotFoundError("Parent note", noteId);
    if (note.coach_user_id && note.coach_user_id !== user.userId) {
      throw new ForbiddenError("This parent note is assigned to another coach");
    }
    const [player] = await this.repo.findCoachScopedPlayersByIds(
      coach.id,
      user.academyId,
      [note.player_id],
    );
    if (!player) {
      throw new ForbiddenError("Coach cannot access this parent note");
    }

    const hasResponse = Object.prototype.hasOwnProperty.call(
      data,
      "coachResponse",
    );
    const updated = await this.repo.updateParentNoteResponse(
      noteId,
      user.academyId,
      {
        status: data.status || (hasResponse ? "reviewed" : note.status),
        visibility: data.visibility || note.visibility,
        coach_response: hasResponse
          ? data.coachResponse || null
          : note.coach_response,
        coach_user_id: user.userId,
        responded_by_user_id: hasResponse
          ? user.userId
          : note.responded_by_user_id,
        responded_at: hasResponse ? new Date() : note.responded_at,
      },
    );
    if (hasResponse) {
      const visibleToPlayer = ["player_and_parent", "family"].includes(
        updated.visibility,
      );
      const playerUser = visibleToPlayer
        ? await this.repo
            .db("player_profiles")
            .where({
              id: updated.player_id,
              academy_id: user.academyId,
            })
            .whereNull("deleted_at")
            .select("user_id")
            .first()
        : null;
      await this._notifyUsers(
        [note.parent_user_id],
        "Coach replied to your note",
        `${updated.coach_name || "Coach"} replied about ${updated.player_name || "your child"}.`,
        "parent_note_replied",
        {
          href: "/parent/home",
          noteId: updated.id,
          playerId: updated.player_id,
          playerName: updated.player_name || null,
          coachName: updated.coach_name || null,
        },
      );
      if (playerUser?.user_id) {
        await this._notifyUsers(
          [playerUser.user_id],
          "New family coaching note",
          `${updated.coach_name || "Coach"} shared a family note with you.`,
          "player_family_note",
          {
            href: "/player/home",
            noteId: updated.id,
            playerName: updated.player_name || null,
            coachName: updated.coach_name || null,
          },
        );
      }
    }
    return updated;
  }

  async coachCreateBasicPlayer(user, data) {
    if (!this.playersService)
      throw new BadRequestError("Players service is unavailable");
    const coach = await this._getCoach(user.userId, user.academyId);
    const birthYear = new Date(data.birthDate).getFullYear();
    if (!Number.isInteger(birthYear))
      throw new BadRequestError("A valid player birth date is required");

    let groupId = data.groupId || null;
    let branchId = data.branchId || null;
    if (groupId) {
      await this._ensureCoachCanAccessGroups(
        coach,
        user.academyId,
        [groupId],
        "can_manage_players",
      );
      const groups = await this.repo.findGroupsByIds([groupId], user.academyId);
      branchId = branchId || groups[0]?.branch_id;
    } else {
      const matches = await this.repo.findCoachAccessibleBirthYears(
        coach.id,
        user.academyId,
        {
          branchId,
          birthYear,
          permission: "can_manage_players",
        },
      );
      if (!matches.length) {
        throw new ForbiddenError(
          "Your coach account does not have access to this player birth year",
        );
      }
      if (!branchId && new Set(matches.map((row) => row.branch_id)).size > 1) {
        throw new BadRequestError(
          "Select a branch before creating this player",
        );
      }
      branchId = branchId || matches[0].branch_id;
      const autoGroup = await this.repo.findCoachAutoAssignableGroup(
        coach.id,
        branchId,
        birthYear,
      );
      groupId = autoGroup?.id || null;
    }
    return this.playersService.createPlayer(
      user.academyId,
      {
        ...data,
        branchId,
        groupId,
        markProfileComplete: false,
      },
      user,
    );
  }

  async coachCompletePlayerProfile(user, playerId, data) {
    if (!this.playersService)
      throw new BadRequestError("Players service is unavailable");
    const coach = await this._getCoach(user.userId, user.academyId);
    await this._ensureCoachCanAccessPlayers(coach, user.academyId, [playerId], {
      permission: "can_manage_players",
    });
    if (this.customDataService) {
      await this.customDataService.savePlayerValues(
        user,
        playerId,
        data.customValues || data.values || [],
        {
          markProfileComplete: true,
        },
      );
    }
    return this.playersService.updatePlayer(
      playerId,
      user.academyId,
      {
        ...data,
        customValues: undefined,
        values: undefined,
        markProfileComplete: true,
      },
      user,
    );
  }
}

module.exports = CalendarService;
