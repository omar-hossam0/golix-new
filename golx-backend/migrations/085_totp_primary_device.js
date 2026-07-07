exports.up = async function up(knex) {
    await knex.schema.alterTable('auth_totp_devices', (t) => {
        t.boolean('is_primary').notNullable().defaultTo(false);
    });

    await knex.raw(`
        WITH ranked_devices AS (
            SELECT
                d.id,
                ROW_NUMBER() OVER (
                    PARTITION BY d.user_id
                    ORDER BY
                        CASE WHEN d.revoked_at IS NULL AND d.status = 'active' THEN 0 ELSE 1 END,
                        d.created_at DESC
                ) AS rn
            FROM auth_totp_devices d
        )
        UPDATE auth_totp_devices d
        SET is_primary = true
        FROM ranked_devices r
        WHERE d.id = r.id
          AND r.rn = 1
    `);

    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS auth_totp_devices_one_primary_active_idx
        ON auth_totp_devices (user_id)
        WHERE is_primary = true AND revoked_at IS NULL
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS auth_totp_devices_one_primary_active_idx');
    await knex.schema.alterTable('auth_totp_devices', (t) => {
        t.dropColumn('is_primary');
    });
};
