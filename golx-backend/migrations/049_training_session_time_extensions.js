exports.up = async function up(knex) {
  const hasTrainingSessions = await knex.schema.hasTable("training_sessions");
  if (!hasTrainingSessions) return;

  const hasOriginalEnd = await knex.schema.hasColumn(
    "training_sessions",
    "original_end_datetime",
  );
  const hasExtendedMinutes = await knex.schema.hasColumn(
    "training_sessions",
    "extended_minutes",
  );
  const hasLastExtendedAt = await knex.schema.hasColumn(
    "training_sessions",
    "last_extended_at",
  );

  await knex.schema.alterTable("training_sessions", (t) => {
    if (!hasOriginalEnd) t.timestamp("original_end_datetime");
    if (!hasExtendedMinutes) {
      t.integer("extended_minutes").notNullable().defaultTo(0);
    }
    if (!hasLastExtendedAt) t.timestamp("last_extended_at");
  });
};

exports.down = async function down(knex) {
  const hasTrainingSessions = await knex.schema.hasTable("training_sessions");
  if (!hasTrainingSessions) return;

  const columns = [];
  if (await knex.schema.hasColumn("training_sessions", "last_extended_at")) {
    columns.push("last_extended_at");
  }
  if (await knex.schema.hasColumn("training_sessions", "extended_minutes")) {
    columns.push("extended_minutes");
  }
  if (await knex.schema.hasColumn("training_sessions", "original_end_datetime")) {
    columns.push("original_end_datetime");
  }
  if (!columns.length) return;

  await knex.schema.alterTable("training_sessions", (t) => {
    columns.forEach((column) => t.dropColumn(column));
  });
};
