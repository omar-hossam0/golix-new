exports.up = async function up(knex) {
  await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE match_player_incident_type AS ENUM ('yellow_card', 'red_card', 'injury');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

  const matchDayNotified = await knex.schema.hasColumn(
    "matches",
    "match_day_notified_at",
  );
  const startedAt = await knex.schema.hasColumn("matches", "started_at");
  const firstHalfStartedAt = await knex.schema.hasColumn(
    "matches",
    "first_half_started_at",
  );
  const firstHalfStoppage = await knex.schema.hasColumn(
    "matches",
    "first_half_stoppage_minutes",
  );
  const secondHalfStartedAt = await knex.schema.hasColumn(
    "matches",
    "second_half_started_at",
  );
  const secondHalfStoppage = await knex.schema.hasColumn(
    "matches",
    "second_half_stoppage_minutes",
  );
  const finishedAt = await knex.schema.hasColumn("matches", "finished_at");

  await knex.schema.alterTable("matches", (t) => {
    if (!matchDayNotified) t.timestamp("match_day_notified_at");
    if (!startedAt) t.timestamp("started_at");
    if (!firstHalfStartedAt) t.timestamp("first_half_started_at");
    if (!firstHalfStoppage)
      t.integer("first_half_stoppage_minutes").notNullable().defaultTo(0);
    if (!secondHalfStartedAt) t.timestamp("second_half_started_at");
    if (!secondHalfStoppage)
      t.integer("second_half_stoppage_minutes").notNullable().defaultTo(0);
    if (!finishedAt) t.timestamp("finished_at");
  });

  const hasIncidents = await knex.schema.hasTable("match_player_incidents");
  if (!hasIncidents) {
    await knex.schema.createTable("match_player_incidents", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("match_id")
        .notNullable()
        .references("id")
        .inTable("matches")
        .onDelete("CASCADE");
      t.uuid("player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.uuid("coach_id")
        .references("id")
        .inTable("coach_profiles")
        .onDelete("SET NULL");
      t.specificType(
        "incident_type",
        "match_player_incident_type",
      ).notNullable();
      t.string("body_part", 100);
      t.date("injury_date");
      t.text("notes");
      t.timestamps(true, true);
      t.index("match_id");
      t.index("player_id");
      t.index("incident_type");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("match_player_incidents");
  await knex.schema.alterTable("matches", (t) => {
    t.dropColumn("match_day_notified_at");
    t.dropColumn("started_at");
    t.dropColumn("first_half_started_at");
    t.dropColumn("first_half_stoppage_minutes");
    t.dropColumn("second_half_started_at");
    t.dropColumn("second_half_stoppage_minutes");
    t.dropColumn("finished_at");
  });
  await knex.raw("DROP TYPE IF EXISTS match_player_incident_type");
};
