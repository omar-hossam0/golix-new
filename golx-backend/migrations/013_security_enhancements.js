/**
 * Security enhancements:
 *   - auth_users: add 2FA fields + account lockout fields
 *   - auth_totp_backup_codes: backup recovery codes for 2FA
 *   - enhanced audit_logs: add user_agent column
 */
exports.up = async function (knex) {
    // ─── Add 2FA + lockout columns to auth_users ─────────────────────
    await knex.schema.alterTable('auth_users', (t) => {
        // 2FA
        t.text('totp_secret').nullable();
        t.boolean('totp_enabled').defaultTo(false);
        t.timestamp('totp_verified_at').nullable();

        // Account lockout
        t.integer('failed_login_attempts').defaultTo(0);
        t.timestamp('locked_until').nullable();
        t.timestamp('last_failed_login_at').nullable();

    });

    // ─── TOTP backup codes ───────────────────────────────────────────
    await knex.schema.createTable('auth_totp_backup_codes', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.text('code_hash').notNullable();
        t.boolean('is_used').defaultTo(false);
        t.timestamp('used_at').nullable();
        t.timestamps(true, true);
        t.index('user_id');
    });

    // ─── Add user_agent to audit_logs ────────────────────────────────
    await knex.schema.alterTable('audit_logs', (t) => {
        t.text('user_agent').nullable();
        t.jsonb('metadata').nullable();
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('audit_logs', (t) => {
        t.dropColumn('user_agent');
        t.dropColumn('metadata');
    });

    await knex.schema.dropTableIfExists('auth_totp_backup_codes');

    await knex.schema.alterTable('auth_users', (t) => {
        t.dropColumn('totp_secret');
        t.dropColumn('totp_enabled');
        t.dropColumn('totp_verified_at');
        t.dropColumn('failed_login_attempts');
        t.dropColumn('locked_until');
        t.dropColumn('last_failed_login_at');
    });
};
