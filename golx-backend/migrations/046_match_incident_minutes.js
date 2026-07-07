exports.up = async function up(knex) {
  const hasIncidents = await knex.schema.hasTable("match_player_incidents");
  if (!hasIncidents) return;

  const hasMinute = await knex.schema.hasColumn(
    "match_player_incidents",
    "minute",
  );
  if (!hasMinute) {
    await knex.schema.alterTable("match_player_incidents", (t) => {
      t.integer("minute").notNullable().defaultTo(0);
      t.index("minute");
    });
  }
};

exports.down = async function down(knex) {
  const hasIncidents = await knex.schema.hasTable("match_player_incidents");
  if (!hasIncidents) return;

  const hasMinute = await knex.schema.hasColumn(
    "match_player_incidents",
    "minute",
  );
  if (hasMinute) {
    await knex.schema.alterTable("match_player_incidents", (t) => {
      t.dropIndex("minute");
      t.dropColumn("minute");
    });
  }
};
