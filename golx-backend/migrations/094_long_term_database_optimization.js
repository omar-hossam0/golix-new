const redundantIndexes = [
  "academy_birth_years_branch_id_index",
  "calendar_event_birth_years_event_birth_year_idx",
  "calendar_event_groups_event_group_idx",
  "coach_group_assignments_coach_id_group_id_index",
  "coach_profiles_branch_id_index",
  "iam_role_permissions_role_permission_idx",
  "iam_user_academies_user_id_index",
  "injury_risk_monthly_attendance_player_id_month_start_index",
  "injury_risk_weekly_pain_discomfort_player_id_week_start_index",
  "match_squads_match_player_idx",
  "match_tactics_match_idx",
  "player_assignment_submissions_assignment_id_index",
  "player_profiles_player_code_index",
  "ranking_snapshots_player_id_period_index",
];

const onlineIndexes = [
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coach_group_assignments_group_id_idx
    ON coach_group_assignments (group_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS parent_player_links_player_parent_idx
    ON parent_player_links (player_id, parent_user_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS auth_users_branch_id_idx
    ON auth_users (branch_id)
    WHERE branch_id IS NOT NULL
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS auth_users_linked_player_id_idx
    ON auth_users (linked_player_id)
    WHERE linked_player_id IS NOT NULL
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS iam_user_roles_role_id_idx
    ON iam_user_roles (role_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_inbox_source_match_idx
    ON notification_inbox ((data->>'source'), (data->>'matchId'))
    WHERE (data->>'matchId') IS NOT NULL
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_inbox_source_event_idx
    ON notification_inbox ((data->>'source'), (data->>'eventId'))
    WHERE (data->>'eventId') IS NOT NULL
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_inbox_user_source_month_idx
    ON notification_inbox (user_id, (data->>'source'), (data->>'month'))
    WHERE (data->>'month') IS NOT NULL
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_inbox_ranking_dedupe_idx
    ON notification_inbox (
      user_id,
      (data->>'source'),
      (data->>'coachId'),
      (data->>'weekStart')
    )
    WHERE type = 'ranking' AND (data->>'weekStart') IS NOT NULL
  `,
];

const recreatedRedundantIndexes = [
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS academy_birth_years_branch_id_index
    ON academy_birth_years (branch_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS calendar_event_birth_years_event_birth_year_idx
    ON calendar_event_birth_years (event_id, birth_year_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS calendar_event_groups_event_group_idx
    ON calendar_event_groups (event_id, group_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coach_group_assignments_coach_id_group_id_index
    ON coach_group_assignments (coach_id, group_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS coach_profiles_branch_id_index
    ON coach_profiles (branch_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS iam_role_permissions_role_permission_idx
    ON iam_role_permissions (role_id, permission_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS iam_user_academies_user_id_index
    ON iam_user_academies (user_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS injury_risk_monthly_attendance_player_id_month_start_index
    ON injury_risk_monthly_attendance (player_id, month_start)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS injury_risk_weekly_pain_discomfort_player_id_week_start_index
    ON injury_risk_weekly_pain_discomfort (player_id, week_start)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS match_squads_match_player_idx
    ON match_squads (match_id, player_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS match_tactics_match_idx
    ON match_tactics (match_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS player_assignment_submissions_assignment_id_index
    ON player_assignment_submissions (assignment_id)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS player_profiles_player_code_index
    ON player_profiles (player_code)
  `,
  `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS ranking_snapshots_player_id_period_index
    ON ranking_snapshots (player_id, period)
  `,
];

const highChurnTables = [
  "auth_refresh_tokens",
  "notification_inbox",
  "realtime_outbox",
  "chat_conversations",
];

async function setHighChurnStorageParameters(knex) {
  for (const table of highChurnTables) {
    if (!(await knex.schema.hasTable(table))) continue;
    await knex.raw(`
      ALTER TABLE ?? SET (
        fillfactor = 90,
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_vacuum_threshold = 50,
        autovacuum_analyze_scale_factor = 0.02,
        autovacuum_analyze_threshold = 50
      )
    `, [table]);
  }
}

async function resetHighChurnStorageParameters(knex) {
  for (const table of highChurnTables) {
    if (!(await knex.schema.hasTable(table))) continue;
    await knex.raw(`
      ALTER TABLE ?? RESET (
        fillfactor,
        autovacuum_vacuum_scale_factor,
        autovacuum_vacuum_threshold,
        autovacuum_analyze_scale_factor,
        autovacuum_analyze_threshold
      )
    `, [table]);
  }
}

exports.up = async function up(knex) {
  for (const index of redundantIndexes) {
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ??`, [index]);
  }

  for (const sql of onlineIndexes) {
    await knex.raw(sql);
  }

  await setHighChurnStorageParameters(knex);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'match_player_stats'::regclass
           AND conname = 'match_player_stats_match_id_foreign'
           AND NOT convalidated
      ) THEN
        ALTER TABLE match_player_stats
          VALIDATE CONSTRAINT match_player_stats_match_id_foreign;
      END IF;
    END
    $$;
  `);
};

exports.down = async function down(knex) {
  const addedIndexes = [
    "notification_inbox_ranking_dedupe_idx",
    "notification_inbox_user_source_month_idx",
    "notification_inbox_source_event_idx",
    "notification_inbox_source_match_idx",
    "iam_user_roles_role_id_idx",
    "auth_users_linked_player_id_idx",
    "auth_users_branch_id_idx",
    "parent_player_links_player_parent_idx",
    "coach_group_assignments_group_id_idx",
  ];

  for (const index of addedIndexes) {
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ??`, [index]);
  }

  for (const sql of recreatedRedundantIndexes) {
    await knex.raw(sql);
  }

  await resetHighChurnStorageParameters(knex);
};

// CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction.
exports.config = { transaction: false };
