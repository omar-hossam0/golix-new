exports.up = async function up(knex) {
  const hasStats = await knex.schema.hasTable("match_player_stats");
  if (!hasStats) return;

  const hasShots = await knex.schema.hasColumn("match_player_stats", "shots");
  const hasShotsOnTarget = await knex.schema.hasColumn(
    "match_player_stats",
    "shots_on_target",
  );

  if (hasShots || hasShotsOnTarget) {
    await knex.schema.alterTable("match_player_stats", (t) => {
      if (hasShotsOnTarget) t.dropColumn("shots_on_target");
      if (hasShots) t.dropColumn("shots");
    });
  }
};

exports.down = async function down(knex) {
  const hasStats = await knex.schema.hasTable("match_player_stats");
  if (!hasStats) return;

  const hasShots = await knex.schema.hasColumn("match_player_stats", "shots");
  const hasShotsOnTarget = await knex.schema.hasColumn(
    "match_player_stats",
    "shots_on_target",
  );

  if (!hasShots || !hasShotsOnTarget) {
    await knex.schema.alterTable("match_player_stats", (t) => {
      if (!hasShots) t.integer("shots").notNullable().defaultTo(0);
      if (!hasShotsOnTarget)
        t.integer("shots_on_target").notNullable().defaultTo(0);
    });
  }
};
