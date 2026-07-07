const LEGACY_ROLE_TO_SYSTEM_ROLE = {
    admin: 'academy_owner',
    coach: 'head_coach',
    player: 'player',
    parent: 'parent',
};

async function hasTable(dbOrTrx, tableName) {
    try {
        return await dbOrTrx.schema.hasTable(tableName);
    } catch (err) {
        if (err.code === '42P01') return false;
        throw err;
    }
}

async function ensureIamForAuthUser(dbOrTrx, authUser, options = {}) {
    if (!authUser?.id) return;
    if (!await hasTable(dbOrTrx, 'iam_users')) return;

    const fullName = authUser.full_name
        || options.fullName
        || authUser.username
        || authUser.email
        || authUser.phone
        || `${authUser.role || 'user'} account`;

    const profileFields = {};
    if (options.address !== undefined) profileFields.address = options.address || null;
    if (options.jobTitle !== undefined) profileFields.job_title = options.jobTitle || null;
    if (options.department !== undefined) profileFields.department = options.department || null;
    if (options.notes !== undefined) profileFields.notes = options.notes || null;

    await dbOrTrx('iam_users')
        .insert({
            id: authUser.id,
            email: authUser.email || null,
            username: authUser.username || null,
            phone: authUser.phone || null,
            password_hash: authUser.password_hash,
            full_name: fullName,
            is_active: authUser.is_active !== false,
            is_verified: Boolean(authUser.is_verified),
            totp_enabled: Boolean(authUser.totp_enabled),
            totp_secret: authUser.totp_secret || null,
            totp_verified_at: authUser.totp_verified_at || null,
            failed_login_attempts: authUser.failed_login_attempts || 0,
            last_failed_login_at: authUser.last_failed_login_at || null,
            locked_until: authUser.locked_until || null,
            last_login_at: authUser.last_login_at || null,
            created_at: authUser.created_at || dbOrTrx.fn.now(),
            updated_at: dbOrTrx.fn.now(),
            ...profileFields,
        })
        .onConflict('id')
        .merge({
            email: authUser.email || null,
            username: authUser.username || null,
            phone: authUser.phone || null,
            password_hash: authUser.password_hash,
            full_name: fullName,
            is_active: authUser.is_active !== false,
            is_verified: Boolean(authUser.is_verified),
            totp_enabled: Boolean(authUser.totp_enabled),
            totp_secret: authUser.totp_secret || null,
            totp_verified_at: authUser.totp_verified_at || null,
            failed_login_attempts: authUser.failed_login_attempts || 0,
            last_failed_login_at: authUser.last_failed_login_at || null,
            locked_until: authUser.locked_until || null,
            last_login_at: authUser.last_login_at || null,
            updated_at: dbOrTrx.fn.now(),
            ...profileFields,
        });

    if (authUser.academy_id && await hasTable(dbOrTrx, 'iam_user_academies')) {
        await dbOrTrx('iam_user_academies')
            .insert({
                user_id: authUser.id,
                academy_id: authUser.academy_id,
                branch_id: authUser.branch_id || null,
                status: 'active',
            })
            .onConflict(['user_id', 'academy_id'])
            .merge({
                branch_id: authUser.branch_id || null,
                status: 'active',
                revoked_at: null,
                revoke_reason: null,
                updated_at: dbOrTrx.fn.now(),
            });
    }

    if (!options.skipDefaultRole && authUser.academy_id && await hasTable(dbOrTrx, 'iam_roles') && await hasTable(dbOrTrx, 'iam_user_roles')) {
        const roleCode = options.roleCode || LEGACY_ROLE_TO_SYSTEM_ROLE[authUser.role];
        const role = roleCode
            ? await dbOrTrx('iam_roles')
                .where({ code: roleCode, is_system: true, is_active: true })
                .whereNull('academy_id')
                .whereNull('deleted_at')
                .first('id')
            : null;

        if (role) {
            const existing = await dbOrTrx('iam_user_roles')
                .where({
                    user_id: authUser.id,
                    role_id: role.id,
                    academy_id: authUser.academy_id,
                })
                .whereNull('scope_branch_id')
                .whereNull('scope_group_id')
                .whereNull('revoked_at')
                .first('id');

            if (existing) {
                await dbOrTrx('iam_user_roles')
                    .where({ id: existing.id })
                    .update({
                        expires_at: null,
                        revoked_at: null,
                        revoke_reason: null,
                        updated_at: dbOrTrx.fn.now(),
                    });
            } else {
                await dbOrTrx('iam_user_roles').insert({
                    user_id: authUser.id,
                    role_id: role.id,
                    academy_id: authUser.academy_id,
                    granted_by: options.grantedBy || null,
                });
            }
        }
    }

    if (authUser.role === 'admin' && await hasTable(dbOrTrx, 'admin_accounts')) {
        await dbOrTrx('admin_accounts')
            .insert({
                user_id: authUser.id,
                academy_id: authUser.academy_id || null,
                admin_type: authUser.academy_id ? 'academy_admin' : 'platform_admin',
                is_active: true,
            })
            .onConflict('user_id')
            .merge({
                academy_id: authUser.academy_id || null,
                is_active: true,
                disabled_at: null,
                disabled_reason: null,
                updated_at: dbOrTrx.fn.now(),
            });
    }

    if (authUser.role === 'admin' && await hasTable(dbOrTrx, 'admin_profiles')) {
        await dbOrTrx('admin_profiles')
            .insert({
                user_id: authUser.id,
                job_title: options.jobTitle || 'Administrator',
                department: options.department || 'Operations',
            })
            .onConflict('user_id')
            .merge({
                job_title: options.jobTitle || 'Administrator',
                department: options.department || 'Operations',
                updated_at: dbOrTrx.fn.now(),
            });
    }
}

module.exports = {
    LEGACY_ROLE_TO_SYSTEM_ROLE,
    ensureIamForAuthUser,
};
