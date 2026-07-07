const BaseRepository = require('../../shared/base.repository');

class AuthRepository extends BaseRepository {
    constructor(db) {
        super('auth_users', db);
    }

    async findByEmail(email) {
        return this.db('auth_users')
            .where({ email })
            .whereNull('deleted_at')
            .first();
    }

    async findByPhone(phone) {
        return this.db('auth_users')
            .where({ phone })
            .whereNull('deleted_at')
            .first();
    }

    async findByUsername(username) {
        return this.db('auth_users')
            .where({ username })
            .whereNull('deleted_at')
            .first();
    }

    async findByEmailOrPhone(email, phone) {
        return this.findByEmailPhoneOrUsername(email, phone);
    }

    async findByEmailPhoneOrUsername(email, phone, username) {
        return this.db('auth_users')
            .whereNull('deleted_at')
            .where(function () {
                let hasCondition = false;
                const addCondition = (column, value) => {
                    if (!value) return;
                    if (hasCondition) this.orWhere(column, value);
                    else this.where(column, value);
                    hasCondition = true;
                };
                addCondition('email', email);
                addCondition('phone', phone);
                addCondition('username', username);
            })
            .first();
    }

    async findPlayerById(playerId) {
        return this.db('player_profiles')
            .where({ id: playerId })
            .whereNull('deleted_at')
            .first();
    }

    async findCoachProfileByUserId(userId) {
        return this.db('coach_profiles')
            .where({ user_id: userId })
            .whereNull('deleted_at')
            .first();
    }

    async findActiveAdminAccount(userId) {
        try {
            return await this.db('admin_accounts')
                .where({ user_id: userId, is_active: true })
                .whereNull('deleted_at')
                .first();
        } catch (err) {
            if (err.code === '42P01') return null;
            throw err;
        }
    }

    async updateLastLogin(userId, loggedInAt = new Date()) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({ last_login_at: loggedInAt });
    }

    // --- Refresh tokens (owned by auth module) ---

    async createRefreshToken(data) {
        const [row] = await this.db('auth_refresh_tokens').insert(data).returning('*');
        return row;
    }

    async findActiveAccessSession(userId, accessJti) {
        return this.db('auth_refresh_tokens')
            .where({
                user_id: userId,
                access_jti: accessJti,
                is_revoked: false,
            })
            .where('expires_at', '>', new Date())
            .first();
    }

    async touchAccessSession(id) {
        return this.db('auth_refresh_tokens')
            .where({ id, is_revoked: false })
            .update({ last_seen_at: new Date() });
    }

    async findRefreshTokenByHash(tokenHash) {
        return this.db('auth_refresh_tokens')
            .where({ token_hash: tokenHash, is_revoked: false })
            .where('expires_at', '>', new Date())
            .first();
    }

    async revokeRefreshToken(id) {
        return this.db('auth_refresh_tokens')
            .where({ id })
            .update({ is_revoked: true, revoke_reason: 'rotation' });
    }

    async revokeAccessSessionByJti(userId, accessJti, reason = 'logout') {
        if (!accessJti) return 0;
        return this.db('auth_refresh_tokens')
            .where({ user_id: userId, access_jti: accessJti, is_revoked: false })
            .update({ is_revoked: true, revoke_reason: reason });
    }

    async revokeAllUserTokens(userId) {
        return this.db('auth_refresh_tokens')
            .where({ user_id: userId, is_revoked: false })
            .update({ is_revoked: true, revoke_reason: 'logout_all' });
    }

    // --- MFA login challenges (PostgreSQL fallback when Redis is unavailable) ---

    async createMfaChallenge(challengeId, userId, expiresAt) {
        const now = new Date();
        await this.db('auth_mfa_challenges')
            .where('expires_at', '<=', now)
            .del();

        const [row] = await this.db('auth_mfa_challenges')
            .insert({
                id: challengeId,
                user_id: userId,
                expires_at: expiresAt,
            })
            .returning('*');
        return row;
    }

    async consumeMfaChallenge(challengeId, userId) {
        const [row] = await this.db('auth_mfa_challenges')
            .where({
                id: challengeId,
                user_id: userId,
            })
            .whereNull('consumed_at')
            .where('expires_at', '>', new Date())
            .update({
                consumed_at: new Date(),
                updated_at: new Date(),
            })
            .returning('user_id');
        return row?.user_id || null;
    }

    // --- Password reset tokens (owned by auth module) ---

    async createPasswordReset(data) {
        const [row] = await this.db('auth_password_resets').insert(data).returning('*');
        return row;
    }

    async findValidPasswordReset(tokenHash) {
        return this.db('auth_password_resets')
            .where({ token_hash: tokenHash, is_used: false })
            .where('expires_at', '>', new Date())
            .first();
    }

    async markPasswordResetUsed(id) {
        return this.db('auth_password_resets')
            .where({ id })
            .update({ is_used: true });
    }

    // --- Audit logs (owned by auth module) ---

    async createAuditLog(data) {
        const [row] = await this.db('audit_logs').insert(data).returning('*');
        return row;
    }

    // --- Account Lockout ---

    async incrementFailedAttempts(userId) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({
                failed_login_attempts: this.db.raw('COALESCE(failed_login_attempts, 0) + 1'),
                last_failed_login_at: new Date(),
            });
    }

    async lockAccount(userId, lockedUntil) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({ locked_until: lockedUntil });
    }

    async resetFailedAttempts(userId) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({
                failed_login_attempts: 0,
                locked_until: null,
                last_failed_login_at: null,
            });
    }

    // --- TOTP 2FA ---

    async setTotpSecret(userId, secret) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({ totp_secret: secret });
    }

    async enableTotp(userId) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({
                totp_enabled: true,
                totp_verified_at: new Date(),
            });
    }

    async disableTotp(userId) {
        return this.db('auth_users')
            .where({ id: userId })
            .update({
                totp_enabled: false,
                totp_secret: null,
                totp_verified_at: null,
            });
    }

    async createTotpDevice(userId, { deviceName, secret, status = 'pending', isPrimary = false }) {
        const [row] = await this.db('auth_totp_devices')
            .insert({
                user_id: userId,
                device_name: deviceName || 'Authenticator app',
                secret,
                status,
                is_primary: isPrimary,
                verified_at: status === 'active' ? new Date() : null,
            })
            .returning('*');
        return row;
    }

    async findTotpDeviceById(userId, deviceId) {
        return this.db('auth_totp_devices')
            .where({ id: deviceId, user_id: userId })
            .whereNull('revoked_at')
            .first();
    }

    async findActiveTotpDevices(userId) {
        return this.db('auth_totp_devices')
            .where({ user_id: userId, status: 'active' })
            .whereNull('revoked_at')
            .orderBy('created_at', 'asc');
    }

    async activateTotpDevice(userId, deviceId) {
        const [row] = await this.db('auth_totp_devices')
            .where({ id: deviceId, user_id: userId, status: 'pending' })
            .whereNull('revoked_at')
            .update({
                status: 'active',
                verified_at: new Date(),
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async touchTotpDevice(id) {
        return this.db('auth_totp_devices')
            .where({ id })
            .update({ last_used_at: new Date(), updated_at: new Date() });
    }

    async revokeTotpDevice(userId, deviceId) {
        const [row] = await this.db('auth_totp_devices')
            .where({ id: deviceId, user_id: userId })
            .whereNull('revoked_at')
            .update({
                status: 'revoked',
                is_primary: false,
                revoked_at: new Date(),
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async setPrimaryTotpDevice(userId, deviceId) {
        return this.db.transaction(async (trx) => {
            await trx('auth_totp_devices')
                .where({ user_id: userId })
                .whereNull('revoked_at')
                .update({ is_primary: false, updated_at: new Date() });

            const [row] = await trx('auth_totp_devices')
                .where({ id: deviceId, user_id: userId, status: 'active' })
                .whereNull('revoked_at')
                .update({ is_primary: true, updated_at: new Date() })
                .returning('*');

            return row;
        });
    }

    async deletePendingTotpDevices(userId) {
        return this.db('auth_totp_devices')
            .where({ user_id: userId, status: 'pending' })
            .del();
    }

    async createBackupCodes(userId, codeHashes) {
        const rows = codeHashes.map((hash) => ({
            user_id: userId,
            code_hash: hash,
            is_used: false,
        }));
        return this.db('auth_totp_backup_codes').insert(rows).returning('*');
    }

    async findUnusedBackupCode(userId, codeHash) {
        return this.db('auth_totp_backup_codes')
            .where({ user_id: userId, code_hash: codeHash, is_used: false })
            .first();
    }

    async markBackupCodeUsed(id) {
        return this.db('auth_totp_backup_codes')
            .where({ id })
            .update({ is_used: true, used_at: new Date() });
    }

    async consumeUnusedBackupCode(userId, codeHashes) {
        const hashes = [...new Set((codeHashes || []).filter(Boolean))];
        if (!hashes.length) return null;

        const [row] = await this.db('auth_totp_backup_codes')
            .where({ user_id: userId, is_used: false })
            .whereIn('code_hash', hashes)
            .update({
                is_used: true,
                used_at: new Date(),
                updated_at: new Date(),
            })
            .returning('*');
        return row || null;
    }

    async deleteBackupCodes(userId) {
        return this.db('auth_totp_backup_codes')
            .where({ user_id: userId })
            .del();
    }

    // --- Pending Registrations ---

    async createPendingRegistration(data) {
        const [row] = await this.db('pending_registrations').insert(data).returning('*');
        return row;
    }

    async findLatestPendingByEmail(email) {
        return this.db('pending_registrations')
            .where({ email })
            .orderBy('created_at', 'desc')
            .first();
    }

    async findPendingById(id) {
        return this.db('pending_registrations').where({ id }).first();
    }
}

module.exports = AuthRepository;
