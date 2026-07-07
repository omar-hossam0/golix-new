const dropColumnIfExists = async (knex, tableName, columnName) => {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (!exists) return;
  await knex.schema.alterTable(tableName, (t) => {
    t.dropColumn(columnName);
  });
};

const addColumnIfMissing = async (knex, tableName, columnName, addColumn) => {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (exists) return;
  await knex.schema.alterTable(tableName, (t) => {
    addColumn(t);
  });
};

exports.up = async function up(knex) {
  const hasPlayerFieldOptions = await knex.schema.hasTable("player_field_options");
  if (hasPlayerFieldOptions) {
    await knex("player_field_options")
      .whereIn("field_key", ["secondary_position", "playing_style"])
      .del();
  }

  for (const columnName of [
    "secondary_positions",
    "current_team",
    "shirt_number",
    "playing_style",
    "years_experience",
    "previous_club_academy",
  ]) {
    await dropColumnIfExists(knex, "player_profiles", columnName);
  }

  for (const columnName of [
    "acceleration",
    "strength",
    "agility",
    "balance",
    "jump_height_cm",
  ]) {
    await dropColumnIfExists(knex, "player_measurements", columnName);
  }
};

exports.down = async function down(knex) {
  await addColumnIfMissing(knex, "player_profiles", "secondary_positions", (t) => {
    t.jsonb("secondary_positions").notNullable().defaultTo(knex.raw("'[]'::jsonb"));
  });
  await addColumnIfMissing(knex, "player_profiles", "current_team", (t) => {
    t.string("current_team", 120);
  });
  await addColumnIfMissing(knex, "player_profiles", "shirt_number", (t) => {
    t.smallint("shirt_number");
  });
  await addColumnIfMissing(knex, "player_profiles", "playing_style", (t) => {
    t.text("playing_style");
  });
  await addColumnIfMissing(knex, "player_profiles", "years_experience", (t) => {
    t.smallint("years_experience");
  });
  await addColumnIfMissing(knex, "player_profiles", "previous_club_academy", (t) => {
    t.string("previous_club_academy", 255);
  });

  await addColumnIfMissing(knex, "player_measurements", "acceleration", (t) => {
    t.decimal("acceleration", 6, 2);
  });
  await addColumnIfMissing(knex, "player_measurements", "strength", (t) => {
    t.smallint("strength");
  });
  await addColumnIfMissing(knex, "player_measurements", "agility", (t) => {
    t.smallint("agility");
  });
  await addColumnIfMissing(knex, "player_measurements", "balance", (t) => {
    t.smallint("balance");
  });
  await addColumnIfMissing(knex, "player_measurements", "jump_height_cm", (t) => {
    t.decimal("jump_height_cm", 6, 2);
  });
};
