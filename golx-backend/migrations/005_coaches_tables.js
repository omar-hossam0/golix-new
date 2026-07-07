/**
 * Coaches module tables:
 *   coach_profiles, coach_group_assignments, coach_performance_scores
 */
exports.up = async function (knex) {
    // ─── coach profiles ───────────────────────────────────────────────
    await knex.schema.createTable('coach_profiles', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').references('id').inTable('auth_users').onDelete('SET NULL');
        t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
        t.string('full_name', 255).notNullable();
        t.string('specialization', 100);
        t.text('bio');
        t.text('photo_url');
        t.timestamps(true, true);
        t.timestamp('deleted_at');
        t.index('academy_id');
        t.index('user_id');
    });

    // ─── group assignments ────────────────────────────────────────────
    await knex.schema.createTable('coach_group_assignments', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
        t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
        t.enum('role', ['head', 'assistant', 'goalkeeping'], {
            useNative: true,
            enumName: 'coach_group_role',
        }).defaultTo('assistant');
        t.timestamp('assigned_at').defaultTo(knex.fn.now());
        t.index(['coach_id', 'group_id']);
    });

    // ─── performance scores ───────────────────────────────────────────
    await knex.schema.createTable('coach_performance_scores', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
        t.string('period', 20).notNullable(); // e.g. "2024-W12", "2024-03"
        t.decimal('player_improvement', 5, 2);
        t.decimal('injury_frequency', 5, 2);
        t.decimal('attendance_consistency', 5, 2);
        t.decimal('data_entry_score', 5, 2);
        t.decimal('total_score', 5, 2);
        t.timestamp('calculated_at').defaultTo(knex.fn.now());
        t.index('coach_id');
        t.unique(['coach_id', 'period']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('coach_performance_scores');
    await knex.schema.dropTableIfExists('coach_group_assignments');
    await knex.schema.dropTableIfExists('coach_profiles');
    await knex.raw('DROP TYPE IF EXISTS coach_group_role');
};
