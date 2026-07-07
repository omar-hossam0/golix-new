const allowedPositions = [
  ["GK", "Defender"],
  ["LB", "Defender"],
  ["CB", "Defender"],
  ["RB", "Defender"],
  ["CDM", "Midfielder"],
  ["LM", "Midfielder"],
  ["CM", "Midfielder"],
  ["RM", "Midfielder"],
  ["LW", "Forward"],
  ["ST", "Forward"],
  ["RW", "Forward"],
  ["CF", "Forward"],
];

const allowedCodes = allowedPositions.map(([code]) => code);

async function normalizePositionColumn(knex, tableName, columnName) {
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const updates = {
    LCB: "CB",
    RCB: "CB",
    LWB: "LB",
    RWB: "RB",
    LCM: "CM",
    RCM: "CM",
    LDM: "CDM",
    RDM: "CDM",
    CAM: "CM",
    LAM: "CM",
    RAM: "CM",
    LF: "LW",
    RF: "RW",
    LS: "ST",
    RS: "ST",
  };

  for (const [from, to] of Object.entries(updates)) {
    await knex(tableName)
      .whereRaw(`UPPER(${columnName}) = ?`, [from])
      .update({ [columnName]: to });
  }

  await knex(tableName)
    .whereNotNull(columnName)
    .whereRaw(`UPPER(${columnName}) NOT IN (${allowedCodes.map(() => "?").join(",")})`, allowedCodes)
    .update({ [columnName]: null });
}

exports.up = async function up(knex) {
  const hasPlayerOptions = await knex.schema.hasTable("player_field_options");
  if (hasPlayerOptions) {
    await knex("player_field_options")
      .where("field_key", "position")
      .whereRaw(`UPPER(value) NOT IN (${allowedCodes.map(() => "?").join(",")})`, allowedCodes)
      .del();
  }

  await normalizePositionColumn(knex, "player_profiles", "position");
  await normalizePositionColumn(knex, "match_squads", "position");

  const hasMapping = await knex.schema.hasTable("injury_risk_position_categories");
  if (!hasMapping) {
    await knex.schema.createTable("injury_risk_position_categories", (t) => {
      t.string("position_code", 12).primary();
      t.string("category", 24).notNullable();
      t.timestamps(true, true);
    });
    await knex.raw(`
      ALTER TABLE injury_risk_position_categories
      ADD CONSTRAINT injury_risk_position_categories_category_check
      CHECK (category IN ('Defender', 'Midfielder', 'Forward'))
    `);
  }

  await knex("injury_risk_position_categories")
    .insert(
      allowedPositions.map(([position_code, category]) => ({
        position_code,
        category,
      })),
    )
    .onConflict("position_code")
    .merge({
      category: knex.raw("excluded.category"),
      updated_at: knex.fn.now(),
    });

  await knex("injury_risk_position_categories")
    .whereNotIn("position_code", allowedCodes)
    .del();
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("injury_risk_position_categories");
};
