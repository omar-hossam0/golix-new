/**
 * Separate privileged admin plane.
 *
 * A user row alone is no longer enough to act as an admin. Admin access must
 * also have an active admin_accounts row, which can be disabled independently
 * from the normal user identity.
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('admin_accounts', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().unique().references('id').inTable('auth_users').onDelete('CASCADE');
        t.uuid('academy_id').references('id').inTable('academy_academies').onDelete('CASCADE');
        t.enum('admin_type', ['platform_admin', 'academy_admin'], {
            useNative: true,
            enumName: 'admin_account_type',
        }).notNullable().defaultTo('academy_admin');
        t.boolean('is_active').notNullable().defaultTo(true);
        t.timestamp('disabled_at');
        t.uuid('disabled_by');
        t.text('disabled_reason');
        t.timestamps(true, true);
        t.timestamp('deleted_at');
        t.index(['academy_id', 'is_active']);
    });

    await knex.raw(`
        INSERT INTO admin_accounts (user_id, academy_id, admin_type, is_active)
        SELECT id, academy_id, 'academy_admin', true
        FROM auth_users
        WHERE role = 'admin' AND deleted_at IS NULL
        ON CONFLICT (user_id) DO NOTHING;
    `);
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('admin_accounts');
    await knex.raw('DROP TYPE IF EXISTS admin_account_type');
};
