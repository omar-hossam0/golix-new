exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('media_files'))) return;

  await knex.raw(`
    UPDATE media_files AS mf
    SET
      academy_id = ca.academy_id,
      scope = 'assignments',
      entity_type = 'coach_assignment',
      entity_id = caf.assignment_id,
      is_sensitive = true,
      updated_at = now()
    FROM coach_assignment_files AS caf
    JOIN coach_assignments AS ca ON ca.id = caf.assignment_id
    WHERE mf.url = caf.file_url
       OR mf.storage_key = regexp_replace(caf.file_url, '^/uploads/+', '')
  `);

  await knex.raw(`
    UPDATE media_files AS mf
    SET
      academy_id = pa.academy_id,
      scope = 'player-assignments',
      entity_type = 'player_assignment_submission',
      entity_id = paf.submission_id,
      is_sensitive = true,
      updated_at = now()
    FROM player_assignment_files AS paf
    JOIN player_assignment_submissions AS pas ON pas.id = paf.submission_id
    JOIN player_assignments AS pa ON pa.id = pas.assignment_id
    WHERE mf.url = paf.file_url
       OR mf.storage_key = regexp_replace(paf.file_url, '^/uploads/+', '')
  `);
};

exports.down = async function down() {
  // Metadata backfill is intentionally not reverted; it only makes existing
  // media records more specific and does not change product data.
};
