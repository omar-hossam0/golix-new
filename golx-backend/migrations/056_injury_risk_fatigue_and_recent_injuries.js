const allowedPositions = [
  ["GK", "Defender"],
  ["LB", "Defender"],
  ["CB", "Defender"],
  ["RB", "Defender"],
  ["CDM", "Midfielder"],
  ["LM", "Midfielder"],
  ["CM", "Midfielder"],
  ["RM", "Midfielder"],
  ["LW", "Forward"],
  ["ST", "Forward"],
  ["RW", "Forward"],
  ["CF", "Forward"],
];

const allowedCodes = allowedPositions.map(([code]) => code);

async function addFatigueColumn(knex, tableName) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  const hasFatigue = await knex.schema.hasColumn(tableName, "fatigue_rating");
  if (!hasFatigue) {
    await knex.schema.alterTable(tableName, (t) => {
      t.decimal("fatigue_rating", 5, 2);
      t.index("fatigue_rating");
    });
  }
}

async function normalizePositionColumn(knex, tableName, columnName) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const updates = {
    LCB: "CB",
    RCB: "CB",
    LWB: "LB",
    RWB: "RB",
    LCM: "CM",
    RCM: "CM",
    LDM: "CDM",
    RDM: "CDM",
    CAM: "CM",
    LAM: "CM",
    RAM: "CM",
    LF: "LW",
    RF: "RW",
    LS: "ST",
    RS: "ST",
  };

  for (const [from, to] of Object.entries(updates)) {
    await knex(tableName)
      .whereRaw(`UPPER(${columnName}) = ?`, [from])
      .update({ [columnName]: to });
  }

  await knex(tableName)
    .whereNotNull(columnName)
    .whereRaw(
      `UPPER(${columnName}) NOT IN (${allowedCodes.map(() => "?").join(",")})`,
      allowedCodes,
    )
    .update({ [columnName]: null });
}

exports.up = async function up(knex) {
  await addFatigueColumn(knex, "player_event_evaluations");
  await addFatigueColumn(knex, "match_player_stats");

  const hasPlayerOptions = await knex.schema.hasTable("player_field_options");
  if (hasPlayerOptions) {
    await knex("player_field_options")
      .where("field_key", "position")
      .whereRaw(
        `UPPER(value) NOT IN (${allowedCodes.map(() => "?").join(",")})`,
        allowedCodes,
      )
      .del();
  }

  await normalizePositionColumn(knex, "player_profiles", "position");
  await normalizePositionColumn(knex, "match_squads", "position");

  const hasMapping = await knex.schema.hasTable("injury_risk_position_categories");
  if (hasMapping) {
    await knex("injury_risk_position_categories")
      .insert(
        allowedPositions.map(([position_code, category]) => ({
          position_code,
          category,
        })),
      )
      .onConflict("position_code")
      .merge({
        category: knex.raw("excluded.category"),
        updated_at: knex.fn.now(),
      });

    await knex("injury_risk_position_categories")
      .whereNotIn("position_code", allowedCodes)
      .del();
  }

  await knex.raw("DROP VIEW IF EXISTS injury_risk_player_inputs");
  await knex.raw(`
    CREATE VIEW injury_risk_player_inputs AS
    SELECT
      pp.id AS player_id,
      pp.academy_id,
      pp.full_name AS player_name,
      pp.position AS main_position,
      irpc.category AS position_category,
      latest_fatigue.fatigue_rating,
      latest_fatigue.source AS fatigue_source,
      latest_fatigue.occurred_at AS fatigue_recorded_at,
      COALESCE(match_injuries.count, 0)::int AS match_injury_count_2_months,
      COALESCE(training_injuries.count, 0)::int AS training_injury_count_2_months,
      (
        COALESCE(match_injuries.count, 0)
        + COALESCE(training_injuries.count, 0)
      )::int AS previous_injury_count_2_months
    FROM player_profiles pp
    LEFT JOIN injury_risk_position_categories irpc
      ON irpc.position_code = UPPER(pp.position)
    LEFT JOIN LATERAL (
      SELECT source, fatigue_rating, occurred_at
      FROM (
        SELECT
          'training'::text AS source,
          pee.fatigue_rating,
          ce.start_datetime AS occurred_at
        FROM player_event_evaluations pee
        JOIN calendar_events ce ON ce.id = pee.event_id
        WHERE pee.player_id = pp.id
          AND pee.fatigue_rating IS NOT NULL
          AND ce.deleted_at IS NULL
          AND ce.start_datetime <= now()

        UNION ALL

        SELECT
          'match'::text AS source,
          mps.fatigue_rating,
          COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) AS occurred_at
        FROM match_player_stats mps
        JOIN matches m ON m.id = mps.match_id
        WHERE mps.player_id = pp.id
          AND mps.fatigue_rating IS NOT NULL
          AND m.deleted_at IS NULL
          AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) <= now()
      ) fatigue_candidates
      ORDER BY occurred_at DESC
      LIMIT 1
    ) latest_fatigue ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count
      FROM match_player_incidents mpi
      JOIN matches m ON m.id = mpi.match_id
      WHERE mpi.player_id = pp.id
        AND mpi.incident_type = 'injury'
        AND COALESCE(mpi.injury_date, mpi.created_at::date) >= current_date - interval '2 months'
        AND m.deleted_at IS NULL
    ) match_injuries ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count
      FROM event_attendance ea
      JOIN calendar_events ce ON ce.id = ea.event_id
      WHERE ea.player_id = pp.id
        AND ea.status = 'injured'
        AND ce.event_type = 'training'
        AND ce.start_datetime >= now() - interval '2 months'
        AND ce.deleted_at IS NULL
    ) training_injuries ON true
    WHERE pp.deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP VIEW IF EXISTS injury_risk_player_inputs");

  for (const tableName of ["match_player_stats", "player_event_evaluations"]) {
    const hasTable = await knex.schema.hasTable(tableName);
    if (!hasTable) continue;
    const hasFatigue = await knex.schema.hasColumn(tableName, "fatigue_rating");
    if (hasFatigue) {
      await knex.schema.alterTable(tableName, (t) => {
        t.dropIndex("fatigue_rating");
        t.dropColumn("fatigue_rating");
      });
    }
  }
};
