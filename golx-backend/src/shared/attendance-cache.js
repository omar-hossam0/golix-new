const CACHE_PREFIX = 'goalix:cache:attendance';
const CACHE_TTL_SECONDS = 30;

const versionKey = (academyId) => `${CACHE_PREFIX}:version:${academyId}`;

async function getAttendanceCacheVersion(redis, academyId) {
    if (!redis || !academyId) return '0';

    try {
        return (await redis.get(versionKey(academyId))) || '0';
    } catch {
        return '0';
    }
}

async function invalidateAttendanceCache(redis, academyId) {
    if (!redis || !academyId) return;

    try {
        await redis.incr(versionKey(academyId));
    } catch {
        // Redis is an optional optimization. Database reads remain authoritative.
    }
}

function buildAttendanceOverviewCacheKey(academyId, version, filters = {}) {
    const normalized = [
        filters.branchId || 'all-branches',
        filters.groupId || 'all-groups',
        filters.dateFrom || 'all-time',
        filters.dateTo || 'all-time',
    ].join(':');

    return `${CACHE_PREFIX}:overview:${academyId}:v${version}:${normalized}`;
}

module.exports = {
    CACHE_TTL_SECONDS,
    buildAttendanceOverviewCacheKey,
    getAttendanceCacheVersion,
    invalidateAttendanceCache,
};
