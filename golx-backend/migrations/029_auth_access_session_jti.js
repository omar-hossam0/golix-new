/**
 * Auth session hardening for the legacy auth_users flow.
 *
 * The IAM session tables are the long-term target, but the current runtime
 * still authenticates against auth_users. This migration makes every issued
 * access token revocable today by binding its JWT jti to the refresh-token
 * session row.
 */
exports.up = async function up(knex) {
    await knex.schema.alterTable('auth_refresh_tokens', (t) => {
        t.uuid('access_jti').unique();
        t.specificType('ip_address', 'inet');
        t.text('user_agent');
        t.timestamp('last_seen_at');
        t.string('revoke_reason', 60);
    });

    await knex.schema.alterTable('audit_logs', (t) => {
        t.uuid('session_jti');
    });

    await knex.raw(`
        CREATE INDEX auth_refresh_tokens_access_active
          ON auth_refresh_tokens (access_jti)
          WHERE is_revoked = false;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS auth_refresh_tokens_access_active;');
    await knex.schema.alterTable('audit_logs', (t) => {
        t.dropColumn('session_jti');
    });
    await knex.schema.alterTable('auth_refresh_tokens', (t) => {
        t.dropColumn('access_jti');
        t.dropColumn('ip_address');
        t.dropColumn('user_agent');
        t.dropColumn('last_seen_at');
        t.dropColumn('revoke_reason');
    });
};
