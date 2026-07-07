async function addColumnIfMissing(knex, table, column, addColumn) {
  if (await knex.schema.hasColumn(table, column)) return;
  await knex.schema.alterTable(table, (t) => addColumn(t));
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("chat_message_user_deletions"))) return;

  if (!(await knex.schema.hasTable("chat_message_user_deletions_archive"))) {
    await knex.raw(`
      CREATE TABLE chat_message_user_deletions_archive
      (LIKE chat_message_user_deletions INCLUDING ALL)
    `);
  }

  await addColumnIfMissing(knex, "chat_message_user_deletions_archive", "archived_at", (t) => {
    t.timestamp("archived_at").notNullable().defaultTo(knex.fn.now());
  });
  await addColumnIfMissing(knex, "chat_message_user_deletions_archive", "archive_batch_id", (t) => {
    t.uuid("archive_batch_id")
      .references("id")
      .inTable("data_lifecycle_runs")
      .onDelete("SET NULL");
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS chat_message_user_deletions_archive_archived_idx
    ON chat_message_user_deletions_archive (archived_at DESC)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS chat_message_user_deletions_archive_user_idx
    ON chat_message_user_deletions_archive (user_id, message_id)
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("chat_message_user_deletions_archive");
};
