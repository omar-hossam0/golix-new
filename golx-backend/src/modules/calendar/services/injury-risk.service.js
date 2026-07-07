const {
  MODEL_VERSION: DEFAULT_MODEL_VERSION,
  runInjuryRiskPredictions: defaultRunPredictions,
} = require("../../ai/injury-risk-model");

class InjuryRiskService {
  constructor(
    repository,
    {
      getCoach,
      ensureCoachHasPermission,
      ensureCoachCanAccessPlayers,
      playerCustomProfilesByPlayer,
    },
    {
      modelVersion = DEFAULT_MODEL_VERSION,
      runPredictions = defaultRunPredictions,
      now = () => new Date(),
    } = {},
  ) {
    this.repo = repository;
    this.getCoach = getCoach;
    this.ensureCoachHasPermission = ensureCoachHasPermission;
    this.ensureCoachCanAccessPlayers = ensureCoachCanAccessPlayers;
    this.playerCustomProfilesByPlayer = playerCustomProfilesByPlayer;
    this.modelVersion = modelVersion;
    this.runPredictions = runPredictions;
    this.now = now;
  }

  async currentWeek(db = this.repo.db) {
    const { rows } = await db.raw(`
      SELECT
        date_trunc('week', current_date)::date::text AS week_start,
        (date_trunc('week', current_date)::date + 6)::text AS week_end
    `);
    return rows[0];
  }

  async listPainDiscomfort(userId, academyId) {
    const coach = await this.getCoach(userId, academyId);
    const scopedPlayers = await this.repo.findCoachScopedPlayers(
      coach.id,
      academyId,
      { permission: "can_view_injury_risk" },
    );
    await this.ensureCoachHasPermission(
      coach,
      academyId,
      "can_view_injury_risk",
    );
    const players = await this.playersWithMainPosition(scopedPlayers);
    const week = await this.currentWeek();
    if (!players.length) return [];

    const painRows = await this.repo
      .db("injury_risk_weekly_pain_discomfort")
      .where({ academy_id: academyId, week_start: week.week_start })
      .whereIn(
        "player_id",
        players.map((player) => player.id),
      )
      .select(
        "id",
        "player_id",
        "pain_or_discomfort",
        "week_start",
        "week_end",
        "recorded_by_coach_id",
        "updated_at",
      );
    const byPlayer = new Map(
      painRows.map((row) => [row.player_id, row]),
    );

    return players.map((player) => {
      const pain = byPlayer.get(player.id);
      return {
        id: pain?.id || null,
        player_id: player.id,
        player_name: player.full_name,
        position: player.injury_risk_position,
        group_id: player.group_id || null,
        week_start: pain?.week_start || week.week_start,
        week_end: pain?.week_end || week.week_end,
        pain_or_discomfort:
          pain?.pain_or_discomfort === 0 || pain?.pain_or_discomfort === 1
            ? Number(pain.pain_or_discomfort)
            : null,
        recorded_by_coach_id: pain?.recorded_by_coach_id || null,
        updated_at: pain?.updated_at || null,
      };
    });
  }

  async upsertPainDiscomfort(userId, academyId, records) {
    const coach = await this.getCoach(userId, academyId);
    const uniqueRecords = Array.from(
      new Map(records.map((record) => [record.playerId, record])).values(),
    );
    const playerIds = uniqueRecords.map((record) => record.playerId);
    await this.ensureCoachCanAccessPlayers(coach, academyId, playerIds, {
      permission: "can_manage_injury_risk",
    });

    const week = await this.currentWeek();
    const updatedAt = this.now();
    const payload = uniqueRecords.map((record) => ({
      academy_id: academyId,
      player_id: record.playerId,
      week_start: week.week_start,
      week_end: week.week_end,
      pain_or_discomfort: Number(record.painOrDiscomfort),
      recorded_by_coach_id: coach.id,
      updated_at: updatedAt,
    }));

    await this.repo
      .db("injury_risk_weekly_pain_discomfort")
      .insert(payload)
      .onConflict(["player_id", "week_start"])
      .merge({
        academy_id: this.repo.db.raw("excluded.academy_id"),
        week_end: this.repo.db.raw("excluded.week_end"),
        pain_or_discomfort: this.repo.db.raw("excluded.pain_or_discomfort"),
        recorded_by_coach_id: this.repo.db.raw(
          "excluded.recorded_by_coach_id",
        ),
        updated_at: updatedAt,
      });

    return this.listPainDiscomfort(userId, academyId);
  }

  numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  ageInYears(dateValue) {
    if (!dateValue) return null;
    const birthDate = new Date(dateValue);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = this.now();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayPassed =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() &&
        today.getDate() >= birthDate.getDate());
    if (!birthdayPassed) age -= 1;
    return age;
  }

  toModelInput(player, inputRow = {}) {
    const attendanceRate = this.numberOrZero(inputRow.attendance_rate);
    return {
      player_id: player.id,
      player_name: player.full_name,
      age: this.ageInYears(player.date_of_birth),
      position:
        inputRow.position_category ||
        inputRow.main_position ||
        player.main_position ||
        player.position ||
        "Midfielder",
      attendance_rate:
        attendanceRate > 1 ? attendanceRate / 100 : attendanceRate,
      training_sessions_per_week: this.numberOrZero(
        inputRow.training_sessions_week,
      ),
      match_minutes_last_week: this.numberOrZero(
        inputRow.match_minutes_last_week,
      ),
      fatigue_rating: this.numberOrZero(inputRow.fatigue_rating),
      previous_injury: this.numberOrZero(
        inputRow.previous_injury_count_3_months,
      ),
      pain_or_discomfort: this.numberOrZero(inputRow.pain_or_discomfort),
    };
  }

  async coachScopedPlayers(
    coach,
    academyId,
    permission = "can_view_injury_risk",
  ) {
    await this.ensureCoachHasPermission(coach, academyId, permission);
    return this.repo.findCoachScopedPlayers(coach.id, academyId, {
      permission,
    });
  }

  async playersWithMainPosition(players) {
    const customByPlayer = await this.playerCustomProfilesByPlayer(
      players.map((player) => player.id),
    );
    const normalizeKey = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    const mainPositionFor = (playerId) => {
      const profile = customByPlayer.get(playerId) || [];
      const field = profile.find(
        (item) =>
          normalizeKey(item.key) === "main_position" ||
          normalizeKey(item.label) === "main_position",
      );
      if (field?.value === null || field?.value === undefined) return null;
      if (Array.isArray(field.value)) {
        return field.value.filter(Boolean).join(", ") || null;
      }
      return String(field.value).trim() || null;
    };

    return players.map((player) => {
      const mainPosition = mainPositionFor(player.id);
      return {
        ...player,
        main_position: mainPosition,
        injury_risk_position: mainPosition || player.position || null,
      };
    });
  }

  async inputRows(academyId, playerIds, db = this.repo.db) {
    if (!playerIds.length) return [];
    return db("injury_risk_player_inputs")
      .where({ academy_id: academyId })
      .whereIn("player_id", playerIds);
  }

  async listPredictions(userId, academyId) {
    const coach = await this.getCoach(userId, academyId);
    const scopedPlayers = await this.coachScopedPlayers(coach, academyId);
    const players = await this.playersWithMainPosition(scopedPlayers);
    const playerIds = players.map((player) => player.id);
    if (!playerIds.length) return [];

    const analyses = await this.repo
      .db("ai_analyses as aia")
      .whereIn("aia.player_id", playerIds)
      .where("aia.type", "injury_risk")
      .distinctOn("aia.player_id")
      .select("aia.*")
      .orderBy("aia.player_id", "asc")
      .orderBy("aia.created_at", "desc");
    const analysesByPlayer = new Map(
      analyses.map((analysis) => [analysis.player_id, analysis]),
    );

    return players.map((player) => {
      const analysis = analysesByPlayer.get(player.id);
      return {
        player_id: player.id,
        player_name: player.full_name,
        position: player.injury_risk_position,
        group_id: player.group_id || null,
        analysis_id: analysis?.id || null,
        input: analysis?.input_data || null,
        prediction: analysis?.result || null,
        model_version: analysis?.model_version || null,
        created_at: analysis?.created_at || null,
      };
    });
  }

  async runModel(userId, academyId) {
    const coach = await this.getCoach(userId, academyId);
    const scopedPlayers = await this.coachScopedPlayers(
      coach,
      academyId,
      "can_run_injury_risk",
    );
    const players = await this.playersWithMainPosition(scopedPlayers);
    const playerIds = players.map((player) => player.id);
    if (!playerIds.length) return [];

    const inputRows = await this.inputRows(academyId, playerIds);
    const inputRowsByPlayer = new Map(
      inputRows.map((row) => [row.player_id, row]),
    );
    const modelInputs = players.map((player) =>
      this.toModelInput(player, inputRowsByPlayer.get(player.id) || {}),
    );
    const modelInputsByPlayer = new Map(
      modelInputs.map((input) => [input.player_id, input]),
    );
    const modelResults = await this.runPredictions(modelInputs);
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
              model_version: this.modelVersion,
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
        model_version: analysis?.model_version || this.modelVersion,
        created_at: analysis?.created_at || null,
        error: prediction?.error || null,
      };
    });
  }

  async runWeeklyAutomation({ force = false } = {}) {
    return this.repo.db.transaction(async (trx) => {
      const { rows } = await trx.raw(
        "SELECT pg_try_advisory_xact_lock(hashtext(?)) AS locked",
        ["injury_risk_weekly_auto"],
      );
      if (!rows[0]?.locked) {
        return {
          skipped: true,
          reason: "already_running",
          academies: 0,
          players: 0,
          saved: 0,
          errors: [],
        };
      }

      return this.runWeeklyAutomationLocked(trx, { force });
    });
  }

  async runWeeklyAutomationLocked(db, { force = false } = {}) {
    const week = await this.currentWeek(db);
    const weekStart = week.week_start;
    const academies = await db("academy_academies")
      .whereNull("deleted_at")
      .select("id", "name")
      .orderBy("name", "asc");
    const summary = {
      skipped: false,
      weekStart,
      academies: academies.length,
      players: 0,
      saved: 0,
      skippedAcademies: 0,
      errors: [],
    };

    for (const academy of academies) {
      try {
        if (!force) {
          const existing = await db("ai_analyses as aia")
            .join("player_profiles as pp", "aia.player_id", "pp.id")
            .where("pp.academy_id", academy.id)
            .where("aia.type", "injury_risk")
            .whereRaw("aia.input_data->>'run_source' = ?", ["weekly_auto"])
            .whereRaw("aia.input_data->>'week_start' = ?", [weekStart])
            .count({ count: "*" })
            .first();
          if (Number(existing?.count || 0) > 0) {
            summary.skippedAcademies += 1;
            continue;
          }
        }

        const [players, inputRows] = await Promise.all([
          db("player_profiles as pp")
            .leftJoin(
              "player_group_assignments as pga",
              function joinCurrentGroup() {
                this.on("pga.player_id", "=", "pp.id").andOnNull(
                  "pga.left_at",
                );
              },
            )
            .where("pp.academy_id", academy.id)
            .whereNull("pp.deleted_at")
            .select(
              "pp.id",
              "pp.full_name",
              "pp.date_of_birth",
              "pp.position",
              "pga.group_id",
            ),
          db("injury_risk_player_inputs")
            .where({ academy_id: academy.id })
            .select("*"),
        ]);
        if (!players.length) continue;

        const inputRowsByPlayer = new Map(
          inputRows.map((row) => [row.player_id, row]),
        );
        const modelInputs = players.map((player) =>
          this.toModelInput(player, inputRowsByPlayer.get(player.id) || {}),
        );
        const modelInputsByPlayer = new Map(
          modelInputs.map((input) => [input.player_id, input]),
        );
        const modelResults = await this.runPredictions(modelInputs);
        const successfulResults = modelResults.filter((result) => !result.error);
        summary.players += modelInputs.length;

        if (!successfulResults.length) continue;

        const saved = await db("ai_analyses")
          .insert(
            successfulResults.map((result) => {
              const rawInput = inputRowsByPlayer.get(result.player_id) || {};
              return {
                player_id: result.player_id,
                type: "injury_risk",
                input_data: {
                  ...(modelInputsByPlayer.get(result.player_id) || {}),
                  run_source: "weekly_auto",
                  week_start: weekStart,
                  fatigue_source: rawInput.fatigue_source || null,
                  fatigue_recorded_at: rawInput.fatigue_recorded_at || null,
                },
                result: {
                  risk_percentage: result.risk_percentage,
                  risk_level: result.risk_level,
                  alert_flag: result.alert_flag,
                  recommendation: result.recommendation,
                },
                model_version: this.modelVersion,
              };
            }),
          )
          .returning("id");
        summary.saved += saved.length;
      } catch (error) {
        summary.errors.push({
          academyId: academy.id,
          academyName: academy.name,
          message: error.message,
        });
      }
    }

    return summary;
  }
}

module.exports = InjuryRiskService;
