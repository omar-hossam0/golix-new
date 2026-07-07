/**
 * Admin profile metadata and legacy auth -> IAM backfill.
 *
 * This keeps auth_users as the authentication source while IAM gradually takes
 * over authorization. The legacy auth_users.role column is intentionally kept.
 */
exports.up = async function up(knex) {
    const hasAdminProfiles = await knex.schema.hasTable('admin_profiles');
    if (!hasAdminProfiles) {
        await knex.schema.createTable('admin_profiles', (t) => {
            t.uuid('user_id')
                .primary()
                .references('id')
                .inTable('auth_users')
                .onDelete('CASCADE');
            t.string('job_title', 120);
            t.string('department', 120);
            t.timestamps(true, true);
        });

        await knex.raw(`
            CREATE TRIGGER set_updated_at
              BEFORE UPDATE ON admin_profiles
              FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
        `);
    }

    await knex.raw(`
        INSERT INTO iam_users (
            id, email, username, phone, password_hash, full_name,
            is_active, is_verified, totp_enabled, totp_secret, totp_verified_at,
            failed_login_attempts, last_failed_login_at, locked_until,
            last_login_at, created_at, updated_at
        )
        SELECT
            id,
            email,
            username,
            phone,
            password_hash,
            COALESCE(NULLIF(username, ''), email, phone, role::text || ' account'),
            COALESCE(is_active, true),
            COALESCE(is_verified, false),
            COALESCE(totp_enabled, false),
            totp_secret,
            totp_verified_at,
            COALESCE(failed_login_attempts, 0),
            last_failed_login_at,
            locked_until,
            last_login_at,
            created_at,
            now()
        FROM auth_users
        WHERE deleted_at IS NULL
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            username = EXCLUDED.username,
            phone = EXCLUDED.phone,
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            is_active = EXCLUDED.is_active,
            is_verified = EXCLUDED.is_verified,
            totp_enabled = EXCLUDED.totp_enabled,
            totp_secret = EXCLUDED.totp_secret,
            totp_verified_at = EXCLUDED.totp_verified_at,
            failed_login_attempts = EXCLUDED.failed_login_attempts,
            last_failed_login_at = EXCLUDED.last_failed_login_at,
            locked_until = EXCLUDED.locked_until,
            last_login_at = EXCLUDED.last_login_at,
            updated_at = now();
    `);

    await knex.raw(`
        INSERT INTO iam_user_academies (user_id, academy_id, branch_id, status)
        SELECT id, academy_id, branch_id, 'active'
        FROM auth_users
        WHERE academy_id IS NOT NULL AND deleted_at IS NULL
        ON CONFLICT (user_id, academy_id) DO UPDATE SET
            branch_id = EXCLUDED.branch_id,
            status = 'active',
            revoked_at = NULL,
            revoke_reason = NULL,
            updated_at = now();
    `);

    await knex.raw(`
        INSERT INTO admin_accounts (user_id, academy_id, admin_type, is_active)
        SELECT
            id,
            academy_id,
            CASE WHEN academy_id IS NULL THEN 'platform_admin'::admin_account_type ELSE 'academy_admin'::admin_account_type END,
            true
        FROM auth_users
        WHERE role = 'admin' AND deleted_at IS NULL
        ON CONFLICT (user_id) DO UPDATE SET
            academy_id = EXCLUDED.academy_id,
            is_active = true,
            disabled_at = NULL,
            disabled_reason = NULL,
            updated_at = now();
    `);

    await knex.raw(`
        INSERT INTO admin_profiles (user_id, job_title, department)
        SELECT id, 'Administrator', 'Operations'
        FROM auth_users
        WHERE role = 'admin' AND deleted_at IS NULL
        ON CONFLICT (user_id) DO NOTHING;
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP TRIGGER IF EXISTS set_updated_at ON admin_profiles;');
    await knex.schema.dropTableIfExists('admin_profiles');
};
