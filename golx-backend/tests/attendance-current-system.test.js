const AttendanceService = require('../src/modules/attendance/attendance.service');
const {
    invalidateAttendanceCache,
} = require('../src/shared/attendance-cache');

describe('Current training attendance service', () => {
    const academyId = '11111111-1111-4111-8111-111111111111';
    const overview = {
        totalTrainings: 8,
        avgRate: 88,
        presentCount: 15,
        absentCount: 2,
        lateCount: 0,
        excusedCount: 0,
        injuredCount: 0,
        byGroup: [],
    };

    it('reads from the database and stores a short-lived cache entry', async () => {
        const repo = {
            getAttendanceOverview: jest.fn().mockResolvedValue(overview),
        };
        const redis = {
            get: jest
                .fn()
                .mockResolvedValueOnce('3')
                .mockResolvedValueOnce(null),
            set: jest.fn().mockResolvedValue('OK'),
        };
        const service = new AttendanceService(repo, redis);

        await expect(service.getAttendanceOverview({}, academyId)).resolves.toEqual(overview);
        expect(repo.getAttendanceOverview).toHaveBeenCalledWith({ academyId });
        expect(redis.set).toHaveBeenCalledWith(
            expect.stringContaining(`${academyId}:v3:`),
            JSON.stringify(overview),
            'EX',
            30,
        );
    });

    it('uses cached attendance without running another database query', async () => {
        const repo = {
            getAttendanceOverview: jest.fn(),
        };
        const redis = {
            get: jest
                .fn()
                .mockResolvedValueOnce('7')
                .mockResolvedValueOnce(JSON.stringify(overview)),
            set: jest.fn(),
        };
        const service = new AttendanceService(repo, redis);

        await expect(service.getAttendanceOverview({}, academyId)).resolves.toEqual(overview);
        expect(repo.getAttendanceOverview).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('invalidates all attendance filter variants by bumping the academy version', async () => {
        const redis = { incr: jest.fn().mockResolvedValue(4) };

        await invalidateAttendanceCache(redis, academyId);

        expect(redis.incr).toHaveBeenCalledWith(
            `goalix:cache:attendance:version:${academyId}`,
        );
    });
});
