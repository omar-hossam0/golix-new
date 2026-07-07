const createRefreshFunction = async (knex, { excludeCancelled }) => {
  const trainingStatusFilter = excludeCancelled
    ? "AND ce.status <> 'cancelled'"
    : "";
  const matchStatusFilter = excludeCancelled
    ? "AND m.status <> 'cancelled' AND m.match_status <> 'cancelled'"
    : "";
  const matchEventStatusFilter = excludeCancelled
    ? "AND ce.status <> 'cancelled'"
    : "";

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
          ${trainingStatusFilter}
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
          ${matchStatusFilter}
          AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) >= b.month_start::timestamp
          AND COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) < b.cutoff_at
        JOIN calendar_events ce
          ON ce.id = m.event_id
          AND ce.academy_id = sp.academy_id
          AND ce.deleted_at IS NULL
          ${matchEventStatusFilter}
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
};

const refreshExistingMonths = async (knex) => {
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
          WHERE COALESCE(m.finished_at, (m.match_date::date + m.match_time)::timestamp) < now()
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
};

exports.up = async function up(knex) {
  await createRefreshFunction(knex, { excludeCancelled: true });
  await refreshExistingMonths(knex);
};

exports.down = async function down(knex) {
  await createRefreshFunction(knex, { excludeCancelled: false });
  await refreshExistingMonths(knex);
};
