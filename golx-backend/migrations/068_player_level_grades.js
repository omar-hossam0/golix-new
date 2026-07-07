exports.up = async function up(knex) {
  const hasPlayers = await knex.schema.hasTable("player_profiles");
  if (!hasPlayers) return;

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level DROP DEFAULT
  `);

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level TYPE text
    USING CASE level::text
      WHEN 'elite' THEN 'A'
      WHEN 'advanced' THEN 'B'
      WHEN 'intermediate' THEN 'C'
      WHEN 'beginner' THEN 'F'
      ELSE level::text
    END
  `);

  await knex.raw("DROP TYPE IF EXISTS player_level");
  await knex.raw("CREATE TYPE player_level AS ENUM ('A', 'B', 'C', 'D', 'F')");

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level TYPE player_level
    USING CASE
      WHEN level IN ('A', 'B', 'C', 'D', 'F') THEN level::player_level
      WHEN level IS NULL OR level = '' THEN NULL
      ELSE 'F'::player_level
    END
  `);

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level SET DEFAULT 'F'
  `);
};

exports.down = async function down(knex) {
  const hasPlayers = await knex.schema.hasTable("player_profiles");
  if (!hasPlayers) return;

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level DROP DEFAULT
  `);

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level TYPE text
    USING CASE level::text
      WHEN 'A' THEN 'elite'
      WHEN 'B' THEN 'advanced'
      WHEN 'C' THEN 'intermediate'
      WHEN 'D' THEN 'beginner'
      WHEN 'F' THEN 'beginner'
      ELSE level::text
    END
  `);

  await knex.raw("DROP TYPE IF EXISTS player_level");
  await knex.raw(
    "CREATE TYPE player_level AS ENUM ('beginner', 'intermediate', 'advanced', 'elite')",
  );

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level TYPE player_level
    USING CASE
      WHEN level IN ('beginner', 'intermediate', 'advanced', 'elite') THEN level::player_level
      WHEN level IS NULL OR level = '' THEN NULL
      ELSE 'beginner'::player_level
    END
  `);

  await knex.raw(`
    ALTER TABLE player_profiles
    ALTER COLUMN level SET DEFAULT 'beginner'
  `);
};
