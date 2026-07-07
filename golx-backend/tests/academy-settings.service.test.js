jest.mock('../src/events/eventBus', () => ({
    publish: jest.fn(),
}));
jest.mock('../src/config/env', () => ({
    ACADEMY_BRANCHES_CACHE_TTL_SECONDS: 300,
}));
jest.mock('../src/infrastructure/redis', () => ({
    redis: {},
}));

const AcademyService = require('../src/modules/academy/academy.service');

describe('academy system defaults', () => {
    test('stores Match Day open minutes as a normalized number and removes timezone', async () => {
        const repo = {
            update: jest.fn(async (_academyId, updateData) => ({
                id: 'academy-1',
                ...updateData,
            })),
        };
        const service = new AcademyService(repo);

        const result = await service.updateAcademy('academy-1', {
            settings: {
                timezone: 'Africa/Cairo',
                match_day_open_minutes_before_kickoff: '37.6',
                attendance: { lateGraceMinutes: 10 },
            },
        });

        expect(repo.update).toHaveBeenCalledWith(
            'academy-1',
            {
                settings: {
                    matchDayOpenMinutesBeforeKickoff: 38,
                    attendance: { lateGraceMinutes: 10 },
                },
            },
        );
        expect(result.settings.matchDayOpenMinutesBeforeKickoff).toBe(38);
        expect(result.settings).not.toHaveProperty('timezone');
    });

    test('clamps Match Day open minutes to the supported 0-240 range', async () => {
        const repo = {
            update: jest.fn(async (_academyId, updateData) => ({
                id: 'academy-1',
                ...updateData,
            })),
        };
        const service = new AcademyService(repo);

        const result = await service.updateAcademy('academy-1', {
            settings: { matchDayOpenMinutesBeforeKickoff: 900 },
        });

        expect(result.settings.matchDayOpenMinutesBeforeKickoff).toBe(240);
    });
});
