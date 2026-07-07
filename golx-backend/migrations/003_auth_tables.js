/**
 * Auth module tables:
 *   auth_users, auth_refresh_tokens, auth_password_resets
 */
exports.up = async function (knex) {
    // ─── users ────────────────────────────────────────────────────────
    await knex.schema.createTable('auth_users', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.string('email', 255).unique();
        t.string('phone', 30).unique();
        t.text('password_hash').notNullable();
        t.enum('role', ['admin', 'coach', 'player', 'parent'], {
            useNative: true,
            enumName: 'user_role',
        }).notNullable().defaultTo('player');
        t.uuid('academy_id').references('id').inTable('academy_academies').onDelete('SET NULL');
        t.uuid('branch_id').references('id').inTable('academy_branches').onDelete('SET NULL');
        t.boolean('is_active').defaultTo(true);
        t.timestamp('last_login_at');
        t.timestamps(true, true);
        t.timestamp('deleted_at');
        t.index('academy_id');
        t.index('role');
    });

    // back-fill FK on academies
    await knex.schema.alterTable('academy_academies', (t) => {
        t.foreign('owner_user_id').references('id').inTable('auth_users').onDelete('SET NULL');
    });

    // ─── refresh tokens ───────────────────────────────────────────────
    await knex.schema.createTable('auth_refresh_tokens', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.text('token_hash').notNullable().unique();
        t.timestamp('expires_at').notNullable();
        t.boolean('is_revoked').defaultTo(false);
        t.timestamps(true, true);
        t.index('user_id');
        t.index('expires_at');
    });

    // ─── password resets ──────────────────────────────────────────────
    await knex.schema.createTable('auth_password_resets', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.text('token_hash').notNullable().unique();
        t.timestamp('expires_at').notNullable();
        t.boolean('is_used').defaultTo(false);
        t.timestamps(true, true);
        t.index('user_id');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('auth_password_resets');
    await knex.schema.dropTableIfExists('auth_refresh_tokens');

    // Drop FK on academies first
    await knex.schema.alterTable('academy_academies', (t) => {
        t.dropForeign('owner_user_id');
    });

    await knex.schema.dropTableIfExists('auth_users');
    await knex.raw('DROP TYPE IF EXISTS user_role');
};
