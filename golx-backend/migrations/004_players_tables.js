/**
 * Players module tables:
 *   player_profiles, player_group_assignments, player_measurements, player_injury_history
 */
exports.up = async function (knex) {
    // ─── player profiles ──────────────────────────────────────────────
    await knex.schema.createTable('player_profiles', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').references('id').inTable('auth_users').onDelete('SET NULL');
        t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
        t.string('full_name', 255).notNullable();
        t.date('date_of_birth');
        t.enum('level', ['A', 'B', 'C', 'D', 'F'], {
            useNative: true,
            enumName: 'player_level',
        }).defaultTo('F');
        t.string('position', 50);
        t.enum('preferred_foot', ['left', 'right', 'both'], {
            useNative: true,
            enumName: 'preferred_foot',
        });
        t.text('photo_url');
        t.string('guardian_name', 255);
        t.string('guardian_phone', 30);
        t.timestamps(true, true);
        t.timestamp('deleted_at');
        t.index('academy_id');
        t.index('user_id');
    });

    // ─── group assignments ────────────────────────────────────────────
    await knex.schema.createTable('player_group_assignments', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
        t.timestamp('joined_at').defaultTo(knex.fn.now());
        t.timestamp('left_at');
        t.index(['player_id', 'group_id']);
    });

    // ─── measurements ────────────────────────────────────────────────
    await knex.schema.createTable('player_measurements', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.decimal('height_cm', 6, 2);
        t.decimal('weight_kg', 6, 2);
        t.date('measured_at').notNullable();
        t.uuid('measured_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.index('player_id');
    });

    // ─── injury history ──────────────────────────────────────────────
    await knex.schema.createTable('player_injury_history', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.string('injury_type', 100);
        t.date('injury_date');
        t.date('recovery_date');
        t.text('notes');
        t.uuid('reported_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.index('player_id');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('player_injury_history');
    await knex.schema.dropTableIfExists('player_measurements');
    await knex.schema.dropTableIfExists('player_group_assignments');
    await knex.schema.dropTableIfExists('player_profiles');
    await knex.raw('DROP TYPE IF EXISTS player_level');
    await knex.raw('DROP TYPE IF EXISTS preferred_foot');
};
