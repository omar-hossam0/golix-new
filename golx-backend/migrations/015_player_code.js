/**
 * Player Code Generation:
 *   - player_profiles.player_code  — unique human-readable code (PLY-U10-2026-0001)
 *   - player_code_sequences         — atomic counter per (category, year) pair
 *
 * The sequence table uses PostgreSQL's atomic INSERT … ON CONFLICT DO UPDATE
 * to guarantee no two players ever share the same sequential number, even under
 * concurrent inserts (race-condition safe, no application-level locking needed).
 */
exports.up = async function (knex) {
    // ── 1. Add player_code to player_profiles ─────────────────────────
    await knex.schema.alterTable('player_profiles', (t) => {
        t.string('player_code', 20).unique().nullable();
        t.index('player_code');
    });

    // ── 2. Create atomic sequence counter table ───────────────────────
    await knex.schema.createTable('player_code_sequences', (t) => {
        // surrogate PK (lightweight, never referenced externally)
        t.increments('id').primary();

        // e.g. 'U10', 'U14', 'U18'
        t.string('category', 10).notNullable();

        // 4-digit registration year, e.g. 2026
        t.smallint('year').notNullable();

        // ever-increasing counter — never reset, never reused
        t.integer('last_seq').notNullable().defaultTo(0);

        // The combination (category + year) must be unique for the counter to work
        t.unique(['category', 'year']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('player_code_sequences');
    await knex.schema.alterTable('player_profiles', (t) => {
        t.dropIndex('player_code');
        t.dropColumn('player_code');
    });
};
