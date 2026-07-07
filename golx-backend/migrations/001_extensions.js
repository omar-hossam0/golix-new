/**
 * Enable pgcrypto for uuid_generate_v4()
 * Create updated_at trigger function
 */
exports.up = async function (knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Generic updated_at trigger function
    await knex.raw(`
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = async function (knex) {
    await knex.raw('DROP FUNCTION IF EXISTS trigger_set_updated_at() CASCADE');
};
