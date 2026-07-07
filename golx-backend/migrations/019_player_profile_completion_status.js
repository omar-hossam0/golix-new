/**
 * Track whether a player has only the basic account data or a completed profile.
 */
exports.up = async function (knex) {
    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE player_profile_status AS ENUM ('incomplete', 'complete');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    `);

    await knex.schema.alterTable('player_profiles', (t) => {
        t.specificType('profile_status', 'player_profile_status').notNullable().defaultTo('incomplete');
        t.timestamp('profile_completed_at');
        t.index('profile_status');
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('player_profiles', (t) => {
        t.dropColumn('profile_completed_at');
        t.dropColumn('profile_status');
    });

    await knex.raw('DROP TYPE IF EXISTS player_profile_status');
};
