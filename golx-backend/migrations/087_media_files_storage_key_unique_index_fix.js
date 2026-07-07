exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('media_files'))) return;

  await knex.raw('DROP INDEX IF EXISTS media_files_storage_key_unique_idx');
  await knex.raw(`
    CREATE UNIQUE INDEX media_files_storage_key_unique_idx
    ON media_files (storage_key)
  `);
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasTable('media_files'))) return;

  await knex.raw('DROP INDEX IF EXISTS media_files_storage_key_unique_idx');
  await knex.raw(`
    CREATE UNIQUE INDEX media_files_storage_key_unique_idx
    ON media_files (storage_key)
    WHERE storage_key IS NOT NULL
  `);
};
