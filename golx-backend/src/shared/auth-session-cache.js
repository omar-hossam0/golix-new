const env = require('../config/env');

const SESSION_PREFIX = 'goalix:auth:session';
const USER_SESSIONS_PREFIX = 'goalix:auth:user-sessions';
const TOUCH_LOCK_PREFIX = 'goalix:auth:session-touch';

function sessionCacheKey(userId, accessJti) {
    return `${SESSION_PREFIX}:${userId}:${accessJti}`;
}

function userSessionsKey(userId) {
    return `${USER_SESSIONS_PREFIX}:${userId}`;
}

function touchLockKey(sessionId) {
    return `${TOUCH_LOCK_PREFIX}:${sessionId}`;
}

function deterministicJitter(value, maxSeconds) {
    if (!maxSeconds) return 0;
    let hash = 0;
    for (const character of String(value || '')) {
        hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }
    return hash % (maxSeconds + 1);
}

function accessTokenTtlSeconds(decoded) {
    if (!decoded?.exp) return env.AUTH_SESSION_CACHE_TTL_SECONDS;
    return Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
}

function sessionTtlSeconds(decoded, session = {}) {
    const tokenTtl = accessTokenTtlSeconds(decoded);
    const sessionTtl = session.expires_at
        ? Math.max(1, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000))
        : tokenTtl;
    return Math.max(
        1,
        Math.min(env.AUTH_SESSION_CACHE_TTL_SECONDS, tokenTtl, sessionTtl),
    );
}

function nextTouchAt(accessJti) {
    const jitter = deterministicJitter(
        accessJti,
        env.AUTH_SESSION_LAST_SEEN_JITTER_SECONDS,
    );
    return Date.now() + ((env.AUTH_SESSION_LAST_SEEN_INTERVAL_SECONDS + jitter) * 1000);
}

function encodeSession(sessionId, accessJti) {
    return JSON.stringify({
        sessionId,
        nextTouchAt: nextTouchAt(accessJti),
    });
}

function decodeSession(value) {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        if (!parsed?.sessionId) return null;
        return parsed;
    } catch {
        return null;
    }
}

async function getCachedSession(redis, userId, accessJti) {
    const value = await redis.get(sessionCacheKey(userId, accessJti));
    return decodeSession(value);
}

async function cacheActiveSession(redis, decoded, session) {
    const ttl = sessionTtlSeconds(decoded, session);
    const key = sessionCacheKey(decoded.userId, decoded.jti);
    const memberKey = userSessionsKey(decoded.userId);
    const value = encodeSession(session.id, decoded.jti);

    await Promise.all([
        redis.set(key, value, 'EX', ttl),
        redis.sadd(memberKey, decoded.jti),
        redis.expire(memberKey, ttl),
    ]);

    return decodeSession(value);
}

async function markSessionSeen(redis, decoded, cachedSession) {
    if (!cachedSession || cachedSession.nextTouchAt > Date.now()) return false;

    const interval = env.AUTH_SESSION_LAST_SEEN_INTERVAL_SECONDS;
    const claimed = await redis.set(
        touchLockKey(cachedSession.sessionId),
        '1',
        'EX',
        interval,
        'NX',
    );
    if (claimed !== 'OK') return false;

    const refreshed = JSON.stringify({
        sessionId: cachedSession.sessionId,
        nextTouchAt: nextTouchAt(decoded.jti),
    });
    await redis.set(
        sessionCacheKey(decoded.userId, decoded.jti),
        refreshed,
        'KEEPTTL',
    );
    return true;
}

async function invalidateSession(redis, userId, accessJti) {
    if (!accessJti) return;
    await Promise.all([
        redis.del(sessionCacheKey(userId, accessJti)),
        redis.srem(userSessionsKey(userId), accessJti),
    ]);
}

async function invalidateAllUserSessions(redis, userId) {
    const memberKey = userSessionsKey(userId);
    const accessJtis = await redis.smembers(memberKey);
    const keys = accessJtis.map((accessJti) => sessionCacheKey(userId, accessJti));
    if (keys.length) await redis.del(...keys);
    await redis.del(memberKey);
}

module.exports = {
    accessTokenTtlSeconds,
    cacheActiveSession,
    decodeSession,
    deterministicJitter,
    encodeSession,
    getCachedSession,
    invalidateAllUserSessions,
    invalidateSession,
    markSessionSeen,
    nextTouchAt,
    sessionCacheKey,
    sessionTtlSeconds,
    touchLockKey,
    userSessionsKey,
};
