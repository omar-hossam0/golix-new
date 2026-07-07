async function getJsonCache(redis, key) {
    try {
        const raw = await redis.get(key);
        if (raw === null || raw === undefined) return undefined;
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

async function setJsonCache(redis, key, value, ttlSeconds) {
    if (!ttlSeconds || ttlSeconds < 1) return;
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
        // Redis is an optimization. Callers should keep serving from source.
    }
}

async function deleteCacheKeys(redis, keys) {
    const uniqueKeys = [...new Set((keys || []).filter(Boolean))];
    if (!uniqueKeys.length) return;

    try {
        if (typeof redis.pipeline === 'function') {
            const pipeline = redis.pipeline();
            uniqueKeys.forEach((key) => pipeline.del(key));
            await pipeline.exec();
            return;
        }

        await Promise.all(uniqueKeys.map((key) => redis.del(key)));
    } catch {
        // Best-effort invalidation only.
    }
}

async function getCacheVersion(redis, key) {
    try {
        const version = await redis.get(key);
        return version || '1';
    } catch {
        return '1';
    }
}

async function bumpCacheVersion(redis, key) {
    try {
        await redis.incr(key);
        await redis.expire(key, 30 * 24 * 60 * 60);
    } catch {
        // Best-effort invalidation only.
    }
}

module.exports = {
    bumpCacheVersion,
    deleteCacheKeys,
    getCacheVersion,
    getJsonCache,
    setJsonCache,
};
