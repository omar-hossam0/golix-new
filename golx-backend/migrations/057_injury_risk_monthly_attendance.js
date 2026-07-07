async function recreateInjuryRiskInputsView(knex, includeAttendance = true) {
  await knex.raw("DROP VIEW IF EXISTS injury_risk_player_inputs");
  await knex.raw(`
    CREATE VIEW injury_risk_player_inputs AS
    SELECT
      pp.id AS player_id,
      pp.academy_id,
      pp.full_name AS player_name,
      pp.position AS main_position,
      irpc.category AS position_category,
      ${
        includeAttendance
          ? `COALESCE(monthly_attendance.attendance_rate, 0)::numeric(5,2) AS attendance_rate,
      COALESCE(monthly_attendance.total_events, 0)::int AS attendance_total_events,
      COALESCE(monthly_attendance.attended_events, 0)::int AS attendance_attended_events,
      COALESCE(monthly_attendance.training_total, 0)::int AS attendance_training_total,
      COALESCE(monthly_attendance.training_attended, 0)::int AS attendance_training_attended,
      COALESCE(monthly_attendance.match_total, 0)::int AS attendance_match_total,
      COALESCE(monthly_attendance.match_attended, 0)::int AS attendance_match_attended,
      monthly_attendance.month_start AS attendance_month_start,`
          : ""
      }
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
    ${
      includeAttendance
        ? `LEFT JOIN injury_risk_monthly_attendance monthly_attendance
      ON monthly_attendance.player_id = pp.id
      AND monthly_attendance.month_start = date_trunc('month', current_date)::date`
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
}

exports.up = async function up(knex) {
  const hasMonthlyAttendance = await knex.schema.hasTable(
    "injury_risk_monthly_attendance",
  );
  if (!hasMonthlyAttendance) {
    await knex.schema.createTable("injury_risk_monthly_attendance", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("academy_id")
        .notNullable()
        .references("id")
        .inTable("academy_academies")
        .onDelete("CASCADE");
      t.uuid("player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.date("month_start").notNullable();
      t.integer("training_total").notNullable().defaultTo(0);
      t.integer("training_attended").notNullable().defaultTo(0);
      t.integer("match_total").notNullable().defaultTo(0);
      t.integer("match_attended").notNullable().defaultTo(0);
      t.integer("total_events").notNullable().defaultTo(0);
      t.integer("attended_events").notNullable().defaultTo(0);
      t.decimal("attendance_rate", 5, 2).notNullable().defaultTo(0);
      t.timestamp("calculated_at").notNullable().defaultTo(knex.fn.now());
      t.timestamps(true, true);
      t.unique(["player_id", "month_start"]);
      t.index(["academy_id", "month_start"]);
      t.index(["player_id", "month_start"]);
    });
  }

  await knex.raw(`
    CREATE OR REPLACE FUNCTION refresh_injury_risk_monthly_attendance(
      p_academy_id uuid,
      p_player_ids uuid[],
      p_month_start date
    )
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      WITH bounds AS (
        SELECT
          date_trunc('month', p_month_start)::date AS month_start,
          LEAST(
            (date_trunc('month', p_month_start)::date + interval '1 month')::timestamp,
            now()
          ) AS cutoff_at
      ),
      selected_players AS (
        SELECT pp.id AS player_id, pp.academy_id, pp.branch_id, pp.date_of_birth
        FROM player_profiles pp
        WHERE pp.academy_id = p_academy_id
          AND pp.deleted_at IS NULL
          AND (p_player_ids IS NULL OR pp.id = ANY(p_player_ids))
      ),
      training_events AS (
        SELECT DISTINCT sp.player_id, ce.id AS event_id
        FROM selected_players sp
        CROSS JOIN bounds b
        JOIN calendar_events ce
          ON ce.academy_id = sp.academy_id
          AND ce.event_type = 'training'
          AND ce.deleted_at IS NULL
          AND ce.start_datetime >= b.month_start::timestamp
          AND ce.start_datetime < b.cutoff_at
        LEFT JOIN calendar_event_players cep
          ON cep.event_id = ce.id
          AND cep.player_id = sp.player_id
        LEFT JOIN calendar_event_groups ceg
          ON ceg.event_id = ce.id
        LEFT JOIN player_group_assignments pga
          ON pga.group_id = ceg.group_id
          AND pga.player_id = sp.player_id
          AND pga.left_at IS NULL
        LEFT JOIN calendar_event_birth_years ceby
          ON ceby.event_id = ce.id
        LEFT JOIN academy_birth_years aby
          ON aby.id = ceby.birth_year_id
          AND aby.deleted_at IS NULL
          AND aby.branch_id = sp.branch_id
          AND sp.date_of_birth IS NOT NULL
          AND EXTRACT(YEAR FROM sp.date_of_birth)::int BETWEEN aby.from_year AND aby.to_year
        WHERE cep.player_id IS NOT NULL
          OR pga.player_id IS NOT NULL
          OR aby.id IS NOT NULL
      ),
      training_counts AS (
        SELECT
          te.player_id,
          COUNT(*)::int AS training_total,
          COUNT(*) FILTER (WHERE ea.status IN ('present', 'late'))::int AS training_attended
        FROM training_events te
        LEFT JOIN event_attendance ea
          ON ea.event_id = te.event_id
          AND ea.player_id = te.player_id
        GROUP BY te.player_id
      ),
      match_events AS (
        SELECT DISTINCT sp.player_id, m.id AS match_id
        FROM selected_players sp
        CROSS JOIN bounds b
        JOIN matches m
          ON m.deleted_at IS NULL
          AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) >= b.month_start::timestamp
          AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) < b.cutoff_at
        JOIN calendar_events ce
          ON ce.id = m.event_id
          AND ce.academy_id = sp.academy_id
          AND ce.deleted_at IS NULL
        LEFT JOIN match_squads ms
          ON ms.match_id = m.id
          AND ms.player_id = sp.player_id
        LEFT JOIN match_attendance ma_target
          ON ma_target.match_id = m.id
          AND ma_target.player_id = sp.player_id
        WHERE ms.player_id IS NOT NULL
          OR ma_target.player_id IS NOT NULL
      ),
      match_counts AS (
        SELECT
          me.player_id,
          COUNT(*)::int AS match_total,
          COUNT(*) FILTER (WHERE ma.status IN ('present', 'late'))::int AS match_attended
        FROM match_events me
        LEFT JOIN match_attendance ma
          ON ma.match_id = me.match_id
          AND ma.player_id = me.player_id
        GROUP BY me.player_id
      ),
      combined AS (
        SELECT
          sp.academy_id,
          sp.player_id,
          b.month_start,
          COALESCE(tc.training_total, 0)::int AS training_total,
          COALESCE(tc.training_attended, 0)::int AS training_attended,
          COALESCE(mc.match_total, 0)::int AS match_total,
          COALESCE(mc.match_attended, 0)::int AS match_attended
        FROM selected_players sp
        CROSS JOIN bounds b
        LEFT JOIN training_counts tc ON tc.player_id = sp.player_id
        LEFT JOIN match_counts mc ON mc.player_id = sp.player_id
      )
      INSERT INTO injury_risk_monthly_attendance (
        academy_id,
        player_id,
        month_start,
        training_total,
        training_attended,
        match_total,
        match_attended,
        total_events,
        attended_events,
        attendance_rate,
        calculated_at,
        created_at,
        updated_at
      )
      SELECT
        academy_id,
        player_id,
        month_start,
        training_total,
        training_attended,
        match_total,
        match_attended,
        (training_total + match_total)::int AS total_events,
        (training_attended + match_attended)::int AS attended_events,
        CASE
          WHEN (training_total + match_total) = 0 THEN 0
          ELSE ROUND(
            100.0 * (training_attended + match_attended)
            / NULLIF(training_total + match_total, 0),
            2
          )
        END AS attendance_rate,
        now(),
        now(),
        now()
      FROM combined
      ON CONFLICT (player_id, month_start)
      DO UPDATE SET
        training_total = EXCLUDED.training_total,
        training_attended = EXCLUDED.training_attended,
        match_total = EXCLUDED.match_total,
        match_attended = EXCLUDED.match_attended,
        total_events = EXCLUDED.total_events,
        attended_events = EXCLUDED.attended_events,
        attendance_rate = EXCLUDED.attendance_rate,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = now();
    END;
    $$;
  `);

  await knex.raw(`
    DO $$
    DECLARE month_row record;
    BEGIN
      FOR month_row IN
        SELECT DISTINCT academy_id, month_start
        FROM (
          SELECT
            ce.academy_id,
            date_trunc('month', ce.start_datetime)::date AS month_start
          FROM calendar_events ce
          WHERE ce.event_type = 'training'
            AND ce.deleted_at IS NULL
            AND ce.start_datetime < now()

          UNION

          SELECT
            ce.academy_id,
            date_trunc(
              'month',
              COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp)
            )::date AS month_start
          FROM matches m
          JOIN calendar_events ce ON ce.id = m.event_id
          WHERE m.deleted_at IS NULL
            AND ce.deleted_at IS NULL
            AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) < now()
        ) months
      LOOP
        PERFORM refresh_injury_risk_monthly_attendance(
          month_row.academy_id,
          NULL,
          month_row.month_start
        );
      END LOOP;
    END $$;
  `);

  await recreateInjuryRiskInputsView(knex, true);
};

exports.down = async function down(knex) {
  await recreateInjuryRiskInputsView(knex, false);
  await knex.raw("DROP FUNCTION IF EXISTS refresh_injury_risk_monthly_attendance(uuid, uuid[], date)");
  await knex.schema.dropTableIfExists("injury_risk_monthly_attendance");
};
