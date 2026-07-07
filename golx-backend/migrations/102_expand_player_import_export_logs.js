exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable("player_import_logs");
  if (!exists) return;

  await knex.raw(`
    ALTER TABLE player_import_logs
    DROP CONSTRAINT IF EXISTS player_import_logs_status_check
  `);

  await knex.schema.alterTable("player_import_logs", (table) => {
    table
      .string("action_type", 30)
      .notNullable()
      .defaultTo("import_process");
    table.integer("created_count").notNullable().defaultTo(0);
    table.integer("updated_count").notNullable().defaultTo(0);
    table.integer("skipped_count").notNullable().defaultTo(0);
    table.integer("failed_count").notNullable().defaultTo(0);
    table.timestamp("completed_at", { useTz: true });
    table.index(
      ["academy_id", "action_type", "created_at"],
      "player_import_logs_action_created_idx",
    );
  });

  await knex.raw(`
    ALTER TABLE player_import_logs
    ADD CONSTRAINT player_import_logs_status_check
    CHECK (status IN ('pending', 'processing', 'failed', 'completed'))
  `);

  await knex.raw(`
    ALTER TABLE player_import_logs
    ADD CONSTRAINT player_import_logs_action_type_check
    CHECK (
      action_type IN (
        'export_full',
        'export_sample',
        'export_empty',
        'import_validate',
        'import_process'
      )
    )
  `);
};

exports.down = async function down(knex) {
  const exists = await knex.schema.hasTable("player_import_logs");
  if (!exists) return;

  await knex.raw(`
    ALTER TABLE player_import_logs
    DROP CONSTRAINT IF EXISTS player_import_logs_action_type_check
  `);
  await knex.raw(`
    ALTER TABLE player_import_logs
    DROP CONSTRAINT IF EXISTS player_import_logs_status_check
  `);

  await knex.schema.alterTable("player_import_logs", (table) => {
    table.dropIndex(
      ["academy_id", "action_type", "created_at"],
      "player_import_logs_action_created_idx",
    );
    table.dropColumn("completed_at");
    table.dropColumn("failed_count");
    table.dropColumn("skipped_count");
    table.dropColumn("updated_count");
    table.dropColumn("created_count");
    table.dropColumn("action_type");
  });

  await knex.raw(`
    ALTER TABLE player_import_logs
    ADD CONSTRAINT player_import_logs_status_check
    CHECK (status IN ('pending', 'failed', 'completed'))
  `);
};
