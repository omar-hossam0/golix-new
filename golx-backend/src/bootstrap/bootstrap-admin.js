const bcrypt = require('bcrypt');

const { ensureIamForAuthUser } = require('../shared/iam-sync');

const DEFAULT_ADMIN_EMAIL = 'admin@goalix.com';
const DEFAULT_ACADEMY_NAME = 'Goalix Academy';

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function optionalText(value) {
    const trimmed = String(value || '').trim();
    return trimmed || null;
}

function assertStrongBootstrapPassword(password) {
    if (!password || password.length < 12) {
        throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        throw new Error('BOOTSTRAP_ADMIN_PASSWORD must include uppercase, number, and special character.');
    }
}

async function hasColumn(trx, tableName, columnName) {
    try {
        return await trx.schema.hasColumn(tableName, columnName);
    } catch (err) {
        if (err.code === '42P01') return false;
        throw err;
    }
}

async function upsertAcademy(trx, options) {
    const academyName = optionalText(options.academyName) || DEFAULT_ACADEMY_NAME;
    const existing = await trx('academy_academies')
        .whereNull('deleted_at')
        .orderBy('created_at', 'asc')
        .first();

    if (existing) return existing;

    const insertData = {
        name: academyName,
        settings: JSON.stringify({
            weekStartsOn: 'saturday',
            bootstrap: {
                createdBy: 'bootstrap-admin',
                createdAt: new Date().toISOString(),
            },
        }),
    };

    if (await hasColumn(trx, 'academy_academies', 'email')) {
        insertData.email = optionalText(options.academyEmail);
    }
    if (await hasColumn(trx, 'academy_academies', 'phone')) {
        insertData.phone = optionalText(options.academyPhone);
    }
    if (await hasColumn(trx, 'academy_academies', 'address')) {
        insertData.address = optionalText(options.academyAddress);
    }

    const [academy] = await trx('academy_academies').insert(insertData).returning('*');
    return academy;
}

async function assertBootstrapIsAllowed(trx, targetEmail, allowExisting) {
    const activeAdmins = await trx('auth_users')
        .where({ role: 'admin' })
        .whereNull('deleted_at')
        .where(function () {
            this.where({ is_active: true }).orWhereNull('is_active');
        })
        .select('id', 'email');

    const otherAdmins = activeAdmins.filter((admin) => normalizeEmail(admin.email) !== targetEmail);
    if (otherAdmins.length > 0 && !allowExisting) {
        throw new Error(
            'Active admin accounts already exist. Refusing bootstrap unless BOOTSTRAP_ADMIN_ALLOW_EXISTING=true.',
        );
    }
}

async function upsertAdminUser(trx, academy, options) {
    const email = normalizeEmail(options.email || DEFAULT_ADMIN_EMAIL);
    const username = optionalText(options.username) || 'admin';
    const fullName = optionalText(options.fullName) || 'Goalix Admin';
    const passwordHash = await bcrypt.hash(options.password, 12);

    const existing = await trx('auth_users')
        .whereRaw('lower(email) = lower(?)', [email])
        .orWhere(function () {
            if (username) this.whereRaw('lower(username) = lower(?)', [username]);
        })
        .first();

    const data = {
        email,
        username,
        password_hash: passwordHash,
        role: 'admin',
        academy_id: academy.id,
        is_active: true,
        is_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_failed_login_at: null,
        deleted_at: null,
        updated_at: trx.fn.now(),
    };

    if (existing) {
        const [updated] = await trx('auth_users')
            .where({ id: existing.id })
            .update(data)
            .returning('*');
        return { user: updated, created: false, fullName };
    }

    const [inserted] = await trx('auth_users')
        .insert({
            ...data,
            created_at: trx.fn.now(),
        })
        .returning('*');
    return { user: inserted, created: true, fullName };
}

async function setAcademyOwner(trx, academyId, adminUserId) {
    if (!await hasColumn(trx, 'academy_academies', 'owner_user_id')) return;
    await trx('academy_academies')
        .where({ id: academyId })
        .update({ owner_user_id: adminUserId, updated_at: trx.fn.now() });
}

async function writeAuditLog(trx, adminUser, academyId, created) {
    const hasAuditLogs = await trx.schema.hasTable('audit_logs');
    if (!hasAuditLogs) return;

    await trx('audit_logs').insert({
        user_id: adminUser.id,
        action: created ? 'bootstrap_admin_created' : 'bootstrap_admin_updated',
        table_name: 'auth_users',
        record_id: adminUser.id,
        new_data: JSON.stringify({
            email: adminUser.email,
            username: adminUser.username || null,
            role: 'admin',
            academyId,
        }),
        metadata: JSON.stringify({ source: 'bootstrap-admin' }),
    });
}

async function ensureIamCatalog(knex) {
    const seed = require('../../seeds/02_iam_permissions_and_roles');
    await seed.seed(knex);
}

async function bootstrapAdmin(knex, options = {}) {
    const config = {
        email: normalizeEmail(options.email || process.env.BOOTSTRAP_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL),
        username: optionalText(options.username || process.env.BOOTSTRAP_ADMIN_USERNAME) || 'admin',
        password: options.password || process.env.BOOTSTRAP_ADMIN_PASSWORD,
        fullName: optionalText(options.fullName || process.env.BOOTSTRAP_ADMIN_FULL_NAME) || 'Goalix Admin',
        academyName: optionalText(options.academyName || process.env.BOOTSTRAP_ACADEMY_NAME) || DEFAULT_ACADEMY_NAME,
        academyEmail: optionalText(options.academyEmail || process.env.BOOTSTRAP_ACADEMY_EMAIL),
        academyPhone: optionalText(options.academyPhone || process.env.BOOTSTRAP_ACADEMY_PHONE),
        academyAddress: optionalText(options.academyAddress || process.env.BOOTSTRAP_ACADEMY_ADDRESS),
        allowExisting: options.allowExisting || process.env.BOOTSTRAP_ADMIN_ALLOW_EXISTING === 'true',
    };

    if (!config.email) throw new Error('BOOTSTRAP_ADMIN_EMAIL is required.');
    assertStrongBootstrapPassword(config.password);

    await ensureIamCatalog(knex);

    return knex.transaction(async (trx) => {
        await assertBootstrapIsAllowed(trx, config.email, config.allowExisting);
        const academy = await upsertAcademy(trx, config);
        const { user, created, fullName } = await upsertAdminUser(trx, academy, config);

        await ensureIamForAuthUser(trx, user, {
            fullName,
            jobTitle: 'Academy Owner',
            department: 'Administration',
            roleCode: 'academy_owner',
            grantedBy: user.id,
        });
        await setAcademyOwner(trx, academy.id, user.id);
        await writeAuditLog(trx, user, academy.id, created);

        return {
            admin: {
                id: user.id,
                email: user.email,
                username: user.username || null,
                created,
                mfaSetupRequired: !user.totp_enabled,
            },
            academy: {
                id: academy.id,
                name: academy.name,
            },
        };
    });
}

module.exports = {
    bootstrapAdmin,
};
