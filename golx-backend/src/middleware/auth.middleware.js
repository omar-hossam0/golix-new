const env = require('../config/env');
const db = require('../infrastructure/database');
const { redis } = require('../infrastructure/redis');
const { UnauthorizedError } = require('../shared/errors');
const { createAbility } = require('../shared/authorization');
const logger = require('../shared/logger');
const {
    cacheActiveSession,
    getCachedSession,
    markSessionSeen,
} = require('../shared/auth-session-cache');
const { verifyAccessToken } = require('../shared/jwt');

const readAccessToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return req.cookies?.accessToken || null;
};

const assertActiveAccessSession = async (decoded) => {
    if (!decoded.jti) {
        throw new UnauthorizedError('Session missing');
    }

    let cachedSession = null;
    try {
        cachedSession = await getCachedSession(redis, decoded.userId, decoded.jti);
    } catch {
        // Redis is an optimization. PostgreSQL remains the source of truth.
    }

    if (cachedSession) {
        try {
            if (await markSessionSeen(redis, decoded, cachedSession)) {
                db('auth_refresh_tokens')
                    .where({ id: cachedSession.sessionId, is_revoked: false })
                    .update({ last_seen_at: new Date() })
                    .catch((err) => logger.warn(
                        { err, sessionId: cachedSession.sessionId },
                        'Failed to update throttled session activity',
                    ));
            }
        } catch {
            // Activity tracking must never block an otherwise valid request.
        }
        return;
    }

    const session = await db('auth_refresh_tokens')
        .where({
            user_id: decoded.userId,
            access_jti: decoded.jti,
            is_revoked: false,
        })
        .where('expires_at', '>', new Date())
        .first('id', 'expires_at', 'last_seen_at');

    if (!session) {
        throw new UnauthorizedError('Session revoked');
    }

    try {
        await cacheActiveSession(redis, decoded, session);
    } catch {
        const lastSeenAt = session.last_seen_at
            ? new Date(session.last_seen_at).getTime()
            : 0;
        const staleAfterMs = env.AUTH_SESSION_LAST_SEEN_INTERVAL_SECONDS * 1000;
        if (Date.now() - lastSeenAt >= staleAfterMs) {
            db('auth_refresh_tokens')
                .where({ id: session.id, is_revoked: false })
                .update({ last_seen_at: new Date() })
                .catch((err) => logger.warn(
                    { err, sessionId: session.id },
                    'Failed to update fallback session activity',
                ));
        }
    }
};

const assertActiveAdminAccount = async (decoded) => {
    if (decoded.role !== 'admin') return;

    try {
        const adminAccount = await db('admin_accounts')
            .where({ user_id: decoded.userId, is_active: true })
            .whereNull('deleted_at')
            .first('id');

        if (!adminAccount) {
            throw new UnauthorizedError('Admin account is disabled');
        }
    } catch (err) {
        if (err.code === '42P01') return;
        throw err;
    }
};

const mfaEnforcedRoles = new Set(
    String(env.MFA_ENFORCED_ROLES || '')
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
);

const assertActiveAuthUser = async (decoded) => {
    const user = await db('auth_users')
        .where({ id: decoded.userId, is_active: true })
        .whereNull('deleted_at')
        .first('id', 'role', 'totp_enabled', 'totp_verified_at');

    if (!user) {
        throw new UnauthorizedError('Account is deactivated');
    }
    return user;
};

const authenticateAccessToken = async (token, { allowMfaSetup = false } = {}) => {
    if (!token) {
        throw new UnauthorizedError('Missing access token');
    }

    const decoded = verifyAccessToken(token);
    if (decoded.purpose === '2fa') {
        throw new UnauthorizedError('Invalid token purpose');
    }
    await assertActiveAccessSession(decoded);
    const activeUser = await assertActiveAuthUser(decoded);
    const mfaRequired = mfaEnforcedRoles.has(activeUser.role) && !activeUser.totp_enabled;
    if (mfaRequired && !allowMfaSetup) {
        throw new UnauthorizedError('MFA setup required');
    }
    await assertActiveAdminAccount(decoded);
    return createAbility({
        userId: decoded.userId,
        role: decoded.role,
        academyId: decoded.academyId,
        branchId: decoded.branchId,
        linkedPlayerId: decoded.linkedPlayerId,
        sessionId: decoded.jti,
        totpEnabled: Boolean(activeUser.totp_enabled),
        mfaRequired,
    }, db);
};

const isMfaSetupRoute = (req) => {
    const url = req.originalUrl || '';
    return [
        '/api/v1/auth/me',
        '/api/v1/auth/logout',
        '/api/v1/auth/2fa/setup',
        '/api/v1/auth/2fa/verify-setup',
    ].some((prefix) => url.startsWith(prefix));
};

/**
 * Auth middleware. Browser clients authenticate with an httpOnly accessToken
 * cookie; Authorization: Bearer is retained for non-browser API clients.
 */
const authMiddleware = async (req, _res, next) => {
    const token = readAccessToken(req);

    try {
        req.user = await authenticateAccessToken(token, {
            allowMfaSetup: isMfaSetupRoute(req),
        });
        return next();
    } catch (err) {
        if (err instanceof UnauthorizedError) return next(err);
        if (err.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Token expired'));
        }
        return next(new UnauthorizedError('Invalid token'));
    }
};

/**
 * Optional auth attaches a verified JWT payload if one is present. It does not
 * perform DB session validation because callers must treat it as advisory.
 */
const optionalAuth = (req, _res, next) => {
    const token = readAccessToken(req);
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = verifyAccessToken(token);
        if (decoded.purpose === '2fa') {
            req.user = null;
            return next();
        }
        req.user = createAbility({
            userId: decoded.userId,
            role: decoded.role,
            academyId: decoded.academyId,
            branchId: decoded.branchId,
            linkedPlayerId: decoded.linkedPlayerId,
            sessionId: decoded.jti,
        }, db);
    } catch {
        req.user = null;
    }
    return next();
};

module.exports = { authMiddleware, authenticateAccessToken, optionalAuth, readAccessToken };
