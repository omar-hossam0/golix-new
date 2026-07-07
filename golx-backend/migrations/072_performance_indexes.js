const indexes = [
  `
    CREATE INDEX IF NOT EXISTS notification_inbox_user_created_idx
    ON notification_inbox (user_id, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS notification_inbox_user_unread_created_idx
    ON notification_inbox (user_id, created_at DESC)
    WHERE is_read = false
  `,
  `
    CREATE INDEX IF NOT EXISTS player_profiles_academy_branch_active_idx
    ON player_profiles (academy_id, branch_id, full_name)
    WHERE deleted_at IS NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS coach_profiles_academy_branch_active_idx
    ON coach_profiles (academy_id, branch_id, full_name)
    WHERE deleted_at IS NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS academy_branches_academy_name_active_idx
    ON academy_branches (academy_id, name)
    WHERE deleted_at IS NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS academy_groups_branch_name_active_idx
    ON academy_groups (branch_id, name)
    WHERE deleted_at IS NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS attendance_sessions_group_date_idx
    ON attendance_sessions (group_id, session_date DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS calendar_events_academy_start_active_idx
    ON calendar_events (academy_id, start_datetime)
    WHERE deleted_at IS NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS matches_event_date_active_idx
    ON matches (event_id, match_date, match_time)
    WHERE deleted_at IS NULL
  `,
];

exports.up = async function up(knex) {
  for (const statement of indexes) {
    await knex.raw(statement);
  }
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS matches_event_date_active_idx;
    DROP INDEX IF EXISTS calendar_events_academy_start_active_idx;
    DROP INDEX IF EXISTS attendance_sessions_group_date_idx;
    DROP INDEX IF EXISTS academy_groups_branch_name_active_idx;
    DROP INDEX IF EXISTS academy_branches_academy_name_active_idx;
    DROP INDEX IF EXISTS coach_profiles_academy_branch_active_idx;
    DROP INDEX IF EXISTS player_profiles_academy_branch_active_idx;
    DROP INDEX IF EXISTS notification_inbox_user_unread_created_idx;
    DROP INDEX IF EXISTS notification_inbox_user_created_idx;
  `);
};
