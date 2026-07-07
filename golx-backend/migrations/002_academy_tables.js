/**
 * Academy module tables:
 *   academy_academies, academy_branches, academy_birth_years,
 *   academy_groups, academy_schedules
 */
exports.up = async function (knex) {
    // ─── academies ────────────────────────────────────────────────────
    await knex.schema.createTable('academy_academies', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.string('name', 255).notNullable();
        t.uuid('owner_user_id'); // FK added after auth_users
        t.text('logo_url');
        t.jsonb('settings').defaultTo('{}');
        t.timestamps(true, true);
        t.timestamp('deleted_at');
    });

    // ─── branches ─────────────────────────────────────────────────────
    await knex.schema.createTable('academy_branches', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
        t.string('name', 255).notNullable();
        t.text('address');
        t.specificType('location', 'point');
        t.timestamps(true, true);
        t.timestamp('deleted_at');
        t.index('academy_id');
    });

    // ─── birth years ──────────────────────────────────────────────────
    await knex.schema.createTable('academy_birth_years', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('branch_id').notNullable().references('id').inTable('academy_branches').onDelete('CASCADE');
        t.smallint('year').notNullable();
        t.string('label', 100);
        t.timestamps(true, true);
        t.index('branch_id');
        t.unique(['branch_id', 'year']);
    });

    // ─── groups ───────────────────────────────────────────────────────
    await knex.schema.createTable('academy_groups', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('birth_year_id').notNullable().references('id').inTable('academy_birth_years').onDelete('CASCADE');
        t.string('name', 255).notNullable();
        t.smallint('max_players').defaultTo(25);
        t.timestamps(true, true);
        t.timestamp('deleted_at');
        t.index('birth_year_id');
    });

    // ─── schedules ────────────────────────────────────────────────────
    await knex.schema.createTable('academy_schedules', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
        t.smallint('day_of_week').notNullable(); // 0=Sun … 6=Sat
        t.time('start_time').notNullable();
        t.time('end_time').notNullable();
        t.string('location', 255);
        t.index('group_id');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('academy_schedules');
    await knex.schema.dropTableIfExists('academy_groups');
    await knex.schema.dropTableIfExists('academy_birth_years');
    await knex.schema.dropTableIfExists('academy_branches');
    await knex.schema.dropTableIfExists('academy_academies');
};
