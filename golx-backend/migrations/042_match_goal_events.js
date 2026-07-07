exports.up = async function up(knex) {
  const hasGoalEvents = await knex.schema.hasTable("match_goal_events");
  if (!hasGoalEvents) {
    await knex.schema.createTable("match_goal_events", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("match_id")
        .notNullable()
        .references("id")
        .inTable("matches")
        .onDelete("CASCADE");
      t.string("team", 20).notNullable();
      t.uuid("scorer_player_id")
        .references("id")
        .inTable("player_profiles")
        .onDelete("SET NULL");
      t.uuid("assist_player_id")
        .references("id")
        .inTable("player_profiles")
        .onDelete("SET NULL");
      t.uuid("coach_id")
        .references("id")
        .inTable("coach_profiles")
        .onDelete("SET NULL");
      t.integer("minute").notNullable().defaultTo(0);
      t.text("notes");
      t.timestamps(true, true);
      t.index("match_id");
      t.index("scorer_player_id");
      t.index("assist_player_id");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("match_goal_events");
};
