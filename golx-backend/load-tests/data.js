const crypto = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/infrastructure/database');
const env = require('../src/config/env');
const {
    connectRedis,
    isRedisAvailable,
    redis,
} = require('../src/infrastructure/redis');
const {
    encodeSession,
    sessionCacheKey,
    touchLockKey,
    userSessionsKey,
} = require('../src/shared/auth-session-cache');

const LOAD_TEST_PREFIX = 'goalix_lt_';
const CHUNK_SIZE = 500;
const authUserCacheKey = (userId) => `goalix:auth:user:v1:${userId}`;
const unreadCountCacheKey = (userId) => `goalix:notifications:${userId}:unread-count:v1`;
const conversationsCacheKey = (userId) => `goalix:chat:${userId}:conversations:v1`;

function chunked(rows, size = CHUNK_SIZE) {
    const chunks = [];
    for (let index = 0; index < rows.length; index += size) {
        chunks.push(rows.slice(index, index + size));
    }
    return chunks;
}

function assertExactRunPrefix(prefix) {
    if (!/^goalix_lt_[a-f0-9]{12}_$/.test(prefix)) {
        throw new Error(`Refusing unsafe load-test prefix: ${prefix}`);
    }
}

function benchmarkIp(index) {
    const value = index % (256 * 254);
    const thirdOctet = Math.floor(value / 254);
    const fourthOctet = (value % 254) + 1;
    return `198.18.${thirdOctet}.${fourthOctet}`;
}

function generatorLoopbackAddress(index) {
    return `127.0.0.${2 + (index % 16)}`;
}

async function identityFingerprint() {
    const result = await db.raw(`
        SELECT
            COUNT(*)::int AS count,
            COALESCE(
                MD5(STRING_AGG(id::text, ',' ORDER BY id)),
                MD5('')
            ) AS hash
        FROM auth_users
        WHERE username IS NULL OR username NOT LIKE ?
    `, [`${LOAD_TEST_PREFIX}%`]);

    const iamResult = await db.raw(`
        SELECT
            COUNT(*)::int AS count,
            COALESCE(
                MD5(STRING_AGG(id::text, ',' ORDER BY id)),
                MD5('')
            ) AS hash
        FROM iam_users
        WHERE username IS NULL OR username NOT LIKE ?
    `, [`${LOAD_TEST_PREFIX}%`]);

    return {
        authUsers: result.rows[0],
        iamUsers: iamResult.rows[0],
    };
}

async function loadTestCounts(prefix = LOAD_TEST_PREFIX) {
    const pattern = `${prefix}%`;
    const [authUsers, iamUsers, sessions] = await Promise.all([
        db('auth_users').where('username', 'like', pattern).count('* as count').first(),
        db('iam_users').where('username', 'like', pattern).count('* as count').first(),
        db('auth_refresh_tokens as art')
            .join('auth_users as au', 'art.user_id', 'au.id')
            .where('au.username', 'like', pattern)
            .count('* as count')
            .first(),
    ]);

    return {
        authUsers: Number(authUsers.count),
        iamUsers: Number(iamUsers.count),
        sessions: Number(sessions.count),
    };
}

async function warmSessionCache(clients) {
    if (!isRedisAvailable()) await connectRedis();
    if (!isRedisAvailable()) return false;

    for (const rows of chunked(clients)) {
        const pipeline = redis.pipeline();
        for (const client of rows) {
            const ttl = env.AUTH_SESSION_CACHE_TTL_SECONDS;
            pipeline.set(
                sessionCacheKey(client.id, client.accessJti),
                encodeSession(client.sessionId, client.accessJti),
                'EX',
                ttl,
            );
            pipeline.sadd(userSessionsKey(client.id), client.accessJti);
            pipeline.expire(userSessionsKey(client.id), ttl);
        }
        await pipeline.exec();
    }
    return true;
}

async function clearSessionCache(clients) {
    if (!clients.length) return;
    try {
        if (!isRedisAvailable()) await connectRedis();
    } catch {
        return;
    }
    if (!isRedisAvailable()) return;

    for (const rows of chunked(clients)) {
        const pipeline = redis.pipeline();
        for (const client of rows) {
            pipeline.del(sessionCacheKey(client.id, client.accessJti));
            pipeline.del(userSessionsKey(client.id));
            pipeline.del(authUserCacheKey(client.id));
            pipeline.del(unreadCountCacheKey(client.id));
            pipeline.del(conversationsCacheKey(client.id));
            if (client.sessionId) pipeline.del(touchLockKey(client.sessionId));
        }
        await pipeline.exec();
    }
}

async function provisionLoadUsers({ count, runId, warmCache = true }) {
    if (!Number.isInteger(count) || count < 1 || count > 10000) {
        throw new Error('User count must be an integer from 1 to 10000');
    }

    const prefix = `${LOAD_TEST_PREFIX}${runId}_`;
    assertExactRunPrefix(prefix);

    const existing = await loadTestCounts(prefix);
    if (existing.authUsers || existing.iamUsers || existing.sessions) {
        throw new Error(`Load-test data already exists for ${prefix}`);
    }

    const academy = await db('academy_academies')
        .whereNull('deleted_at')
        .orderBy('created_at', 'asc')
        .first('id', 'name');
    if (!academy) {
        throw new Error('No active academy exists for the load test');
    }

    const playerRole = await db('iam_roles')
        .where({
            code: 'player',
            is_system: true,
            is_active: true,
        })
        .whereNull('academy_id')
        .whereNull('deleted_at')
        .first('id');
    if (!playerRole) {
        throw new Error('The system player IAM role is missing');
    }

    const passwordHash = await bcrypt.hash(`GoalixLoad!${runId}`, env.BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const authUsers = [];
    const iamUsers = [];
    const memberships = [];
    const roles = [];
    const sessions = [];
    const clients = [];

    for (let index = 0; index < count; index += 1) {
        const id = crypto.randomUUID();
        const sessionId = crypto.randomUUID();
        const accessJti = crypto.randomUUID();
        const username = `${prefix}${String(index + 1).padStart(5, '0')}`;
        const ip = benchmarkIp(index);
        const accessToken = jwt.sign({
            userId: id,
            role: 'player',
            academyId: academy.id,
            linkedPlayerId: null,
            jti: accessJti,
        }, env.JWT_SECRET, {
            expiresIn: '2h',
            algorithm: 'HS256',
        });

        authUsers.push({
            id,
            username,
            password_hash: passwordHash,
            role: 'player',
            academy_id: academy.id,
            is_active: true,
            is_verified: true,
        });
        iamUsers.push({
            id,
            username,
            password_hash: passwordHash,
            full_name: `Goalix Load User ${index + 1}`,
            is_active: true,
            is_verified: true,
        });
        memberships.push({
            user_id: id,
            academy_id: academy.id,
            status: 'active',
        });
        roles.push({
            user_id: id,
            role_id: playerRole.id,
            academy_id: academy.id,
        });
        sessions.push({
            id: sessionId,
            user_id: id,
            token_hash: crypto.randomBytes(32).toString('hex'),
            expires_at: expiresAt,
            is_revoked: false,
            access_jti: accessJti,
            ip_address: ip,
            user_agent: 'GoalixLoadTest/1.0',
            last_seen_at: new Date(),
        });
        clients.push({
            id,
            username,
            accessToken,
            accessJti,
            sessionId,
            ip,
            localAddress: generatorLoopbackAddress(index),
        });
    }

    await db.transaction(async (trx) => {
        for (const rows of chunked(authUsers)) await trx('auth_users').insert(rows);
        for (const rows of chunked(iamUsers)) await trx('iam_users').insert(rows);
        for (const rows of chunked(memberships)) await trx('iam_user_academies').insert(rows);
        for (const rows of chunked(roles)) await trx('iam_user_roles').insert(rows);
        for (const rows of chunked(sessions)) await trx('auth_refresh_tokens').insert(rows);
    });

    const counts = await loadTestCounts(prefix);
    if (counts.authUsers !== count || counts.iamUsers !== count || counts.sessions !== count) {
        throw new Error(`Provision verification failed: ${JSON.stringify(counts)}`);
    }

    const sessionCacheWarmed = warmCache
        ? await warmSessionCache(clients)
        : false;

    return {
        prefix,
        academy,
        clients,
        counts,
        sessionCacheWarmed,
    };
}

async function cleanupExactRun(prefix) {
    assertExactRunPrefix(prefix);
    const pattern = `${prefix}%`;

    const result = await db.transaction(async (trx) => {
        const authIds = await trx('auth_users')
            .where('username', 'like', pattern)
            .pluck('id');
        const cachedSessions = await trx('auth_refresh_tokens')
            .whereIn('user_id', authIds)
            .select('user_id as id', 'access_jti as accessJti', 'id as sessionId');
        const iamIds = await trx('iam_users')
            .where('username', 'like', pattern)
            .pluck('id');

        let deletedAuthUsers = 0;
        let deletedIamUsers = 0;
        for (const ids of chunked(authIds)) {
            deletedAuthUsers += await trx('auth_users').whereIn('id', ids).del();
        }
        for (const ids of chunked(iamIds)) {
            deletedIamUsers += await trx('iam_users').whereIn('id', ids).del();
        }

        return { deletedAuthUsers, deletedIamUsers, cachedSessions };
    });

    await clearSessionCache(result.cachedSessions);
    return {
        deletedAuthUsers: result.deletedAuthUsers,
        deletedIamUsers: result.deletedIamUsers,
        remaining: await loadTestCounts(prefix),
    };
}

async function cleanupAllLoadUsers() {
    const pattern = `${LOAD_TEST_PREFIX}%`;
    const result = await db.transaction(async (trx) => {
        const authIds = await trx('auth_users')
            .where('username', 'like', pattern)
            .pluck('id');
        const cachedSessions = await trx('auth_refresh_tokens')
            .whereIn('user_id', authIds)
            .select('user_id as id', 'access_jti as accessJti', 'id as sessionId');
        const iamIds = await trx('iam_users')
            .where('username', 'like', pattern)
            .pluck('id');

        let deletedAuthUsers = 0;
        let deletedIamUsers = 0;
        for (const ids of chunked(authIds)) {
            deletedAuthUsers += await trx('auth_users').whereIn('id', ids).del();
        }
        for (const ids of chunked(iamIds)) {
            deletedIamUsers += await trx('iam_users').whereIn('id', ids).del();
        }

        return { deletedAuthUsers, deletedIamUsers, cachedSessions };
    });

    await clearSessionCache(result.cachedSessions);
    return {
        deletedAuthUsers: result.deletedAuthUsers,
        deletedIamUsers: result.deletedIamUsers,
    };
}

async function closeInfrastructure() {
    await db.destroy();
    try {
        if (redis.status === 'ready') await redis.quit();
        else redis.disconnect();
    } catch {
        redis.disconnect();
    }
}

module.exports = {
    LOAD_TEST_PREFIX,
    cleanupAllLoadUsers,
    cleanupExactRun,
    closeInfrastructure,
    db,
    identityFingerprint,
    loadTestCounts,
    provisionLoadUsers,
};
