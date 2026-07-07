require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const {
    cacheActiveSession,
    decodeSession,
    deterministicJitter,
    getCachedSession,
    invalidateAllUserSessions,
    invalidateSession,
    markSessionSeen,
    sessionCacheKey,
    userSessionsKey,
} = require('../src/shared/auth-session-cache');

function createRedisMock() {
    const values = new Map();
    const sets = new Map();

    return {
        values,
        sets,
        get: jest.fn(async (key) => values.get(key) || null),
        set: jest.fn(async (key, value, ...args) => {
            if (args.includes('NX') && values.has(key)) return null;
            values.set(key, value);
            return 'OK';
        }),
        del: jest.fn(async (...keys) => {
            let deleted = 0;
            keys.forEach((key) => {
                if (values.delete(key)) deleted += 1;
                if (sets.delete(key)) deleted += 1;
            });
            return deleted;
        }),
        sadd: jest.fn(async (key, member) => {
            if (!sets.has(key)) sets.set(key, new Set());
            sets.get(key).add(member);
            return 1;
        }),
        srem: jest.fn(async (key, member) => {
            const members = sets.get(key);
            if (!members) return 0;
            return members.delete(member) ? 1 : 0;
        }),
        smembers: jest.fn(async (key) => [...(sets.get(key) || [])]),
        expire: jest.fn(async () => 1),
    };
}

describe('auth session cache', () => {
    const decoded = {
        userId: '0f4f11d9-8248-495d-95ed-d6cb987405ed',
        jti: '8be923a9-c0ba-4db7-bf56-c3e379fa5d36',
        exp: Math.floor(Date.now() / 1000) + 900,
    };
    const session = {
        id: '981447b6-0899-463f-8904-7757568c0594',
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
    };

    test('jitter is deterministic and bounded', () => {
        expect(deterministicJitter(decoded.jti, 60)).toBe(
            deterministicJitter(decoded.jti, 60),
        );
        expect(deterministicJitter(decoded.jti, 60)).toBeGreaterThanOrEqual(0);
        expect(deterministicJitter(decoded.jti, 60)).toBeLessThanOrEqual(60);
    });

    test('caches and reads an active session', async () => {
        const redis = createRedisMock();
        await cacheActiveSession(redis, decoded, session);

        const cached = await getCachedSession(redis, decoded.userId, decoded.jti);
        expect(cached.sessionId).toBe(session.id);
        expect(cached.nextTouchAt).toBeGreaterThan(Date.now());
        expect(redis.sadd).toHaveBeenCalledWith(
            userSessionsKey(decoded.userId),
            decoded.jti,
        );
    });

    test('touches stale activity once and advances its timestamp', async () => {
        const redis = createRedisMock();
        const key = sessionCacheKey(decoded.userId, decoded.jti);
        redis.values.set(key, JSON.stringify({
            sessionId: session.id,
            nextTouchAt: 0,
        }));

        const stale = decodeSession(redis.values.get(key));
        await expect(markSessionSeen(redis, decoded, stale)).resolves.toBe(true);

        const refreshed = decodeSession(redis.values.get(key));
        expect(refreshed.nextTouchAt).toBeGreaterThan(Date.now());
        await expect(markSessionSeen(redis, decoded, refreshed)).resolves.toBe(false);
    });

    test('invalidates one session without removing sibling sessions', async () => {
        const redis = createRedisMock();
        const secondJti = '52a34b6d-6792-45d1-a9bd-255076e5ce03';
        await cacheActiveSession(redis, decoded, session);
        await cacheActiveSession(redis, {
            ...decoded,
            jti: secondJti,
        }, {
            ...session,
            id: 'e8655280-0a5a-4a3d-b4ef-055af1aa094e',
        });

        await invalidateSession(redis, decoded.userId, decoded.jti);
        expect(await getCachedSession(redis, decoded.userId, decoded.jti)).toBeNull();
        expect(await getCachedSession(redis, decoded.userId, secondJti)).not.toBeNull();
    });

    test('invalidates every cached session for a user', async () => {
        const redis = createRedisMock();
        const secondJti = '6fa1f181-0729-40df-a805-096489d4b844';
        await cacheActiveSession(redis, decoded, session);
        await cacheActiveSession(redis, {
            ...decoded,
            jti: secondJti,
        }, {
            ...session,
            id: '9099db97-8f99-422b-931d-ded630e567cb',
        });

        await invalidateAllUserSessions(redis, decoded.userId);
        expect(await getCachedSession(redis, decoded.userId, decoded.jti)).toBeNull();
        expect(await getCachedSession(redis, decoded.userId, secondJti)).toBeNull();
        expect(await redis.smembers(userSessionsKey(decoded.userId))).toEqual([]);
    });
});
