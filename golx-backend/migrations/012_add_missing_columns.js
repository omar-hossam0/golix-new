/**
 * Add missing columns that were referenced in application code but absent from earlier migrations:
 *   - player_profiles: branch_id (FK), notes
 *   - player_measurements: notes
 *   - player_injury_history: body_part, severity (enum)
 *   - auth_users: is_verified
 */
exports.up = async function (knex) {
    // ─── player_profiles ─────────────────────────────────────────────
    await knex.schema.alterTable('player_profiles', (t) => {
        t.uuid('branch_id').nullable().references('id').inTable('academy_branches').onDelete('SET NULL');
        t.text('notes');
        t.index('branch_id');
    });

    // ─── player_measurements ─────────────────────────────────────────
    await knex.schema.alterTable('player_measurements', (t) => {
        t.text('notes');
    });

    // ─── player_injury_history ────────────────────────────────────────
    // Create the severity enum type first, then add columns
    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE injury_severity AS ENUM ('minor', 'moderate', 'severe');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$
    `);

    await knex.schema.alterTable('player_injury_history', (t) => {
        t.string('body_part', 50);
        t.specificType('severity', 'injury_severity');
    });

    // ─── auth_users ──────────────────────────────────────────────────
    await knex.schema.alterTable('auth_users', (t) => {
        t.boolean('is_verified').defaultTo(false);
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('auth_users', (t) => {
        t.dropColumn('is_verified');
    });

    await knex.schema.alterTable('player_injury_history', (t) => {
        t.dropColumn('severity');
        t.dropColumn('body_part');
    });

    await knex.raw('DROP TYPE IF EXISTS injury_severity');

    await knex.schema.alterTable('player_measurements', (t) => {
        t.dropColumn('notes');
    });

    await knex.schema.alterTable('player_profiles', (t) => {
        t.dropColumn('notes');
        t.dropColumn('branch_id');
    });
};
