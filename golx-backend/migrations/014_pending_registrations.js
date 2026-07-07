/**
 * Migration 014: Pending Registrations
 * - pending_registrations table for signup approval workflow
 * - linked_player_id on auth_users for parent accounts
 */
exports.up = async function (knex) {
    // Enum for registration status
    await knex.raw(`CREATE TYPE pending_reg_status AS ENUM ('pending', 'approved', 'rejected')`);
    await knex.raw(`CREATE TYPE pending_reg_role AS ENUM ('player', 'parent')`);

    await knex.schema.createTable('pending_registrations', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.string('email', 255);
        t.string('phone', 30);
        t.text('password_hash').notNullable();
        t.string('full_name', 255).notNullable();
        // player or parent only — coaches/admins are created by admin directly
        t.specificType('role', 'pending_reg_role').notNullable();
        t.uuid('academy_id').references('id').inTable('academy_academies').onDelete('SET NULL');
        // For parent signups: which player profile they want to link to
        t.uuid('linked_player_id').references('id').inTable('player_profiles').onDelete('SET NULL');
        t.specificType('status', 'pending_reg_status').notNullable().defaultTo('pending');
        t.text('rejection_reason');
        t.uuid('reviewed_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.timestamp('reviewed_at');
        t.timestamps(true, true);
        t.index('email');
        t.index('status');
    });

    // Add linked_player_id to auth_users for approved parent accounts
    await knex.schema.alterTable('auth_users', (t) => {
        t.uuid('linked_player_id').references('id').inTable('player_profiles').onDelete('SET NULL');
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('auth_users', (t) => {
        t.dropColumn('linked_player_id');
    });
    await knex.schema.dropTableIfExists('pending_registrations');
    await knex.raw('DROP TYPE IF EXISTS pending_reg_status');
    await knex.raw('DROP TYPE IF EXISTS pending_reg_role');
};
