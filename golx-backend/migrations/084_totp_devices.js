exports.up = async function up(knex) {
    await knex.schema.createTable('auth_totp_devices', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.string('device_name', 120).notNullable().defaultTo('Authenticator app');
        t.text('secret').notNullable();
        t.string('status', 20).notNullable().defaultTo('pending');
        t.timestamp('verified_at').nullable();
        t.timestamp('last_used_at').nullable();
        t.timestamp('revoked_at').nullable();
        t.timestamps(true, true);
        t.index(['user_id', 'status']);
    });

    await knex.raw(`
        INSERT INTO auth_totp_devices
            (user_id, device_name, secret, status, verified_at, created_at, updated_at)
        SELECT
            id,
            'Primary device',
            totp_secret,
            'active',
            totp_verified_at,
            COALESCE(totp_verified_at, created_at, NOW()),
            NOW()
        FROM auth_users
        WHERE totp_enabled = true
          AND totp_secret IS NOT NULL
          AND deleted_at IS NULL
    `);
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('auth_totp_devices');
};
