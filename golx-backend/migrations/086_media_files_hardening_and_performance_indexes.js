exports.up = async function up(knex) {
  if (await knex.schema.hasTable('media_files')) {
    const hasAcademyId = await knex.schema.hasColumn('media_files', 'academy_id');
    const hasScope = await knex.schema.hasColumn('media_files', 'scope');
    const hasIsSensitive = await knex.schema.hasColumn('media_files', 'is_sensitive');

    await knex.schema.alterTable('media_files', (t) => {
      if (!hasAcademyId) t.uuid('academy_id').references('id').inTable('academy_academies').onDelete('SET NULL');
      if (!hasScope) t.string('scope', 80);
      if (!hasIsSensitive) t.boolean('is_sensitive').notNullable().defaultTo(true);
    });

    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS media_files_storage_key_unique_idx
      ON media_files (storage_key)
    `);
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS media_files_academy_scope_created_idx
      ON media_files (academy_id, scope, created_at DESC)
      WHERE academy_id IS NOT NULL
    `);
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ranking_snapshots_period_score_idx
    ON ranking_snapshots (period, total_score DESC, rank ASC)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ranking_snapshots_group_period_score_idx
    ON ranking_snapshots (group_id, period, total_score DESC, rank ASC)
    WHERE group_id IS NOT NULL
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS player_daily_ai_inputs_academy_date_player_idx
    ON player_daily_ai_inputs (academy_id, input_date, player_id)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS player_event_evaluations_player_event_idx
    ON player_event_evaluations (player_id, event_id)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS match_player_stats_player_match_idx
    ON match_player_stats (player_id, match_id)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS match_attendance_player_match_status_idx
    ON match_attendance (player_id, match_id, status)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS player_assignment_files_file_url_idx
    ON player_assignment_files (file_url)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS coach_assignment_files_file_url_idx
    ON coach_assignment_files (file_url)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS coach_assignment_files_file_url_idx;
    DROP INDEX IF EXISTS player_assignment_files_file_url_idx;
    DROP INDEX IF EXISTS match_attendance_player_match_status_idx;
    DROP INDEX IF EXISTS match_player_stats_player_match_idx;
    DROP INDEX IF EXISTS player_event_evaluations_player_event_idx;
    DROP INDEX IF EXISTS player_daily_ai_inputs_academy_date_player_idx;
    DROP INDEX IF EXISTS ranking_snapshots_group_period_score_idx;
    DROP INDEX IF EXISTS ranking_snapshots_period_score_idx;
    DROP INDEX IF EXISTS media_files_academy_scope_created_idx;
    DROP INDEX IF EXISTS media_files_storage_key_unique_idx;
  `);

  if (await knex.schema.hasTable('media_files')) {
    const hasIsSensitive = await knex.schema.hasColumn('media_files', 'is_sensitive');
    const hasScope = await knex.schema.hasColumn('media_files', 'scope');
    const hasAcademyId = await knex.schema.hasColumn('media_files', 'academy_id');
    await knex.schema.alterTable('media_files', (t) => {
      if (hasIsSensitive) t.dropColumn('is_sensitive');
      if (hasScope) t.dropColumn('scope');
      if (hasAcademyId) t.dropColumn('academy_id');
    });
  }
};
