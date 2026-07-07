async function createInjuryRiskInputsView(knex, includePainDiscomfort = true) {
  await knex.raw("DROP VIEW IF EXISTS injury_risk_player_inputs");
  await knex.raw(`
    CREATE VIEW injury_risk_player_inputs AS
    SELECT
      pp.id AS player_id,
      pp.academy_id,
      pp.full_name AS player_name,
      pp.position AS main_position,
      irpc.category AS position_category,
      COALESCE(monthly_attendance.attendance_rate, 0)::numeric(5,2) AS attendance_rate,
      COALESCE(monthly_attendance.total_events, 0)::int AS attendance_total_events,
      COALESCE(monthly_attendance.attended_events, 0)::int AS attendance_attended_events,
      COALESCE(monthly_attendance.training_total, 0)::int AS attendance_training_total,
      COALESCE(monthly_attendance.training_attended, 0)::int AS attendance_training_attended,
      COALESCE(monthly_attendance.match_total, 0)::int AS attendance_match_total,
      COALESCE(monthly_attendance.match_attended, 0)::int AS attendance_match_attended,
      monthly_attendance.month_start AS attendance_month_start,
      COALESCE(weekly_training.training_sessions_week, 0)::int AS training_sessions_week,
      date_trunc('week', current_date)::date AS training_sessions_week_start,
      (date_trunc('week', current_date)::date + 6) AS training_sessions_week_end,
      COALESCE(last_week_matches.match_minutes_last_week, 0)::int AS match_minutes_last_week,
      (date_trunc('week', current_date)::date - 7) AS match_minutes_last_week_start,
      (date_trunc('week', current_date)::date - 1) AS match_minutes_last_week_end,
      ${
        includePainDiscomfort
          ? `COALESCE(current_pain.pain_or_discomfort, 0)::int AS pain_or_discomfort,
      current_pain.week_start AS pain_or_discomfort_week_start,
      current_pain.week_end AS pain_or_discomfort_week_end,
      current_pain.updated_at AS pain_or_discomfort_recorded_at,`
          : ""
      }
      latest_fatigue.fatigue_rating,
      latest_fatigue.source AS fatigue_source,
      latest_fatigue.occurred_at AS fatigue_recorded_at,
      COALESCE(match_injuries.count, 0)::int AS match_injury_count_3_months,
      COALESCE(training_injuries.count, 0)::int AS training_injury_count_3_months,
      (
        COALESCE(match_injuries.count, 0)
        + COALESCE(training_injuries.count, 0)
      )::int AS previous_injury_count_3_months
    FROM player_profiles pp
    LEFT JOIN injury_risk_position_categories irpc
      ON irpc.position_code = UPPER(pp.position)
    LEFT JOIN injury_risk_monthly_attendance monthly_attendance
      ON monthly_attendance.player_id = pp.id
      AND monthly_attendance.month_start = date_trunc('month', current_date)::date
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS training_sessions_week
      FROM event_attendance ea
      JOIN calendar_events ce ON ce.id = ea.event_id
      WHERE ea.player_id = pp.id
        AND ea.status IN ('present', 'late')
        AND ce.event_type = 'training'
        AND ce.deleted_at IS NULL
        AND ce.start_datetime >= date_trunc('week', current_date)::timestamp
        AND ce.start_datetime < LEAST(
          (date_trunc('week', current_date)::date + 7)::timestamp,
          now()
        )
    ) weekly_training ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(mps.minutes_played), 0)::int AS match_minutes_last_week
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      WHERE mps.player_id = pp.id
        AND m.deleted_at IS NULL
        AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp)
          >= (date_trunc('week', current_date)::date - 7)::timestamp
        AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp)
          < date_trunc('week', current_date)::timestamp
    ) last_week_matches ON true
    ${
      includePainDiscomfort
        ? `LEFT JOIN injury_risk_weekly_pain_discomfort current_pain
      ON current_pain.player_id = pp.id
      AND current_pain.week_start = date_trunc('week', current_date)::date`
        : ""
    }
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
        AND COALESCE(mpi.injury_date, mpi.created_at::date) >= current_date - interval '3 months'
        AND m.deleted_at IS NULL
    ) match_injuries ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count
      FROM event_attendance ea
      JOIN calendar_events ce ON ce.id = ea.event_id
      WHERE ea.player_id = pp.id
        AND ea.status = 'injured'
        AND ce.event_type = 'training'
        AND ce.start_datetime >= now() - interval '3 months'
        AND ce.deleted_at IS NULL
    ) training_injuries ON true
    WHERE pp.deleted_at IS NULL
  `);
}

exports.up = async function up(knex) {
  await knex.schema.createTable(
    "injury_risk_weekly_pain_discomfort",
    (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      table
        .uuid("academy_id")
        .notNullable()
        .references("id")
        .inTable("academy_academies")
        .onDelete("CASCADE");
      table
        .uuid("player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      table.date("week_start").notNullable();
      table.date("week_end").notNullable();
      table.specificType("pain_or_discomfort", "smallint").notNullable();
      table
        .uuid("recorded_by_coach_id")
        .references("id")
        .inTable("coach_profiles")
        .onDelete("SET NULL");
      table.timestamps(true, true);
      table.unique(["player_id", "week_start"]);
      table.index(["academy_id", "week_start"]);
      table.index(["player_id", "week_start"]);
    },
  );

  await knex.raw(`
    ALTER TABLE injury_risk_weekly_pain_discomfort
    ADD CONSTRAINT injury_risk_weekly_pain_discomfort_binary_check
    CHECK (pain_or_discomfort IN (0, 1))
  `);

  await createInjuryRiskInputsView(knex, true);
};

exports.down = async function down(knex) {
  await createInjuryRiskInputsView(knex, false);
  await knex.schema.dropTableIfExists("injury_risk_weekly_pain_discomfort");
};
