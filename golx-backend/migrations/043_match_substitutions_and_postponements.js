exports.up = async function up(knex) {
  const hasSubstitutions = await knex.schema.hasTable("match_substitutions");
  if (!hasSubstitutions) {
    await knex.schema.createTable("match_substitutions", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("match_id")
        .notNullable()
        .references("id")
        .inTable("matches")
        .onDelete("CASCADE");
      t.uuid("out_player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.uuid("in_player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.uuid("coach_id")
        .references("id")
        .inTable("coach_profiles")
        .onDelete("SET NULL");
      t.integer("minute").notNullable().defaultTo(0);
      t.text("reason");
      t.timestamps(true, true);
      t.index("match_id");
      t.index("out_player_id");
      t.index("in_player_id");
    });
  }

  const hasPostponements = await knex.schema.hasTable("match_postponements");
  if (!hasPostponements) {
    await knex.schema.createTable("match_postponements", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("match_id")
        .notNullable()
        .references("id")
        .inTable("matches")
        .onDelete("CASCADE");
      t.date("previous_date").notNullable();
      t.time("previous_time").notNullable();
      t.date("new_date").notNullable();
      t.time("new_time").notNullable();
      t.string("previous_location", 255);
      t.string("new_location", 255);
      t.text("reason");
      t.uuid("postponed_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.timestamps(true, true);
      t.index("match_id");
      t.index("postponed_by_user_id");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("match_postponements");
  await knex.schema.dropTableIfExists("match_substitutions");
};
