const {
    CACHE_TTL_SECONDS,
    buildAttendanceOverviewCacheKey,
    getAttendanceCacheVersion,
} = require('../../shared/attendance-cache');

class AttendanceService {
    constructor(attendanceRepository, redis) {
        this.repo = attendanceRepository;
        this.redis = redis;
    }

    async getAttendanceOverview(filters, academyId) {
        const version = await getAttendanceCacheVersion(this.redis, academyId);
        const cacheKey = buildAttendanceOverviewCacheKey(academyId, version, filters);

        if (this.redis) {
            try {
                const cached = await this.redis.get(cacheKey);
                if (cached) return JSON.parse(cached);
            } catch {
                // Fall through to the authoritative database query.
            }
        }

        const overview = await this.repo.getAttendanceOverview({ ...filters, academyId });

        if (this.redis) {
            try {
                await this.redis.set(
                    cacheKey,
                    JSON.stringify(overview),
                    'EX',
                    CACHE_TTL_SECONDS,
                );
            } catch {
                // Caching is optional; never fail an attendance read because Redis is down.
            }
        }

        return overview;
    }
}

module.exports = AttendanceService;
