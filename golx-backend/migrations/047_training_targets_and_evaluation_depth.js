exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'ball_control';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'dribbling';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'crossing';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'finishing';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'attacking';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'pressing';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'transition';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'possession';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'speed';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'agility';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'strength';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'endurance';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'mentality';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'vision';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'decision_making';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'goalkeeper';
    ALTER TYPE training_focus ADD VALUE IF NOT EXISTS 'set_pieces';
  `);

  const hasEventPlayers = await knex.schema.hasTable("calendar_event_players");
  if (!hasEventPlayers) {
    await knex.schema.createTable("calendar_event_players", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("event_id")
        .notNullable()
        .references("id")
        .inTable("calendar_events")
        .onDelete("CASCADE");
      t.uuid("player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      t.unique(["event_id", "player_id"]);
      t.index("event_id");
      t.index("player_id");
    });
  }

  const evaluationColumns = [
    ["ball_control_rating", (t) => t.decimal("ball_control_rating", 5, 2)],
    ["passing_accuracy_rating", (t) => t.decimal("passing_accuracy_rating", 5, 2)],
    ["shooting_rating", (t) => t.decimal("shooting_rating", 5, 2)],
    ["dribbling_rating", (t) => t.decimal("dribbling_rating", 5, 2)],
    [
      "receiving_under_pressure_rating",
      (t) => t.decimal("receiving_under_pressure_rating", 5, 2),
    ],
    ["speed_rating", (t) => t.decimal("speed_rating", 5, 2)],
    ["endurance_rating", (t) => t.decimal("endurance_rating", 5, 2)],
    ["strength_rating", (t) => t.decimal("strength_rating", 5, 2)],
    ["agility_rating", (t) => t.decimal("agility_rating", 5, 2)],
    ["development_notes", (t) => t.text("development_notes")],
  ];
  const hasEvaluations = await knex.schema.hasTable("player_event_evaluations");
  if (hasEvaluations) {
    for (const [columnName, addColumn] of evaluationColumns) {
      const exists = await knex.schema.hasColumn(
        "player_event_evaluations",
        columnName,
      );
      if (!exists) {
        await knex.schema.alterTable("player_event_evaluations", (t) => {
          addColumn(t);
        });
      }
    }
  }

  const matchColumns = [
    ["pass_accuracy_percentage", (t) => t.decimal("pass_accuracy_percentage", 5, 2)],
    ["shots_total", (t) => t.integer("shots_total").notNullable().defaultTo(0)],
    ["shots_on_target", (t) => t.integer("shots_on_target").notNullable().defaultTo(0)],
    ["key_passes", (t) => t.integer("key_passes").notNullable().defaultTo(0)],
    ["defensive_tackles", (t) => t.integer("defensive_tackles").notNullable().defaultTo(0)],
    ["duels_won", (t) => t.integer("duels_won").notNullable().defaultTo(0)],
    ["duels_lost", (t) => t.integer("duels_lost").notNullable().defaultTo(0)],
    ["possession_losses", (t) => t.integer("possession_losses").notNullable().defaultTo(0)],
    ["technical_rating", (t) => t.decimal("technical_rating", 5, 2)],
    ["tactical_rating", (t) => t.decimal("tactical_rating", 5, 2)],
    ["physical_rating", (t) => t.decimal("physical_rating", 5, 2)],
    ["mentality_rating", (t) => t.decimal("mentality_rating", 5, 2)],
    ["decision_making_rating", (t) => t.decimal("decision_making_rating", 5, 2)],
    ["work_rate_rating", (t) => t.decimal("work_rate_rating", 5, 2)],
    ["positioning_rating", (t) => t.decimal("positioning_rating", 5, 2)],
    ["strengths", (t) => t.text("strengths")],
    ["weaknesses", (t) => t.text("weaknesses")],
    ["improvement_plan", (t) => t.text("improvement_plan")],
  ];
  const hasStats = await knex.schema.hasTable("match_player_stats");
  if (hasStats) {
    for (const [columnName, addColumn] of matchColumns) {
      const exists = await knex.schema.hasColumn("match_player_stats", columnName);
      if (!exists) {
        await knex.schema.alterTable("match_player_stats", (t) => {
          addColumn(t);
        });
      }
    }
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("calendar_event_players");

  const hasEvaluations = await knex.schema.hasTable("player_event_evaluations");
  if (hasEvaluations) {
    const columns = [
      "ball_control_rating",
      "passing_accuracy_rating",
      "shooting_rating",
      "dribbling_rating",
      "receiving_under_pressure_rating",
      "speed_rating",
      "endurance_rating",
      "strength_rating",
      "agility_rating",
      "development_notes",
    ];
    await knex.schema.alterTable("player_event_evaluations", (t) => {
      columns.forEach((column) => t.dropColumn(column));
    });
  }

  const hasStats = await knex.schema.hasTable("match_player_stats");
  if (hasStats) {
    const columns = [
      "pass_accuracy_percentage",
      "shots_total",
      "shots_on_target",
      "key_passes",
      "defensive_tackles",
      "duels_won",
      "duels_lost",
      "possession_losses",
      "technical_rating",
      "tactical_rating",
      "physical_rating",
      "mentality_rating",
      "decision_making_rating",
      "work_rate_rating",
      "positioning_rating",
      "strengths",
      "weaknesses",
      "improvement_plan",
    ];
    await knex.schema.alterTable("match_player_stats", (t) => {
      columns.forEach((column) => t.dropColumn(column));
    });
  }
};
