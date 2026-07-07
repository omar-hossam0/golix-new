exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable("player_import_logs");
  if (exists) return;

  await knex.schema.createTable("player_import_logs", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("academy_id")
      .notNullable()
      .references("id")
      .inTable("academy_academies")
      .onDelete("CASCADE");
    table
      .uuid("uploaded_by_user_id")
      .references("id")
      .inTable("auth_users")
      .onDelete("SET NULL");
    table.string("file_name", 255).notNullable();
    table.integer("total_rows").notNullable().defaultTo(0);
    table.integer("imported_rows").notNullable().defaultTo(0);
    table.string("status", 20).notNullable().defaultTo("pending");
    table.jsonb("error_details");
    table.timestamps(true, true);

    table.index(
      ["academy_id", "created_at"],
      "player_import_logs_academy_created_idx",
    );
    table.index(
      ["uploaded_by_user_id", "created_at"],
      "player_import_logs_user_created_idx",
    );
    table.index(
      ["academy_id", "status", "created_at"],
      "player_import_logs_status_created_idx",
    );
  });

  await knex.raw(`
    ALTER TABLE player_import_logs
    ADD CONSTRAINT player_import_logs_status_check
    CHECK (status IN ('pending', 'failed', 'completed'))
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("player_import_logs");
};
