exports.up = async function up(knex) {
    const exists = await knex.schema.hasTable('admin_match_coach_requests');
    if (exists) return;

    await knex.schema.createTable('admin_match_coach_requests', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
        t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
        t.uuid('requested_by_admin_id').references('id').inTable('auth_users').onDelete('SET NULL');
        t.string('opponent_name', 255).notNullable();
        t.string('match_type', 50).notNullable();
        t.date('match_date').notNullable();
        t.time('match_time').notNullable();
        t.string('location', 255).notNullable();
        t.string('venue_type', 50).notNullable();
        t.string('referee_name', 255);
        t.text('organizer_notes');
        t.string('status', 30).notNullable().defaultTo('pending');
        t.timestamp('expires_at').notNullable();
        t.uuid('selected_group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.uuid('selected_birth_year_id').references('id').inTable('academy_birth_years').onDelete('SET NULL');
        t.uuid('created_match_id').references('id').inTable('matches').onDelete('SET NULL');
        t.timestamps(true, true);

        t.index(['academy_id', 'status']);
        t.index(['coach_id', 'status']);
        t.index('expires_at');
    });

    await knex.raw(`
        ALTER TABLE admin_match_coach_requests
        ADD CONSTRAINT admin_match_coach_requests_status_check
        CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
    `);
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('admin_match_coach_requests');
};
