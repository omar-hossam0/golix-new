require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const RankingsService = require('../src/modules/rankings/rankings.service');

describe('rankings service period contracts', () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('weekly rankings default to the current ISO week and stay academy-scoped', async () => {
        jest.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
        const repo = {
            findRankings: jest.fn(async () => ({ data: [], total: 0 })),
        };
        const service = new RankingsService(repo, { add: jest.fn() });

        await service.getWeeklyRankings('academy-1', { page: 1, limit: 20 });

        expect(repo.findRankings).toHaveBeenCalledWith('2026-W27', {
            academyId: 'academy-1',
            page: 1,
            limit: 20,
        });
    });

    test('monthly rankings default to the current month and use monthly ranking source', async () => {
        jest.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
        const repo = {
            findRankingsByMonthPrefix: jest.fn(async () => ({ data: [], total: 0 })),
        };
        const service = new RankingsService(repo, { add: jest.fn() });

        await service.getMonthlyRankings('academy-1', { groupId: 'group-1' });

        expect(repo.findRankingsByMonthPrefix).toHaveBeenCalledWith('2026-07', {
            academyId: 'academy-1',
            groupId: 'group-1',
        });
    });

    test('explicit ranking period is honored for history reads', async () => {
        const repo = {
            findRankings: jest.fn(async () => ({ data: [], total: 0 })),
            findRankingsByMonthPrefix: jest.fn(async () => ({ data: [], total: 0 })),
        };
        const service = new RankingsService(repo, { add: jest.fn() });

        await service.getWeeklyRankings('academy-1', { period: '2026-W24' });
        await service.getMonthlyRankings('academy-1', { period: '2026-06' });

        expect(repo.findRankings).toHaveBeenCalledWith('2026-W24', {
            academyId: 'academy-1',
            period: '2026-W24',
        });
        expect(repo.findRankingsByMonthPrefix).toHaveBeenCalledWith('2026-06', {
            academyId: 'academy-1',
            period: '2026-06',
        });
    });
});
