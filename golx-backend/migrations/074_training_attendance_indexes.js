const indexes = [
  `
    CREATE INDEX IF NOT EXISTS calendar_events_training_academy_start_idx
    ON calendar_events (academy_id, start_datetime DESC)
    WHERE deleted_at IS NULL AND event_type = 'training'
  `,
  `
    CREATE INDEX IF NOT EXISTS event_attendance_event_status_player_idx
    ON event_attendance (event_id, status, player_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS event_attendance_player_event_status_idx
    ON event_attendance (player_id, event_id, status)
  `,
  `
    CREATE INDEX IF NOT EXISTS training_sessions_coach_event_idx
    ON training_sessions (coach_id, event_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS calendar_event_groups_group_event_idx
    ON calendar_event_groups (group_id, event_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS player_group_assignments_group_active_idx
    ON player_group_assignments (group_id, player_id)
    WHERE left_at IS NULL
  `,
];

exports.up = async function up(knex) {
  for (const statement of indexes) {
    await knex.raw(statement);
  }
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS player_group_assignments_group_active_idx;
    DROP INDEX IF EXISTS calendar_event_groups_group_event_idx;
    DROP INDEX IF EXISTS training_sessions_coach_event_idx;
    DROP INDEX IF EXISTS event_attendance_player_event_status_idx;
    DROP INDEX IF EXISTS event_attendance_event_status_player_idx;
    DROP INDEX IF EXISTS calendar_events_training_academy_start_idx;
  `);
};
