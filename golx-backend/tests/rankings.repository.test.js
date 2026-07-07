require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const RankingsRepository = require('../src/modules/rankings/rankings.repository');

describe('rankings repository query contracts', () => {
    test('monthly ranking-system reads filter source inputs by requested month and academy', async () => {
        const db = {
            raw: jest.fn(async () => ({ rows: [] })),
        };
        const repo = new RankingsRepository(db);

        await repo.findMonthlyRankingSystemRankings('2026-07', {
            academyId: 'academy-1',
            groupId: 'group-1',
            page: 1,
            limit: 20,
        });

        const [sql, bindings] = db.raw.mock.calls[0];
        expect(bindings).toEqual(expect.objectContaining({
            academyId: 'academy-1',
            groupId: 'group-1',
            monthPeriod: '2026-07',
        }));
        expect(sql).toContain("ce.start_datetime >= to_date(:monthPeriod::text, 'YYYY-MM')");
        expect(sql).toContain("m.match_date >= to_date(:monthPeriod::text, 'YYYY-MM')::date");
        expect(sql).toContain("pdai.input_date >= to_date(:monthPeriod::text, 'YYYY-MM')::date");
        expect(sql).toContain('m.academy_id = :academyId');
        expect(sql).toContain("COALESCE(\n                        to_date(:monthPeriod::text, 'YYYY-MM')");
    });
});
