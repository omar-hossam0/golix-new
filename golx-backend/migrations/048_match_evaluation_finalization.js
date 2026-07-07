exports.up = async function up(knex) {
  const hasMatches = await knex.schema.hasTable("matches");
  if (!hasMatches) return;

  const hasFinalizedAt = await knex.schema.hasColumn(
    "matches",
    "evaluations_finalized_at",
  );
  const hasFinalizedBy = await knex.schema.hasColumn(
    "matches",
    "evaluations_finalized_by_coach_id",
  );

  await knex.schema.alterTable("matches", (t) => {
    if (!hasFinalizedAt) t.timestamp("evaluations_finalized_at");
    if (!hasFinalizedBy) {
      t.uuid("evaluations_finalized_by_coach_id")
        .references("id")
        .inTable("coach_profiles")
        .onDelete("SET NULL");
    }
  });
};

exports.down = async function down(knex) {
  const hasMatches = await knex.schema.hasTable("matches");
  if (!hasMatches) return;

  const columns = [];
  if (await knex.schema.hasColumn("matches", "evaluations_finalized_by_coach_id")) {
    columns.push("evaluations_finalized_by_coach_id");
  }
  if (await knex.schema.hasColumn("matches", "evaluations_finalized_at")) {
    columns.push("evaluations_finalized_at");
  }
  if (!columns.length) return;

  await knex.schema.alterTable("matches", (t) => {
    columns.forEach((column) => t.dropColumn(column));
  });
};
